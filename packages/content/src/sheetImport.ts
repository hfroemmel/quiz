/**
 * Aus einer Redaktionstabelle werden Fragen.
 *
 * WARUM UEBERHAUPT: Fragen entstehen nicht in JSON. Sie entstehen in einer
 * Tabelle, an der mehrere Leute gleichzeitig sitzen, mit Kommentaren und
 * Faerbungen daneben. Dieser Schritt ist die Bruecke - und er ist bewusst eine
 * EINBAHNSTRASSE: Die Tabelle ist die Quelle, `questions.json` das Erzeugnis.
 * Wer im Erzeugnis korrigiert, verliert es beim naechsten Import.
 *
 * WAS HIER NICHT STEHT: das Netz. Diese Datei rechnet auf einer Zeichenkette,
 * damit sie ohne Google und ohne Zugangsdaten pruefbar ist; das Holen macht das
 * CLI.
 *
 * DIE ZUORDNUNG DER SPALTEN IST KONFIGURATION, kein Code. Jede Redaktion nennt
 * ihre Spalten anders, und eine Tabelle umzubenennen ist die schlechtere
 * Loesung als eine Zuordnungsdatei danebenzulegen.
 */
import { questionSchema, type Question } from '@hfroemmel/quiz-core'
import { csvToRows } from './csv'

/** Buchstaben der Antwortoptionen - dieselbe Ordnung wie auf der Buehne. */
const OPTION_LETTERS = ['a', 'b', 'c', 'd', 'e', 'f'] as const

export interface SheetMapping {
  /**
   * Welche Spalte traegt welches Feld. Fehlt ein Eintrag, greift die Vorgabe.
   *
   * `options` ist eine Liste: eine Spalte je Antwortmoeglichkeit, in der
   * Reihenfolge A, B, C, D.
   */
  columns: {
    id?: string
    prompt?: string
    difficulty?: string
    categories?: string
    pools?: string
    audiences?: string
    locale?: string
    questionType?: string
    options?: string[]
    /** Die richtige Antwort - als Buchstabe (`B`), als Nummer (`2`) oder als Text. */
    correct?: string
    acceptedAnswerText?: string
    imageAssetId?: string
    videoAssetId?: string
    explanation?: string
    source?: string
    tags?: string
    enabled?: string
  }
  /** Was gilt, wo die Tabelle nichts sagt. */
  defaults?: {
    poolIds?: string[]
    audiences?: string[]
    locale?: string
    difficulty?: string
    questionType?: Question['questionType']
    tags?: string[]
  }
  /**
   * Uebersetzung von Zellwerten auf Bezeichner - je Feld eine Tabelle.
   *
   * In der Tabelle steht "leicht", im Schema steht `easy`. Ohne diese Ebene
   * muesste die Redaktion Bezeichner tippen, und genau das erzeugt Tippfehler,
   * die erst beim Bauen auffallen.
   */
  values?: Partial<Record<'difficulty' | 'questionType' | 'categories' | 'pools' | 'audiences', Record<string, string>>>
}

export interface ImportFinding {
  questions: Question[]
  /** Zeilen, die nicht uebernommen wurden - mit Zeilennummer und Grund. */
  skippedRows: { row: number; reason: string }[]
  /** Gelesene Spaltenueberschriften, fuer die Fehlersuche an der Zuordnung. */
  columns: string[]
}

/** Die Zuordnung, mit der ein Bestand ohne eigene Datei durchlaeuft. */
export const defaultMapping: SheetMapping = {
  columns: {
    id: 'ID',
    prompt: 'Frage',
    difficulty: 'Schwierigkeit',
    categories: 'Kategorie',
    audiences: 'Zielgruppe',
    questionType: 'Typ',
    options: ['A', 'B', 'C', 'D'],
    correct: 'Richtig',
    acceptedAnswerText: 'Antwort',
    imageAssetId: 'Bild',
    videoAssetId: 'Video',
    explanation: 'Erklärung',
    source: 'Quelle',
  },
  defaults: { poolIds: ['bundestag'], audiences: ['adults'], locale: 'de-DE', difficulty: 'medium' },
  values: {
    difficulty: { leicht: 'easy', mittel: 'medium', schwer: 'hard' },
    questionType: {
      text: 'text-choice',
      bild: 'image-choice',
      person: 'person',
      bilderkennen: 'image-reveal',
      video: 'video-then-question',
    },
  },
}

function identifier(value: string): string {
  /*
   * Aus "Ämter & Recht" wird "aemter-recht": Bezeichner duerfen nur a-z, 0-9
   * und die drei Trennzeichen tragen (siehe `idSchema`). Umlaute werden
   * ausgeschrieben statt entfernt - "Amter" waere ein anderer Begriff.
   */
  return value
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function list(value: string | undefined, translation?: Record<string, string>): string[] {
  if (!value) return []
  return value
    .split(/[,;/]/)
    .map((entry) => entry.trim())
    .filter((entry) => entry !== '')
    .map((entry) => translation?.[entry.toLowerCase()] ?? identifier(entry))
}

function yesNo(value: string | undefined): boolean | undefined {
  if (value === undefined || value.trim() === '') return undefined
  return !['nein', 'no', 'false', '0', 'inaktiv'].includes(value.trim().toLowerCase())
}

/**
 * Welche Option ist die richtige?
 *
 * Redaktionen schreiben das auf drei Arten auf: als Buchstabe, als Nummer oder
 * indem sie die Antwort noch einmal hinschreiben. Alle drei werden gelesen -
 * eine Tabelle umzuschreiben, weil das Werkzeug nur eine Schreibweise kennt,
 * waere die falsche Richtung.
 */
function findCorrect(value: string, options: { id: string; text: string }[]): string | undefined {
  const wanted = value.trim()
  if (wanted === '') return undefined

  const asLetter = wanted.toLowerCase().replace(/[^a-z]/g, '')
  if (asLetter.length === 1 && options.some((option) => option.id === asLetter)) return asLetter

  const asNumber = Number(wanted)
  if (Number.isInteger(asNumber) && asNumber >= 1 && asNumber <= options.length) {
    return options[asNumber - 1]!.id
  }

  const asText = options.find((option) => option.text.trim().toLowerCase() === wanted.toLowerCase())
  return asText?.id
}

/**
 * Tabelle in Fragen uebersetzen.
 *
 * Eine Zeile, die nicht durchgeht, hält den Import NICHT an: Sie wird mit
 * Zeilennummer und Grund gemeldet, und der Rest laeuft durch. Ein Bestand von
 * zweihundert Fragen wegen einer halbfertigen Zeile gar nicht zu bekommen, ist
 * in der Redaktion die teurere Antwort - der Bericht sagt, was fehlt.
 */
export function importSheet(csv: string, mapping: SheetMapping = defaultMapping): ImportFinding {
  const { columns, rows } = csvToRows(csv)
  const to = mapping.columns
  const preset = mapping.defaults ?? {}
  const values = mapping.values ?? {}

  const questions: Question[] = []
  const skippedRows: { row: number; reason: string }[] = []

  rows.forEach((row, index) => {
    // Zeile 1 ist die Kopfzeile; die erste Datenzeile ist Zeile 2.
    const rowNumber = index + 2
    const cell = (name: string | undefined): string | undefined => (name ? row[name] : undefined)

    const prompt = cell(to.prompt)?.trim()
    if (!prompt) {
      skippedRows.push({ row: rowNumber, reason: 'Keine Frage in der Fragespalte.' })
      return
    }

    const options = (to.options ?? [])
      .map((name, position) => ({ id: OPTION_LETTERS[position] ?? `o${position + 1}`, text: (row[name] ?? '').trim() }))
      .filter((option) => option.text !== '')

    const questionType =
      (values.questionType?.[(cell(to.questionType) ?? '').toLowerCase()] as Question['questionType'] | undefined) ??
      (cell(to.questionType)?.trim() as Question['questionType'] | undefined) ??
      preset.questionType ??
      (options.length >= 2 ? 'text-choice' : 'image-reveal')

    const correctOptionId = options.length >= 2 ? findCorrect(cell(to.correct) ?? '', options) : undefined
    if (options.length >= 2 && !correctOptionId) {
      skippedRows.push({ row: rowNumber, reason: 'Die richtige Antwort ist nicht zuzuordnen.' })
      return
    }

    const categories = list(cell(to.categories), values.categories)
    const pools = list(cell(to.pools), values.pools)
    const audiences = list(cell(to.audiences), values.audiences)
    const expected = (cell(to.acceptedAnswerText) ?? '')
      .split(/\r?\n|;/)
      .map((entry) => entry.trim())
      .filter((entry) => entry !== '')

    const image = cell(to.imageAssetId)?.trim()
    const film = cell(to.videoAssetId)?.trim()
    const explanation = cell(to.explanation)?.trim()
    const source = cell(to.source)?.trim()

    const raw = {
      id: identifier(cell(to.id)?.trim() || `frage-${rowNumber}`),
      poolIds: pools.length > 0 ? pools : (preset.poolIds ?? ['default']),
      audiences: audiences.length > 0 ? audiences : (preset.audiences ?? ['adults']),
      difficulty:
        values.difficulty?.[(cell(to.difficulty) ?? '').toLowerCase()] ??
        (cell(to.difficulty) ? identifier(cell(to.difficulty)!) : undefined) ??
        preset.difficulty ??
        'medium',
      categories: categories,
      tags: list(cell(to.tags)).concat(preset.tags ?? []),
      locale: cell(to.locale)?.trim() || preset.locale || 'de-DE',
      prompt,
      questionType,
      evaluationMode: correctOptionId ? ('option-comparison' as const) : ('manual-correct-incorrect' as const),
      ...(options.length >= 2 ? { options: options, correctOptionId } : {}),
      ...(expected.length > 0 ? { acceptedAnswerText: expected } : {}),
      ...(image || film
        ? { media: { ...(image ? { imageAssetId: image } : {}), ...(film ? { videoAssetId: film } : {}) } }
        : {}),
      ...(explanation || source
        ? { explanation: { ...(explanation ? { summary: explanation } : {}), ...(source ? { source: source } : {}) } }
        : {}),
      enabled: yesNo(cell(to.enabled)) ?? true,
    }

    /*
     * GEPRUEFT WIRD HIER, nicht erst beim Bauen: Eine Frage, die das Schema
     * nicht haelt, ist ein Fehler der Tabelle - und die Zeilennummer ist das
     * Einzige, womit die Redaktion ihn findet.
     */
    const checked = questionSchema.safeParse(raw)
    if (!checked.success) {
      const reasons = checked.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ')
      skippedRows.push({ row: rowNumber, reason: reasons })
      return
    }
    questions.push(checked.data)
  })

  return { questions, skippedRows, columns }
}

/**
 * Die CSV-Adresse einer Google-Tabelle.
 *
 * Google liefert jede Tabelle als CSV aus, ohne API und ohne Schluessel - eine
 * Freigabe "Jeder mit dem Link" genuegt. Das ist der Grund, warum dieser Import
 * ohne Zugangsdaten auskommt.
 */
export function csvUrl(sheet: string): string {
  const id = /\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/.exec(sheet)?.[1] ?? sheet
  const gid = /[#&?]gid=([0-9]+)/.exec(sheet)?.[1]
  const address = `https://docs.google.com/spreadsheets/d/${id}/export?format=csv`
  return gid ? `${address}&gid=${gid}` : address
}

/* Former names, kept for one release so that hosts can migrate. */
/** @deprecated Renamed to `ImportFinding`. */
export type ImportBefund = ImportFinding
/** @deprecated Renamed to `defaultMapping`. */
export const standardMapping = defaultMapping
/** @deprecated Renamed to `importSheet`. */
export const importiereTabelle = importSheet
