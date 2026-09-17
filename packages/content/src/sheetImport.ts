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
import { csvToRows, gridToRows } from './csv'

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
    /**
     * The question's picture and its licence line - two columns, one medium.
     *
     * A FILE NAME, NOT AN ASSET ID. The question carries its file itself
     * (`image: { filename, credit }`), so the editorial table names the file
     * and whose work it is, and nothing has to be declared a second time in
     * `assets.json`.
     */
    image?: string
    imageCredit?: string
    /** A clip that runs before the question - whatever type the question is. */
    video?: string
    videoCredit?: string
    explanation?: string
    source?: string
    tags?: string
    enabled?: string
  }
  /**
   * The answer that is always the right one, as a 1-based position.
   *
   * SOME TABLES DO NOT MARK THE ANSWER, THEY ORDER IT: the first option is the
   * correct one in every row, and the stage shuffles anyway. Stating that here
   * beats naming the answer column and matching its text - a question whose
   * answer is "B" or "2" reads as a letter or a position and lands on the
   * wrong option, which is a mistake no report shows because the row passes.
   *
   * It wins over `columns.correct` where both are given.
   */
  correctOption?: number
  /** What applies where the sheet says nothing. */
  defaults?: {
    poolIds?: string[]
    audiences?: string[]
    locale?: string
    difficulty?: string
    questionType?: Question['questionType']
    tags?: string[]
    /**
     * Directory in front of a file name from the table, e.g. `questions`.
     *
     * An editorial table names the file, not its place: `reichstag.jpg`, not
     * `questions/reichstag.jpg`. Where the media lie is a property of the
     * package, so it is stated once here instead of in every row.
     */
    imageDirectory?: string
    videoDirectory?: string
  }
  /**
   * Translation of cell values to identifiers - one table per field.
   *
   * The sheet says "leicht", the schema says `easy`. Without this layer the
   * editors would have to type identifiers, and exactly that produces typos
   * that are only noticed when building.
   */
  values?: Partial<Record<'difficulty' | 'questionType' | 'categories' | 'pools' | 'audiences', Record<string, string>>>
  /**
   * Further languages, as column groups of the same row.
   *
   * An editorial team that works in two languages writes them side by side:
   * `question` and `question_en`, `A` and `A_en`. The alternative is two
   * sheets, and then nothing says which German question the English one
   * belongs to - the pairing lives in the row, so it is read from the row.
   *
   * Only what a translation may change is named here. Everything that decides
   * the GAME - difficulty, pool, audience, type, which option is correct -
   * stays with the question itself: a translated row is the same question in
   * other words, not another question.
   *
   * A group whose cells are empty produces no translation. That is the normal
   * case at the edges of a corpus: not every question exists in both
   * languages, and a half-filled translation would show a German question with
   * English answers.
   */
  translations?: Record<
    string,
    {
      prompt?: string
      options?: string[]
      acceptedAnswerText?: string
      explanation?: string
      image?: string
      imageCredit?: string
      video?: string
      videoCredit?: string
    }
  >
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
    image: 'Bild',
    imageCredit: 'Bildnachweis',
    video: 'Video',
    videoCredit: 'Videonachweis',
    explanation: 'Erklärung',
    source: 'Quelle',
  },
  defaults: { poolIds: ['bundestag'], audiences: ['adults'], locale: 'de-DE', difficulty: 'medium' },
  values: {
    difficulty: { leicht: 'easy', mittel: 'medium', schwer: 'hard' },
    /*
     * THE TYPE IS THE PRESENTATION, AND NOTHING ELSE. `video` is deliberately
     * not in this table any more: a clip is a step in front of the question,
     * so it comes from the video COLUMN and leaves the type alone. A video in
     * front of a person question used to be unwritable.
     */
    questionType: {
      text: 'text-choice',
      multiple_choice: 'text-choice',
      bild: 'image-choice',
      person: 'person',
      image: 'image-reveal',
      bilderkennen: 'image-reveal',
    },
  },
}

/**
 * A medium from two cells: the file, and whose work it is.
 *
 * An empty file name means there is no medium - a credit without a file is an
 * editorial note about a picture nobody attached, and it would arrive as a
 * medium with an empty name that no build could copy.
 *
 * A missing credit, by contrast, IS taken over: the question keeps its
 * picture, and `uncreditedImages` reports the gap at the end of the import
 * where somebody can still close it.
 */
function medium(
  filename: string | undefined,
  credit: string | undefined,
  directory?: string,
): { filename: string; credit?: string } | undefined {
  const file = (filename ?? '').trim()
  if (file === '') return undefined
  const place = (directory ?? '').replace(/^\/+|\/+$/g, '')
  // A name that already carries its directory keeps it - the table wins.
  const path = place === '' || file.includes('/') ? file : `${place}/${file}`
  const line = (credit ?? '').trim()
  return { filename: path, ...(line === '' ? {} : { credit: line }) }
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
 * The further languages of one row.
 *
 * A group is only taken over where it says something. An empty group means
 * "this question does not exist in that language" - the normal case at the
 * edges of a corpus - and a group with only a prompt filled means the answers
 * are the ones of the base language, which is what a translation of a picture
 * question often is.
 *
 * Options are translated INDIVIDUALLY and by their id: a group that forgets
 * one leaves that one in the base language instead of dropping it, and the
 * option that is compared against can never go missing that way.
 */
function translationsOf(
  row: Record<string, string>,
  groups: SheetMapping['translations'],
): { translations: Record<string, Record<string, unknown>> } | undefined {
  if (!groups) return undefined
  const translations: Record<string, Record<string, unknown>> = {}

  for (const [locale, group] of Object.entries(groups)) {
    const at = (name: string | undefined): string => (name ? (row[name] ?? '').trim() : '')
    const prompt = at(group.prompt)
    const options = (group.options ?? [])
      .map((name, position) => ({ id: OPTION_LETTERS[position] ?? `o${position + 1}`, text: at(name) }))
      .filter((option) => option.text !== '')
    const expected = at(group.acceptedAnswerText)
      .split(/\r?\n|;/)
      .map((entry) => entry.trim())
      .filter((entry) => entry !== '')
    const explanation = at(group.explanation)
    const image = medium(at(group.image), at(group.imageCredit))
    const film = medium(at(group.video), at(group.videoCredit))

    const entry = {
      ...(prompt ? { prompt } : {}),
      ...(options.length > 0 ? { options } : {}),
      ...(expected.length > 0 ? { acceptedAnswerText: expected } : {}),
      ...(explanation ? { explanation: { summary: explanation } } : {}),
      ...(image ? { image } : {}),
      ...(film ? { video: film } : {}),
    }
    if (Object.keys(entry).length > 0) translations[locale] = entry
  }

  return Object.keys(translations).length > 0 ? { translations } : undefined
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
  return importRows(csvToRows(csv), mapping)
}

/**
 * The same import from a workbook's grid - see `readWorkbook`.
 *
 * A sheet in a file and a sheet exported as CSV are the same table; only the
 * way in differs, and it ends here.
 */
export function importGrid(grid: string[][], mapping: SheetMapping = defaultMapping): ImportFinding {
  return importRows(gridToRows(grid), mapping)
}

function importRows(
  { columns, rows }: { columns: string[]; rows: Record<string, string>[] },
  mapping: SheetMapping,
): ImportFinding {
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

    const fixedCorrect = mapping.correctOption
    const correctOptionId =
      options.length < 2
        ? undefined
        : fixedCorrect !== undefined
          ? options[fixedCorrect - 1]?.id
          : findCorrect(cell(to.correct) ?? '', options)
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

    const image = medium(cell(to.image), cell(to.imageCredit), preset.imageDirectory)
    const film = medium(cell(to.video), cell(to.videoCredit), preset.videoDirectory)
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
      ...(image ? { image } : {}),
      ...(film ? { video: film } : {}),
      ...(explanation || source
        ? { explanation: { ...(explanation ? { summary: explanation } : {}), ...(source ? { source: source } : {}) } }
        : {}),
      ...(translationsOf(row, mapping.translations) ?? {}),
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
