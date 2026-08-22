/**
 * Strenge Inhaltsvalidierung (Spezifikation 24.4 und 17.5).
 *
 * Zwei Stufen:
 *  - `error`   -> der Build muss abbrechen. Diese Faelle wuerden die Show gefaehrden.
 *  - `warning` -> bewusste redaktionelle Freigabe noetig, der Build laeuft weiter.
 *
 * Ein Auswahlalgorithmus kann einen unzureichenden Pool nicht kaschieren. Deshalb
 * berechnet die Validierung zusaetzlich pro Modus, Preset und Fragenplatz, wie viele
 * Kandidaten es gibt und wie viele Spiele ohne Wiederholung moeglich sind.
 */
import {
  contentThresholds,
  isSelfServicePreset,
  missingColorTokens,
  questionSchema,
  quizConfigSchema,
  type MediaAsset,
  type Question,
  type QuizConfig,
} from '@quiz/contracts'
import { matchesSlot, poolForMode, repetitionKey } from '@quiz/domain'

export type IssueSeverity = 'error' | 'warning'

export interface ValidationIssue {
  severity: IssueSeverity
  code: string
  message: string
  /** Frage-ID bzw. Zeilenbezug, damit die Redaktion die Stelle findet. */
  subject?: string
}

export interface SlotCoverage {
  modeId: string
  presetId: string
  slotIndex: number
  slotId: string
  candidateCount: number
  repetitionGroupCount: number
  /** Fragenplaetze desselben Presets, die um denselben Pool konkurrieren. */
  competingSlotIds: string[]
}

export interface PresetCoverage {
  modeId: string
  presetId: string
  slots: SlotCoverage[]
  /** Wie viele Spiele sind ohne Wiederholung moeglich? Minimum ueber alle Poolgruppen. */
  gamesWithoutRepetition: number
  /**
   * Taugt dieses Preset fuer das Touchgeraet? Nur dann, wenn jeder Fragenplatz
   * ausschliesslich Fragen zulaesst, die ohne Operator auswertbar sind.
   */
  selfServiceCapable: boolean
}

export interface ContentStatistics {
  totalQuestions: number
  enabledQuestions: number
  byMode: Record<string, number>
  byDifficulty: Record<string, number>
  byPresentationType: Record<string, number>
  byCategory: Record<string, number>
  repetitionGroups: number
  mediaAssets: number
}

export interface ValidationResult {
  issues: ValidationIssue[]
  errors: ValidationIssue[]
  warnings: ValidationIssue[]
  statistics: ContentStatistics
  coverage: PresetCoverage[]
  ok: boolean
}

export interface ValidationInput {
  config: unknown
  questions: unknown
  assets: MediaAsset[]
  /** Existiert die Datei des Assets? Wird vom CLI mit dem Dateisystem verbunden. */
  assetFileExists: (asset: MediaAsset) => boolean
  contentVersion?: string
  /**
   * Waehrend der Entwicklung liegt der freigegebene Bildbestand noch nicht vor.
   * Mit `'warning'` blockiert eine fehlende Mediendatei den Build nicht; der
   * Server zeigt an ihrer Stelle ein erzeugtes Ersatzbild.
   *
   * Fuer den Livebetrieb bleibt der Standardwert `'error'` verbindlich: Eine
   * Frage ohne Bild ist auf der Buehne unspielbar.
   */
  missingMediaSeverity?: IssueSeverity
}

export function validateContent(input: ValidationInput): ValidationResult {
  const issues: ValidationIssue[] = []
  const add = (severity: IssueSeverity, code: string, message: string, subject?: string) =>
    issues.push({ severity, code, message, subject })

  /* -------- Schemapruefung -------- */

  const configResult = quizConfigSchema.safeParse(input.config)
  if (!configResult.success) {
    for (const issue of configResult.error.issues) {
      add('error', 'config-schema', `Konfiguration ungueltig bei "${issue.path.join('.')}": ${issue.message}`)
    }
    return finish(issues, emptyStatistics(), [])
  }
  const config = configResult.data

  if (!Array.isArray(input.questions)) {
    add('error', 'questions-schema', 'Die Fragendatei enthaelt kein Array.')
    return finish(issues, emptyStatistics(), [])
  }

  const questions: Question[] = []
  input.questions.forEach((raw, index) => {
    const parsed = questionSchema.safeParse(raw)
    if (!parsed.success) {
      const id = typeof (raw as { id?: unknown })?.id === 'string' ? (raw as { id: string }).id : `Index ${index}`
      for (const issue of parsed.error.issues) {
        add('error', 'question-schema', `Feld "${issue.path.join('.')}": ${issue.message}`, id)
      }
      return
    }
    questions.push(parsed.data)
  })

  if (input.contentVersion !== undefined && !/^\d+\.\d+\.\d+(?:[-+].+)?$/.test(input.contentVersion)) {
    add('error', 'version-unparsable', `Inhaltsversion "${input.contentVersion}" ist keine gueltige Versionsangabe.`)
  }

  /* -------- Referenzen und Pflichtfelder -------- */

  const knownDifficulties = new Set(config.difficulties.map((entry) => entry.id))
  const knownCategories = new Set(config.categories.map((entry) => entry.id))
  const knownModes = new Set(config.modes.map((entry) => entry.id))
  const knownThemes = new Set(config.themes.map((entry) => entry.id))
  const knownPresets = new Set(config.presets.map((entry) => entry.id))
  const assetsById = new Map(input.assets.map((asset) => [asset.id, asset]))

  for (const mode of config.modes) {
    if (!knownThemes.has(mode.themeId)) {
      add('error', 'theme-reference', `Modus "${mode.id}" verweist auf unbekanntes Theme "${mode.themeId}".`, mode.id)
    }
    for (const presetId of mode.allowedPresetIds) {
      if (!knownPresets.has(presetId)) {
        add('error', 'preset-reference', `Modus "${mode.id}" erlaubt unbekanntes Preset "${presetId}".`, mode.id)
      }
    }
    if (mode.startVisualAssetId && !assetsById.has(mode.startVisualAssetId)) {
      add('error', 'asset-reference', `Startgrafik "${mode.startVisualAssetId}" von Modus "${mode.id}" fehlt.`, mode.id)
    }
  }
  for (const theme of config.themes) {
    const missingTokens = missingColorTokens(theme.colors)
    if (missingTokens.length) {
      add(
        'error',
        'theme-tokens',
        `Theme "${theme.id}" fehlen Farbtoken: ${missingTokens.join(', ')}. Ein unvollstaendiges Theme ergaebe farblose Flaechen auf der Buehne.`,
        theme.id,
      )
    }
    if (theme.logoAssetId && !assetsById.has(theme.logoAssetId)) {
      add('error', 'asset-reference', `Logo "${theme.logoAssetId}" von Theme "${theme.id}" fehlt.`, theme.id)
    }
  }
  for (const preset of config.presets) {
    if (preset.slots.length !== config.questionsPerGame) {
      add(
        'error',
        'preset-slot-count',
        `Preset "${preset.id}" hat ${preset.slots.length} Fragenplaetze, konfiguriert sind ${config.questionsPerGame}.`,
        preset.id,
      )
    }
    for (const slot of preset.slots) {
      for (const difficultyId of slot.filters.difficultyIds ?? []) {
        if (!knownDifficulties.has(difficultyId)) {
          add('error', 'difficulty-reference', `Fragenplatz "${slot.id}" filtert auf unbekannte Schwierigkeit "${difficultyId}".`, preset.id)
        }
      }
      for (const categoryId of slot.filters.categoryIds ?? []) {
        if (!knownCategories.has(categoryId)) {
          add('error', 'category-reference', `Fragenplatz "${slot.id}" filtert auf unbekannte Kategorie "${categoryId}".`, preset.id)
        }
      }
    }
  }

  const seenIds = new Set<string>()
  for (const question of questions) {
    if (seenIds.has(question.id)) {
      add('error', 'duplicate-question-id', `Die Frage-ID "${question.id}" kommt mehrfach vor.`, question.id)
    }
    seenIds.add(question.id)

    if (!knownDifficulties.has(question.difficultyId)) {
      add('error', 'difficulty-reference', `Unbekannte Schwierigkeit "${question.difficultyId}".`, question.id)
    }
    for (const categoryId of question.categoryIds) {
      if (!knownCategories.has(categoryId)) {
        add('error', 'category-reference', `Unbekannte Kategorie "${categoryId}".`, question.id)
      }
    }
    for (const modeId of question.modeIds) {
      if (!knownModes.has(modeId)) {
        add('error', 'mode-reference', `Unbekannter Quizmodus "${modeId}".`, question.id)
      }
    }

    validateAnswerModel(question, add)
    validateMedia(question, assetsById, input.assetFileExists, input.missingMediaSeverity ?? 'error', add)
    validateEditorialWarnings(question, assetsById, add)

    if (question.id !== question.id.toLowerCase()) {
      add('warning', 'id-casing', `Die ID "${question.id}" enthaelt Grossbuchstaben.`, question.id)
    }
  }

  /* -------- Duplikaterkennung ohne gemeinsame Wiederholungsgruppe -------- */

  const byNormalizedPrompt = new Map<string, Question[]>()
  for (const question of questions) {
    const key = normalizeText(question.prompt)
    const bucket = byNormalizedPrompt.get(key) ?? []
    bucket.push(question)
    byNormalizedPrompt.set(key, bucket)
  }
  for (const [, bucket] of byNormalizedPrompt) {
    if (bucket.length < 2) continue
    const groups = new Set(bucket.map(repetitionKey))
    if (groups.size > 1) {
      add(
        'warning',
        'similar-without-group',
        `Fast identischer Fragetext ohne gemeinsame Wiederholungsgruppe: ${bucket.map((q) => q.id).join(', ')}.`,
        bucket[0]!.id,
      )
    }
  }

  /* -------- Erreichbarkeit, Poolabdeckung, verwaiste Medien -------- */

  const coverage = analyseCoverage(config, questions, add)

  const reachable = new Set<string>()
  for (const mode of config.modes) {
    const pool = poolForMode(questions, mode)
    for (const presetId of mode.allowedPresetIds) {
      const preset = config.presets.find((entry) => entry.id === presetId)
      if (!preset) continue
      for (const slot of preset.slots) {
        for (const question of pool) {
          if (matchesSlot(question, slot)) reachable.add(question.id)
        }
      }
    }
  }
  for (const question of questions) {
    if (question.enabled && !reachable.has(question.id)) {
      add('warning', 'unreachable-question', 'Die Frage ist ueber keinen Modus und kein Preset erreichbar.', question.id)
    }
  }

  const usedAssetIds = new Set<string>()
  for (const question of questions) {
    if (question.media?.imageAssetId) usedAssetIds.add(question.media.imageAssetId)
    if (question.media?.videoAssetId) usedAssetIds.add(question.media.videoAssetId)
  }
  for (const theme of config.themes) if (theme.logoAssetId) usedAssetIds.add(theme.logoAssetId)
  for (const mode of config.modes) if (mode.startVisualAssetId) usedAssetIds.add(mode.startVisualAssetId)
  for (const asset of input.assets) {
    if (!usedAssetIds.has(asset.id)) {
      add('warning', 'orphan-asset', `Das Medium "${asset.id}" (${asset.filename}) wird nirgends verwendet.`, asset.id)
    }
  }

  const usedCategories = new Set(questions.flatMap((question) => question.categoryIds))
  for (const category of config.categories) {
    if (!usedCategories.has(category.id)) {
      add('warning', 'unused-category', `Die Kategorie "${category.id}" wird von keiner Frage verwendet.`, category.id)
    }
  }

  return finish(issues, buildStatistics(questions, input.assets), coverage)
}

/* ------------------------------------------------------------------ *
 * Teilpruefungen
 * ------------------------------------------------------------------ */

type AddIssue = (severity: IssueSeverity, code: string, message: string, subject?: string) => void

function validateAnswerModel(question: Question, add: AddIssue): void {
  const options = question.options ?? []
  const needsExactlyFour =
    question.presentationType === 'text-choice' || question.presentationType === 'image-choice'

  /*
   * Eine deaktivierte Frage liegt in keinem Fragenpool und kann die Show nicht
   * gefaehrden. Sie darf deshalb als unfertige Vorlage im Bestand liegen - genau
   * wie ein vorbereitetes Medium ohne Datei. Der Mangel wird gemeldet, blockiert
   * aber den Build nicht.
   */
  const structural: IssueSeverity = question.enabled ? 'error' : 'warning'
  const draftHint = question.enabled ? '' : ' Die Frage ist deaktiviert und wird nicht gespielt.'

  if (question.evaluationMode === 'option-comparison') {
    if (options.length === 0) {
      add(structural, 'missing-options', `Automatische Auswertung ohne Antwortoptionen.${draftHint}`, question.id)
    }
    if (!question.correctOptionId) {
      // Die Legacy-Annahme "option_1 ist richtig" gilt nicht mehr.
      add(structural, 'missing-correct-option', `Multiple Choice ohne explizite richtige Option.${draftHint}`, question.id)
    } else if (!options.some((option) => option.id === question.correctOptionId)) {
      add(
        structural,
        'correct-option-unknown',
        `"correctOptionId" verweist auf "${question.correctOptionId}", diese Option existiert nicht.${draftHint}`,
        question.id,
      )
    }
  } else if (!question.acceptedAnswerText?.length && !question.correctOptionId) {
    add(
      structural,
      'missing-answer',
      `Manuelle Bewertung ohne hinterlegte richtige Antwort - die Loesungsansicht waere leer.${draftHint}`,
      question.id,
    )
  }

  if (needsExactlyFour && options.length !== contentThresholds.requiredChoiceOptionCount) {
    add(
      structural,
      'option-count',
      `Fragetyp "${question.presentationType}" verlangt genau ${contentThresholds.requiredChoiceOptionCount} Optionen, gefunden: ${options.length}.${draftHint}`,
      question.id,
    )
  }

  const optionIds = new Set<string>()
  const optionTexts = new Set<string>()
  for (const option of options) {
    if (optionIds.has(option.id)) {
      add('error', 'duplicate-option-id', `Die Options-ID "${option.id}" kommt mehrfach vor.`, question.id)
    }
    optionIds.add(option.id)
    const normalized = normalizeText(option.text)
    if (optionTexts.has(normalized)) {
      add('warning', 'duplicate-option-text', `Zwei Antwortoptionen sind identisch: "${option.text}".`, question.id)
    }
    optionTexts.add(normalized)
  }
}

function validateMedia(
  question: Question,
  assetsById: Map<string, MediaAsset>,
  assetFileExists: (asset: MediaAsset) => boolean,
  missingMediaSeverity: IssueSeverity,
  add: AddIssue,
): void {
  const requiresImage =
    question.presentationType === 'image-choice' || question.presentationType === 'image-reveal'
  const requiresVideo = question.presentationType === 'video-then-question'

  const check = (assetId: string | undefined, kind: 'image' | 'video', required: boolean) => {
    if (!assetId) {
      if (required) {
        add('error', 'missing-media', `Fragetyp "${question.presentationType}" verlangt ein Medium (${kind}).`, question.id)
      }
      return
    }
    const asset = assetsById.get(assetId)
    if (!asset) {
      add('error', 'asset-reference', `Unbekanntes Medium "${assetId}".`, question.id)
      return
    }
    if (asset.kind !== kind) {
      add('error', 'asset-kind', `Medium "${assetId}" ist vom Typ "${asset.kind}", erwartet wurde "${kind}".`, question.id)
    }
    if (!assetFileExists(asset)) {
      // Eine deaktivierte Frage ist in keinem Pool und kann die Show nicht gefaehrden.
      // Sie darf deshalb als vorbereitete Vorlage ohne Mediendatei im Bestand liegen.
      if (question.enabled) {
        add(
          missingMediaSeverity,
          'asset-file-missing',
          missingMediaSeverity === 'error'
            ? `Mediendatei "${asset.filename}" existiert nicht.`
            : `Mediendatei "${asset.filename}" fehlt. Es wird ein Ersatzbild gezeigt.`,
          question.id,
        )
      } else {
        add(
          'warning',
          'asset-file-missing-disabled',
          `Mediendatei "${asset.filename}" fehlt. Die Frage ist deaktiviert und wird nicht gespielt.`,
          question.id,
        )
      }
    }
  }

  check(question.media?.imageAssetId, 'image', requiresImage)
  check(question.media?.videoAssetId, 'video', requiresVideo)
}

function validateEditorialWarnings(question: Question, assetsById: Map<string, MediaAsset>, add: AddIssue): void {
  if (!question.explanation?.summary && !question.explanation?.details) {
    add('warning', 'missing-explanation', 'Kein Erklaerungstext hinterlegt.', question.id)
  }
  const imageId = question.media?.imageAssetId
  if (imageId) {
    const asset = assetsById.get(imageId)
    if (asset && !asset.credit) {
      add('warning', 'missing-credit', `Kein Bildnachweis fuer "${imageId}".`, question.id)
    }
  }
  if (question.prompt.length > contentThresholds.longPromptChars) {
    add('warning', 'long-prompt', `Sehr langer Fragetext (${question.prompt.length} Zeichen).`, question.id)
  }
  for (const option of question.options ?? []) {
    if (option.text.length > contentThresholds.longOptionChars) {
      add('warning', 'long-option', `Sehr langer Antworttext (${option.text.length} Zeichen).`, question.id)
    }
  }
}

/**
 * Poolabdeckung pro Modus, Preset und Fragenplatz.
 *
 * "Spiele ohne Wiederholung" wird konservativ geschaetzt: Fragenplaetze mit
 * identischem Filter konkurrieren um denselben Pool. Fuer eine solche Gruppe aus
 * `k` Plaetzen und `g` eindeutigen Wiederholungsgruppen sind `floor(g / k)` Spiele
 * moeglich; massgeblich ist das Minimum ueber alle Gruppen.
 */
function analyseCoverage(config: QuizConfig, questions: Question[], add: AddIssue): PresetCoverage[] {
  const coverage: PresetCoverage[] = []

  for (const mode of config.modes) {
    const pool = poolForMode(questions, mode)
    for (const presetId of mode.allowedPresetIds) {
      const preset = config.presets.find((entry) => entry.id === presetId)
      if (!preset) continue

      // Fragenplaetze mit identischem Filter teilen sich einen Pool.
      const signatureToSlotIds = new Map<string, string[]>()
      for (const slot of preset.slots) {
        const signature = JSON.stringify(slot.filters)
        signatureToSlotIds.set(signature, [...(signatureToSlotIds.get(signature) ?? []), slot.id])
      }

      const slots: SlotCoverage[] = preset.slots.map((slot, slotIndex) => {
        const candidates = pool.filter((question) => matchesSlot(question, slot))
        const groups = new Set(candidates.map(repetitionKey))
        const signature = JSON.stringify(slot.filters)
        const competing = (signatureToSlotIds.get(signature) ?? []).filter((id) => id !== slot.id)

        if (candidates.length === 0) {
          // Nicht erfuellbarer Fragenplatz ist ein harter Fehler.
          add(
            'error',
            'slot-unsatisfiable',
            `Modus "${mode.id}" / Preset "${preset.id}": Fragenplatz ${slotIndex + 1} ("${slot.id}") hat keinen einzigen Kandidaten.`,
            `${mode.id}/${preset.id}/${slot.id}`,
          )
        } else if (candidates.length < contentThresholds.smallPoolWarning) {
          add(
            'warning',
            'small-pool',
            `Modus "${mode.id}" / Preset "${preset.id}": Fragenplatz ${slotIndex + 1} ("${slot.id}") hat nur ${candidates.length} Kandidaten.`,
            `${mode.id}/${preset.id}/${slot.id}`,
          )
        }

        return {
          modeId: mode.id,
          presetId: preset.id,
          slotIndex,
          slotId: slot.id,
          candidateCount: candidates.length,
          repetitionGroupCount: groups.size,
          competingSlotIds: competing,
        }
      })

      let gamesWithoutRepetition = Number.POSITIVE_INFINITY
      for (const [signature, slotIds] of signatureToSlotIds) {
        const filters = JSON.parse(signature) as (typeof preset.slots)[number]['filters']
        const candidates = pool.filter((question) => matchesSlot(question, { id: 'tmp', filters }))
        const groups = new Set(candidates.map(repetitionKey)).size
        gamesWithoutRepetition = Math.min(gamesWithoutRepetition, Math.floor(groups / slotIds.length))
      }
      if (!Number.isFinite(gamesWithoutRepetition)) gamesWithoutRepetition = 0

      if (gamesWithoutRepetition < contentThresholds.minGamesWithoutRepetition) {
        add(
          'warning',
          'few-games-without-repetition',
          `Modus "${mode.id}" / Preset "${preset.id}": nur ${gamesWithoutRepetition} Spiele ohne Wiederholung moeglich.`,
          `${mode.id}/${preset.id}`,
        )
      }

      coverage.push({
        modeId: mode.id,
        presetId: preset.id,
        slots,
        gamesWithoutRepetition,
        selfServiceCapable: isSelfServicePreset(preset),
      })
    }
  }

  return coverage
}

/* ------------------------------------------------------------------ *
 * Hilfsmittel
 * ------------------------------------------------------------------ */

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[\s]+/g, ' ')
    .replace(/[.,;:!?"'`´()\[\]-]/g, '')
    .trim()
}

function buildStatistics(questions: Question[], assets: MediaAsset[]): ContentStatistics {
  const count = (values: string[]) => {
    const result: Record<string, number> = {}
    for (const value of values) result[value] = (result[value] ?? 0) + 1
    return result
  }
  return {
    totalQuestions: questions.length,
    enabledQuestions: questions.filter((question) => question.enabled).length,
    byMode: count(questions.flatMap((question) => question.modeIds)),
    byDifficulty: count(questions.map((question) => question.difficultyId)),
    byPresentationType: count(questions.map((question) => question.presentationType)),
    byCategory: count(questions.flatMap((question) => question.categoryIds)),
    repetitionGroups: new Set(questions.map(repetitionKey)).size,
    mediaAssets: assets.length,
  }
}

function emptyStatistics(): ContentStatistics {
  return {
    totalQuestions: 0,
    enabledQuestions: 0,
    byMode: {},
    byDifficulty: {},
    byPresentationType: {},
    byCategory: {},
    repetitionGroups: 0,
    mediaAssets: 0,
  }
}

function finish(issues: ValidationIssue[], statistics: ContentStatistics, coverage: PresetCoverage[]): ValidationResult {
  const errors = issues.filter((issue) => issue.severity === 'error')
  const warnings = issues.filter((issue) => issue.severity === 'warning')
  return { issues, errors, warnings, statistics, coverage, ok: errors.length === 0 }
}
