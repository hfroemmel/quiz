/**
 * Question selection and repetition avoidance (specification 17).
 *
 * DRY rule: question filters and repetition logic exist exclusively here. The
 * function is pure and has randomness injected, so that tests with a fixed seed
 * are reproducible.
 *
 * Why a "freshness class" instead of "always the oldest question"?
 * A purely deterministic selection feels rigid and predictable in live
 * operation. So first the oldest class still available is determined and a
 * random pick is made inside it - lightly weighted in favour of older
 * questions.
 *
 * Example: 25 matching candidates, all played once already.
 *   windowSize = max(3, ceil(25 * 0.2)) = 5
 *   -> the dice roll among the 5 questions unplayed for the longest time,
 *      where the oldest is about twice as likely as the fifth.
 */
import {
  selectionTuning,
  type Question,
  type QuestionSlotRule,
} from '../contracts'

/** Randomness source: injectable so that tests run deterministically. */
export type Rng = () => number

/** Creates a reproducible random generator (mulberry32). */
export function createSeededRng(seed: number): Rng {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Last use of a question or repetition group in the event day. */
export interface UsageSummary {
  /** Time of the last use. */
  lastUsedAtMs: number
  /** How often used in total. For diagnostics and the report only. */
  useCount: number
}

export interface SelectionInput {
  slot: QuestionSlotRule
  slotIndex: number
  /** Base set already filtered by audience and pools. */
  pool: Question[]
  /** Question ids already used in the current game. */
  excludeQuestionIds: ReadonlySet<string>
  /** Repetition groups already used in the current game. */
  excludeRepetitionGroupIds: ReadonlySet<string>
  /** Global usage history of the event day, addressed by `repetitionKey`. */
  usage: ReadonlyMap<string, UsageSummary>
  rng: Rng
}

export interface SelectionRationale {
  slotId: string
  slotIndex: number
  /** Candidates after slot filters and `enabled`. */
  matchingCandidates: number
  /** Candidates after excluding the questions/groups already used in the game. */
  availableCandidates: number
  /** From which freshness class was the draw made? */
  freshnessClass: 'never-used' | 'least-recently-used'
  /** Size of the window the draw was made from. */
  windowSize: number
  text: string
}

export type SelectionResult =
  | { ok: true; question: Question; rationale: SelectionRationale }
  | { ok: false; rationale: SelectionRationale; message: string }

/**
 * Key of the repetition avoidance. Questions with the same `repetitionGroupId`
 * count as the same question - for instance the same question with a different
 * image or audience-specific wording.
 */
export function repetitionKey(question: Question): string {
  return question.repetitionGroupId ?? question.id
}

/**
 * Base set of a game: audience plus (optionally) chosen pools.
 *
 * Both are DATA FIELDS of the questions (schema v2) - no special code, no
 * configured filter expressions. Without `poolIds` every pool takes part; so
 * "everything" stays the normal case and "Saarbruecken" a deliberate choice.
 */
export function poolForGame(
  questions: Question[],
  game: { audience: string; poolIds?: string[] | undefined },
): Question[] {
  return questions.filter((question) => {
    if (!question.enabled) return false
    if (!question.audiences.includes(game.audience)) return false
    if (game.poolIds?.length && !game.poolIds.some((id) => question.poolIds.includes(id))) return false
    return true
  })
}

/** Does the question satisfy every filter of the slot? A missing filter = any. */
export function matchesSlot(question: Question, slot: QuestionSlotRule): boolean {
  if (!question.enabled) return false
  const { difficultyIds, questionTypes, evaluationModes, categoryIds, tags } = slot.filters
  if (difficultyIds?.length && !difficultyIds.includes(question.difficulty)) return false
  if (questionTypes?.length && !questionTypes.includes(question.questionType)) return false
  if (evaluationModes?.length && !evaluationModes.includes(question.evaluationMode)) return false
  if (categoryIds?.length && !categoryIds.some((id) => question.categories.includes(id))) return false
  if (tags?.length && !tags.every((tag) => question.tags.includes(tag))) return false
  return true
}

/** Window size for the selection among questions already used. */
export function candidateWindowSize(candidateCount: number): number {
  return Math.max(selectionTuning.minWindowSize, Math.ceil(candidateCount * selectionTuning.windowFraction))
}

export function selectQuestionForSlot(input: SelectionInput): SelectionResult {
  const { slot, slotIndex, pool, excludeQuestionIds, excludeRepetitionGroupIds, usage, rng } = input

  // 1. Filter by slot filters and `enabled`.
  const matching = pool.filter((question) => matchesSlot(question, slot))

  // 2. Exclude questions and repetition groups already used in the current game.
  const available = matching.filter(
    (question) =>
      !excludeQuestionIds.has(question.id) && !excludeRepetitionGroupIds.has(repetitionKey(question)),
  )

  const baseRationale = {
    slotId: slot.id,
    slotIndex,
    matchingCandidates: matching.length,
    availableCandidates: available.length,
  }

  if (available.length === 0) {
    const rationale: SelectionRationale = {
      ...baseRationale,
      freshnessClass: 'never-used',
      windowSize: 0,
      text: `Kein Kandidat für Fragenplatz "${slot.id}" (passend: ${matching.length}, nach Ausschluss: 0).`,
    }
    return {
      ok: false,
      rationale,
      message:
        matching.length === 0
          ? `Für den Fragenplatz "${slot.id}" gibt es in der gewählten Auswahl keine passende Frage. Bitte anderes Preset oder andere Auswahl wählen.`
          : `Alle passenden Fragen für "${slot.id}" wurden in diesem Spiel bereits verwendet. Bitte Preset anpassen oder Fragenpool erweitern.`,
    }
  }

  // 3. Candidates never used form the highest freshness class.
  const neverUsed = available.filter((question) => !usage.has(repetitionKey(question)))
  if (neverUsed.length > 0) {
    const picked = pickUniform(neverUsed, rng)
    return {
      ok: true,
      question: picked,
      rationale: {
        ...baseRationale,
        freshnessClass: 'never-used',
        windowSize: neverUsed.length,
        text: `Zufällig aus ${neverUsed.length} heute noch nicht gespielten Fragen gewählt.`,
      },
    }
  }

  // 4./5./6. Sort by last use and draw from a small window of the oldest.
  const sorted = [...available].sort((a, b) => {
    const aUsed = usage.get(repetitionKey(a))?.lastUsedAtMs ?? 0
    const bUsed = usage.get(repetitionKey(b))?.lastUsedAtMs ?? 0
    if (aUsed !== bUsed) return aUsed - bUsed
    // Stable tiebreak, so that the selection is reproducible on equal timestamps.
    return a.id.localeCompare(b.id)
  })
  const windowSize = Math.min(sorted.length, candidateWindowSize(sorted.length))
  const window = sorted.slice(0, windowSize)
  const picked = pickWeightedTowardsOlder(window, rng)

  return {
    ok: true,
    question: picked,
    rationale: {
      ...baseRationale,
      freshnessClass: 'least-recently-used',
      windowSize,
      text: `Pool erschöpft: gewichtete Auswahl aus den ${windowSize} am längsten nicht gespielten Fragen.`,
    },
  }
}

function pickUniform<T>(items: T[], rng: Rng): T {
  const index = Math.min(items.length - 1, Math.floor(rng() * items.length))
  return items[index]!
}

/**
 * Draws from the window, lightly weighted in favour of older entries.
 * `olderBias = 0` would be uniform, `1` a linear weighting.
 */
function pickWeightedTowardsOlder<T>(window: T[], rng: Rng): T {
  const bias = selectionTuning.olderBias
  const weights = window.map((_, index) => 1 + bias * (window.length - 1 - index))
  const total = weights.reduce((sum, weight) => sum + weight, 0)
  let ticket = rng() * total
  for (let index = 0; index < window.length; index += 1) {
    ticket -= weights[index]!
    if (ticket <= 0) return window[index]!
  }
  return window[window.length - 1]!
}

/**
 * Visible option order for a game. Shuffling does not change the evaluation
 * because the comparison is always against `correctOptionId` (specification 16.3).
 */
export function shuffleOptionOrder(question: Question, rng: Rng): string[] {
  const ids = (question.options ?? []).map((option) => option.id)
  for (let index = ids.length - 1; index > 0; index -= 1) {
    const swapWith = Math.floor(rng() * (index + 1))
    const current = ids[index]!
    ids[index] = ids[swapWith]!
    ids[swapWith] = current
  }
  return ids
}
