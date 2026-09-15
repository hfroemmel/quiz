/**
 * An editorial sheet becomes questions.
 *
 * WHY AT ALL: Questions are not born in JSON. They are born in a sheet that
 * several people work on at the same time, with comments and colouring next
 * to it. This step is the bridge - and it is deliberately a ONE-WAY STREET:
 * the sheet is the source, `questions.json` the product. Whoever corrects the
 * product loses it on the next import.
 *
 * WHAT IS NOT HERE: the network. This file computes on a string so that it can
 * be tested without Google and without credentials; fetching is done by the
 * CLI.
 *
 * THE COLUMN MAPPING IS CONFIGURATION, not code. Every editorial team names
 * its columns differently, and renaming a sheet is the worse solution
 * compared to placing a mapping file next to it.
 */
import { questionSchema, type Question } from '@hfroemmel/quiz-core'
import { csvToRows } from './csv'

/** Letters of the answer options - the same order as on stage. */
const OPTION_LETTERS = ['a', 'b', 'c', 'd', 'e', 'f'] as const

export interface SheetMapping {
  /**
   * Which column carries which field. If an entry is missing, the default
   * applies.
   *
   * `options` is a list: one column per answer option, in the order
   * A, B, C, D.
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
    /** The correct answer - as a letter (`B`), as a number (`2`) or as text. */
    correct?: string
    acceptedAnswerText?: string
    imageAssetId?: string
    videoAssetId?: string
    explanation?: string
    source?: string
    tags?: string
    enabled?: string
  }
  /** What applies where the sheet says nothing. */
  defaults?: {
    poolIds?: string[]
    audiences?: string[]
    locale?: string
    difficulty?: string
    questionType?: Question['questionType']
    tags?: string[]
  }
  /**
   * Translation of cell values to identifiers - one table per field.
   *
   * The sheet says "leicht", the schema says `easy`. Without this layer the
   * editors would have to type identifiers, and exactly that produces typos
   * that are only noticed when building.
   */
  values?: Partial<Record<'difficulty' | 'questionType' | 'categories' | 'pools' | 'audiences', Record<string, string>>>
}

export interface ImportFinding {
  questions: Question[]
  /** Rows that were not adopted - with row number and reason. */
  skippedRows: { row: number; reason: string }[]
  /** Column headers that were read, for debugging the mapping. */
  columns: string[]
}

/** The mapping a pool passes through without a file of its own. */
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
   * "Ämter & Recht" becomes "aemter-recht": identifiers may only carry a-z,
   * 0-9 and the three separators (see `idSchema`). Umlauts are spelled out
   * instead of removed - "Amter" would be a different term.
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
 * Which option is the correct one?
 *
 * Editorial teams write that down in three ways: as a letter, as a number or
 * by writing the answer once more. All three are read - rewriting a sheet
 * because the tool only knows one notation would be the wrong direction.
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
 * Translate a sheet into questions.
 *
 * A row that does not pass does NOT stop the import: it is reported with row
 * number and reason, and the rest passes through. Not getting a pool of two
 * hundred questions at all because of one half-finished row is the more
 * expensive answer for the editors - the report says what is missing.
 */
export function importSheet(csv: string, mapping: SheetMapping = defaultMapping): ImportFinding {
  const { columns, rows } = csvToRows(csv)
  const to = mapping.columns
  const preset = mapping.defaults ?? {}
  const values = mapping.values ?? {}

  const questions: Question[] = []
  const skippedRows: { row: number; reason: string }[] = []

  rows.forEach((row, index) => {
    // Row 1 is the header row; the first data row is row 2.
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
     * VALIDATION HAPPENS HERE, not only when building: a question that does
     * not hold the schema is an error of the sheet - and the row number is
     * the only thing the editors can find it with.
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
 * The CSV address of a Google sheet.
 *
 * Google serves every sheet as CSV, without API and without a key - sharing
 * as "anyone with the link" is enough. That is why this import works without
 * credentials.
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
