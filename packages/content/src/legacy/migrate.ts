/**
 * Migration der Legacy-Quellen `questions.js` und `config.js` (Spezifikation 26).
 *
 * Ablauf:
 *   questions.js + config.js
 *   -> sicherer Legacy-Parser (kein eval)
 *   -> Normalisierung von IDs und Enumwerten
 *   -> Zuordnung zum neuen Fragenmodell
 *   -> explizite richtige Antwort
 *   -> Erkennung moeglicher Wiederholungsgruppen
 *   -> Korrekturbericht
 *
 * KEINE STILLE KORREKTUR: Automatisch normalisierbare Werte wie `Kids` -> `kids`
 * werden korrigiert, aber immer im Bericht genannt. Inhaltliche Widersprueche,
 * fehlende Optionen und moegliche falsche Antworten brauchen menschliche Freigabe
 * und erscheinen als `needsReview`.
 *
 * Die Feldnamen der Altdaten werden tolerant erkannt, weil in den Quellen mehrere
 * Schreibweisen vorkommen (z. B. `Anmerkung` neben `note`).
 */
import type { AnswerOption, MediaAsset, Question, QuestionPresentationType } from '@quiz/contracts'
import { extractDeclarations, type LiteralValue } from './parseLiteral'

export interface MigrationNote {
  severity: 'normalized' | 'needs-review'
  code: string
  questionId?: string
  message: string
}

export interface MigrationResult {
  questions: Question[]
  assets: MediaAsset[]
  notes: MigrationNote[]
  /** Fragen, die ohne menschliche Entscheidung nicht uebernommen werden koennen. */
  skipped: { legacyId: string; reason: string }[]
  statistics: {
    total: number
    migrated: number
    byPresentationType: Record<string, number>
    repetitionGroups: number
  }
}

export interface MigrationOptions {
  /** Inhalt von `questions.js`. */
  questionsSource: string
  /** Inhalt von `config.js`; optional, wird nur fuer Diagnose gelesen. */
  configSource?: string
  /**
   * Unterverzeichnis, in dem die Fragenbilder liegen (relativ zu `assets/`).
   * Vorgabe `questions` - dort liegen die gelieferten Bilder.
   */
  imageDirectory?: string
}

/** Enumwerte, die in den Altdaten uneinheitlich geschrieben sind. */
const MODE_ALIASES: Record<string, string> = { kids: 'kids', kid: 'kids', adults: 'adults', adult: 'adults' }
const DIFFICULTY_ALIASES: Record<string, string> = {
  easy: 'easy',
  leicht: 'easy',
  medium: 'medium',
  mittel: 'medium',
  hard: 'hard',
  schwer: 'hard',
}

export function migrateLegacy(options: MigrationOptions): MigrationResult {
  const notes: MigrationNote[] = []
  const skipped: MigrationResult['skipped'] = []
  const assets = new Map<string, MediaAsset>()
  const imageDirectory = options.imageDirectory ?? 'questions'

  const declarations = extractDeclarations(options.questionsSource)
  const rawQuestions = findQuestionArray(declarations)
  if (!rawQuestions) {
    throw new Error(
      'In der Legacy-Datei wurde kein Fragen-Array gefunden. Erwartet wird z. B. "const questions = [ ... ]".',
    )
  }

  if (options.configSource) {
    inspectLegacyConfig(options.configSource, notes)
  }

  const questions: Question[] = []
  const seenIds = new Set<string>()

  for (const entry of rawQuestions) {
    if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
      skipped.push({ legacyId: '(unbekannt)', reason: 'Eintrag ist kein Objekt.' })
      continue
    }
    const record = entry as Record<string, LiteralValue>
    const legacyId = String(pick(record, ['id', 'ID', 'nummer']) ?? '')
    if (!legacyId) {
      skipped.push({ legacyId: '(ohne ID)', reason: 'Frage ohne ID - fortlaufende IDs sind nicht erforderlich, eine ID aber schon.' })
      continue
    }

    const id = normalizeId(legacyId)
    if (id !== legacyId) {
      notes.push({ severity: 'normalized', code: 'id-normalized', questionId: id, message: `ID "${legacyId}" zu "${id}" normalisiert.` })
    }
    if (seenIds.has(id)) {
      skipped.push({ legacyId, reason: `Doppelte Frage-ID "${id}".` })
      continue
    }

    const prompt = asString(pick(record, ['question', 'frage', 'text', 'prompt']))
    if (!prompt) {
      skipped.push({ legacyId, reason: 'Kein Fragetext vorhanden.' })
      continue
    }

    const modeId = normalizeEnum(asString(pick(record, ['mode', 'modus'])) ?? 'adults', MODE_ALIASES)
    if (modeId.changed) {
      notes.push({
        severity: 'normalized',
        code: 'mode-normalized',
        questionId: id,
        message: `Modus "${modeId.original}" zu "${modeId.value}" normalisiert.`,
      })
    }
    const difficulty = normalizeEnum(
      // In den Altdaten heisst das Feld `level`; aeltere Exporte nutzen `difficulty`.
      asString(pick(record, ['difficulty', 'schwierigkeit', 'level', 'niveau', 'stufe'])) ?? 'medium',
      DIFFICULTY_ALIASES,
    )
    if (difficulty.changed) {
      notes.push({
        severity: 'normalized',
        code: 'difficulty-normalized',
        questionId: id,
        message: `Schwierigkeit "${difficulty.original}" zu "${difficulty.value}" normalisiert.`,
      })
    }

    const categories = collectCategories(record)
    const legacyType = (asString(pick(record, ['type', 'typ'])) ?? 'multiple_choice').toLowerCase()
    const options = collectOptions(record)
    const singleAnswer = asString(pick(record, ['answer', 'antwort', 'loesung', 'solution']))
    // Die Altdaten fuehren den Dateinamen als `img_filename`; weitere Schreibweisen
    // kommen aus frueheren Exportstaenden.
    const imageFile = asString(pick(record, ['img_filename', 'imgFilename', 'image', 'img', 'bild', 'imageFile', 'bilddatei', 'picture']))

    // Das Legacy-Feld `type: "image"` ist zu ungenau: eine Bildfrage mit vier
    // Optionen ist bildgestuetztes Multiple Choice, eine mit einer Antwort das
    // Bilderkennen mit Enthuellung.
    let presentationType: QuestionPresentationType
    if (legacyType === 'image') {
      presentationType = options.length >= 2 ? 'image-choice' : 'image-reveal'
    } else if (imageFile) {
      presentationType = 'image-choice'
    } else {
      presentationType = 'text-choice'
    }

    const evaluationMode = presentationType === 'image-reveal' ? 'manual-correct-incorrect' : 'option-comparison'

    // Beim Bilderkennen gibt es keine Auswahl: Die einzige Legacy-Option ist die
    // erwartete Antwort und wird zur Moderatorhilfe, nicht zu einer sichtbaren
    // Antwortleiste. Sonst stuende die Loesung von Anfang an auf der Buehne.
    const expectedAnswers = evaluationMode === 'manual-correct-incorrect'
      ? [singleAnswer, ...options.map((option) => option.text)].filter((text): text is string => Boolean(text))
      : singleAnswer
        ? [singleAnswer]
        : []
    const selectableOptions = evaluationMode === 'manual-correct-incorrect' ? [] : options

    if (evaluationMode === 'manual-correct-incorrect' && expectedAnswers.length === 0) {
      skipped.push({ legacyId, reason: 'Bilderkennen ohne hinterlegte Antwort - die Loesungsansicht waere leer.' })
      continue
    }
    if (evaluationMode === 'option-comparison') {
      if (options.length === 0) {
        skipped.push({ legacyId, reason: 'Multiple-Choice-Frage ohne Antwortoptionen - inhaltliche Entscheidung noetig.' })
        continue
      }
      if (options.length !== 4) {
        notes.push({
          severity: 'needs-review',
          code: 'option-count',
          questionId: id,
          message: `Nur ${options.length} statt vier Antwortoptionen. Bitte redaktionell ergaenzen.`,
        })
      }
    }

    let mediaAssetId: string | undefined
    if (imageFile) {
      mediaAssetId = `img-${id}`
      assets.set(mediaAssetId, {
        id: mediaAssetId,
        kind: 'image',
        filename: `${imageDirectory}/${imageFile}`,
        mimeType: mimeTypeForFile(imageFile),
        // Bildnachweis und inhaltliche Quellenangabe sind zwei verschiedene Dinge:
        // der Nachweis gehoert an das Medium, die Quelle an die Erlaeuterung.
        credit: asString(pick(record, ['img_credit', 'imgCredit', 'bildnachweis', 'credit'])),
        sourceUrl: asString(pick(record, ['source_url', 'sourceUrl', 'quelle'])),
      })
    }
    if (mediaAssetId && !assets.get(mediaAssetId)?.credit) {
      notes.push({
        severity: 'needs-review',
        code: 'missing-image-credit',
        questionId: id,
        message: 'Bild ohne Bildnachweis. Vor der Veroeffentlichung klaeren.',
      })
    }
    if ((presentationType === 'image-choice' || presentationType === 'image-reveal') && !mediaAssetId) {
      skipped.push({ legacyId, reason: 'Bildfrage ohne hinterlegtes Bild.' })
      continue
    }

    const info = asString(pick(record, ['info', 'zusatzinfo', 'explanation']))
    const remark = asString(pick(record, ['Anmerkung', 'anmerkung', 'note', 'hinweis']))
    const sourceReference = asString(pick(record, ['source_reference', 'sourceReference', 'quellenangabe']))
    if (!info && !remark) {
      notes.push({ severity: 'needs-review', code: 'missing-info', questionId: id, message: 'Kein Zusatzinformationstext.' })
    }

    // `playCount` ist Laufzeitdatum und wird bewusst nicht uebernommen; Nutzungen
    // leben ausschliesslich in der `QuestionUsage`-Historie des Servers.
    if (record['playCount'] !== undefined) {
      notes.push({
        severity: 'normalized',
        code: 'playcount-dropped',
        questionId: id,
        message: '"playCount" verworfen - Nutzungen werden serverseitig gefuehrt.',
      })
    }

    seenIds.add(id)
    questions.push({
      id,
      // Schema v2: Zielgruppe direkt, Pool aus der Regionalkategorie abgeleitet.
      audiences: [modeId.value],
      poolIds: categories.includes('saarbruecken') ? ['saarbruecken'] : ['bundestag'],
      difficulty: difficulty.value,
      categories,
      tags: [],
      locale: 'de-DE',
      prompt,
      questionType: presentationType,
      evaluationMode,
      // Die Legacy-Annahme "option_1 ist richtig" wird hier genau einmal in eine
      // explizite `correctOptionId` uebersetzt und danach nie wieder benoetigt.
      options: selectableOptions.length ? selectableOptions : undefined,
      correctOptionId: selectableOptions.length ? selectableOptions[0]!.id : undefined,
      acceptedAnswerText: expectedAnswers.length ? expectedAnswers : undefined,
      media: mediaAssetId ? { imageAssetId: mediaAssetId } : undefined,
      explanation: {
        summary: info,
        details: remark,
        source: sourceReference,
      },
      enabled: true,
    })

    if (selectableOptions.length) {
      notes.push({
        severity: 'needs-review',
        code: 'implicit-correct-answer',
        questionId: id,
        message: 'Richtige Antwort wurde aus der Legacy-Position "option_1" abgeleitet. Bitte stichprobenartig pruefen.',
      })
    }
  }

  assignRepetitionGroups(questions, notes)

  return {
    questions,
    assets: [...assets.values()],
    notes,
    skipped,
    statistics: {
      total: rawQuestions.length,
      migrated: questions.length,
      byPresentationType: questions.reduce<Record<string, number>>((acc, question) => {
        acc[question.questionType] = (acc[question.questionType] ?? 0) + 1
        return acc
      }, {}),
      repetitionGroups: new Set(questions.map((question) => question.repetitionGroupId).filter(Boolean)).size,
    },
  }
}

/**
 * Inhaltlich gleiche Varianten bekommen eine gemeinsame Wiederholungsgruppe
 * (Spezifikation 16.4). Erkennungsgrundlage ist der normalisierte Fragetext; die
 * Gruppen werden im Bericht genannt, weil die Zusammenfassung redaktionell
 * bestaetigt werden sollte.
 */
function assignRepetitionGroups(questions: Question[], notes: MigrationNote[]): void {
  const byPrompt = new Map<string, Question[]>()
  for (const question of questions) {
    const key = question.prompt.toLowerCase().replace(/\s+/g, ' ').replace(/[.,;:!?"'()\[\]-]/g, '').trim()
    byPrompt.set(key, [...(byPrompt.get(key) ?? []), question])
  }

  let groupIndex = 0
  for (const [, group] of byPrompt) {
    if (group.length < 2) continue
    groupIndex += 1
    const groupId = `gruppe-${groupIndex}`
    for (const question of group) question.repetitionGroupId = groupId
    notes.push({
      severity: 'needs-review',
      code: 'repetition-group-detected',
      message: `Gleicher Fragetext bei ${group.map((entry) => entry.id).join(', ')} - als Wiederholungsgruppe "${groupId}" zusammengefasst. Bitte bestaetigen.`,
    })
  }
}

/** Diagnose der Legacy-Konfiguration; sie wird nicht automatisch uebernommen. */
function inspectLegacyConfig(configSource: string, notes: MigrationNote[]): void {
  let declarations: Map<string, LiteralValue>
  try {
    declarations = extractDeclarations(configSource)
  } catch (error) {
    notes.push({
      severity: 'needs-review',
      code: 'config-unparsable',
      message: `config.js konnte nicht gelesen werden: ${(error as Error).message}`,
    })
    return
  }

  for (const [name, value] of declarations) {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) continue
    for (const [presetId, presetValue] of Object.entries(value)) {
      const rounds = Array.isArray(presetValue)
        ? presetValue
        : typeof presetValue === 'object' && presetValue !== null && Array.isArray((presetValue as Record<string, LiteralValue>)['rounds'])
          ? ((presetValue as Record<string, LiteralValue>)['rounds'] as LiteralValue[])
          : null
      if (!rounds) continue
      notes.push({
        severity: rounds.length === 7 ? 'normalized' : 'needs-review',
        code: 'preset-slot-count',
        message: `Legacy-Preset "${name}.${presetId}" hat ${rounds.length} Fragenplaetze. Verbindlich sind sieben; bitte pruefen.`,
      })
    }
  }
}

/* ------------------------------------------------------------------ *
 * Feldzugriff und Normalisierung
 * ------------------------------------------------------------------ */

function findQuestionArray(declarations: Map<string, LiteralValue>): LiteralValue[] | null {
  const preferredNames = ['questions', 'QUESTIONS', 'quizQuestions', 'default', 'exports']
  for (const name of preferredNames) {
    const value = declarations.get(name)
    if (Array.isArray(value)) return value
  }
  for (const value of declarations.values()) {
    if (Array.isArray(value) && value.length > 0) return value
  }
  return null
}

function pick(record: Record<string, LiteralValue>, keys: string[]): LiteralValue | undefined {
  for (const key of keys) {
    if (record[key] !== undefined && record[key] !== null && record[key] !== '') return record[key]
  }
  return undefined
}

function asString(value: LiteralValue | undefined): string | undefined {
  if (value === undefined || value === null) return undefined
  if (typeof value === 'string') return value.trim() || undefined
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return undefined
}

function collectOptions(record: Record<string, LiteralValue>): AnswerOption[] {
  // Variante 1: option_1 .. option_4 (Legacy). Variante 2: options: [...].
  const numbered: AnswerOption[] = []
  for (let index = 1; index <= 8; index += 1) {
    const text = asString(pick(record, [`option_${index}`, `option${index}`, `antwort_${index}`]))
    if (text) numbered.push({ id: `option-${index}`, text })
  }
  if (numbered.length) return numbered

  const list = record['options']
  if (Array.isArray(list)) {
    return list
      .map((entry, index) => {
        const text = typeof entry === 'string' ? entry : asString((entry as Record<string, LiteralValue>)?.['text'])
        return text ? { id: `option-${index + 1}`, text } : null
      })
      .filter((option): option is AnswerOption => option !== null)
  }
  return []
}

function collectCategories(record: Record<string, LiteralValue>): string[] {
  const single = asString(pick(record, ['category', 'kategorie']))
  const list = record['categories']
  const values: string[] = []
  if (single) values.push(single)
  if (Array.isArray(list)) {
    for (const entry of list) {
      const text = asString(entry)
      if (text) values.push(text)
    }
  }
  return [...new Set(values.map(normalizeId))]
}

/** IDs werden klein geschrieben und von Umlauten/Sonderzeichen befreit. */
export function normalizeId(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function normalizeEnum(
  value: string,
  aliases: Record<string, string>,
): { value: string; original: string; changed: boolean } {
  const key = value.trim().toLowerCase()
  const mapped = aliases[key] ?? key
  return { value: mapped, original: value, changed: mapped !== value }
}

function mimeTypeForFile(filename: string): string {
  const extension = filename.split('.').pop()?.toLowerCase() ?? ''
  const map: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    gif: 'image/gif',
    svg: 'image/svg+xml',
    mp4: 'video/mp4',
    webm: 'video/webm',
  }
  return map[extension] ?? 'application/octet-stream'
}

/** Menschenlesbarer Migrationsbericht. */
export function formatMigrationReport(result: MigrationResult): string {
  const lines: string[] = ['# Migrationsbericht Legacy-Quizdaten', '']
  lines.push(`Gelesen: ${result.statistics.total} Eintraege, uebernommen: ${result.statistics.migrated}.`)
  lines.push(`Wiederholungsgruppen erkannt: ${result.statistics.repetitionGroups}.`)
  lines.push(
    `Nach Praesentationstyp: ${Object.entries(result.statistics.byPresentationType)
      .map(([key, value]) => `${key}=${value}`)
      .join(', ')}`,
  )
  lines.push('')

  const review = result.notes.filter((note) => note.severity === 'needs-review')
  const normalized = result.notes.filter((note) => note.severity === 'normalized')

  if (result.skipped.length) {
    lines.push('## Nicht uebernommen (menschliche Entscheidung noetig)')
    for (const entry of result.skipped) lines.push(`- ${entry.legacyId}: ${entry.reason}`)
    lines.push('')
  }
  if (review.length) {
    lines.push('## Zu pruefen')
    for (const note of review) lines.push(`- [${note.code}] ${note.questionId ? `${note.questionId}: ` : ''}${note.message}`)
    lines.push('')
  }
  if (normalized.length) {
    lines.push('## Automatisch normalisiert (nicht still - hier dokumentiert)')
    for (const note of normalized) lines.push(`- [${note.code}] ${note.questionId ? `${note.questionId}: ` : ''}${note.message}`)
    lines.push('')
  }
  return lines.join('\n')
}
