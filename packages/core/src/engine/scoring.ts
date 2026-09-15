/**
 * Scoring rules (specification 14).
 *
 * DRY rule: scoring exists exclusively here. Neither operator nor moderator
 * client nor persistence compute points themselves.
 */
import { scoringRules, type AnswerAttempt, type GameState, type PlayerId, type ScoringRules } from '../contracts'

/**
 * Points for a correct answer.
 *
 * Both confirmed cases follow the same rule and therefore need no special case
 * per question type:
 *  - normal question: first answer 100, second chance 50;
 *  - image reveal: without a previous failed attempt 100, otherwise 50.
 *
 * Further failed attempts do not lower the score any further, wrong answers
 * never deduct.
 *
 * The rules come in as an argument so that a package can set other values
 * (`config.rules.scoring`); without one the constants of the house apply.
 */
export function pointsForCorrectAnswer(previousFailedAttempts: number, scoring: ScoringRules = scoringRules): number {
  return previousFailedAttempts === 0 ? scoring.firstAnswerPoints : scoring.secondChancePoints
}

/** Number of attempts of the current question already answered wrongly. */
export function countFailedAttemptsForCurrentQuestion(state: GameState): number {
  const questionId = state.currentQuestion?.question.id
  if (!questionId) return 0
  return state.attempts.filter(
    (attempt) =>
      attempt.questionId === questionId &&
      attempt.slotIndex === state.currentSlotIndex &&
      attempt.outcome === 'incorrect',
  ).length
}

/** All attempts of the question currently running, in order of creation. */
export function attemptsForCurrentQuestion(state: GameState): AnswerAttempt[] {
  const questionId = state.currentQuestion?.question.id
  if (!questionId) return []
  return state.attempts.filter(
    (attempt) => attempt.questionId === questionId && attempt.slotIndex === state.currentSlotIndex,
  )
}

/** The attempt not yet evaluated, if any. */
export function pendingAttempt(state: GameState): AnswerAttempt | undefined {
  return attemptsForCurrentQuestion(state).find((attempt) => attempt.outcome === undefined)
}

/**
 * Change the score. By default the score does not drop below zero.
 * The return value carries the delta actually booked, so that the audit log
 * does not claim 100 points were deducted when it was capped at 0.
 */
export function applyScoreDelta(
  currentScore: number,
  delta: number,
  scoring: ScoringRules = scoringRules,
): { score: number; effectiveDelta: number } {
  const raw = currentScore + delta
  const score = Math.max(scoring.minimumScore, raw)
  return { score, effectiveDelta: score - currentScore }
}

export interface GameResult {
  mode: 'duel' | 'solo'
  winnerPlayerId: PlayerId | null
  isDraw: boolean
  solo?: { correctAnswers: number; questionCount: number }
}

/**
 * Result of a finished game. Deterministic from the state.
 *
 * In a duel the higher score wins, on equal scores it is a draw. In a solo game
 * there is neither: there the player's own score counts and how many questions
 * were answered correctly.
 */
export function determineResult(state: GameState): GameResult {
  const [first, second] = state.players
  if (!second) {
    return {
      mode: 'solo',
      winnerPlayerId: null,
      isDraw: false,
      solo: { correctAnswers: countCorrectAnswers(state), questionCount: countPlayedQuestions(state) },
    }
  }
  if (!first) return { mode: 'duel', winnerPlayerId: null, isDraw: true }
  if (first.score === second.score) return { mode: 'duel', winnerPlayerId: null, isDraw: true }
  return { mode: 'duel', winnerPlayerId: first.score > second.score ? first.id : second.id, isDraw: false }
}

/**
 * Correctly answered questions - not correct attempts.
 *
 * The difference shows on the image reveal: several attempts per question are
 * allowed there, but a question is still correct only once.
 */
function countCorrectAnswers(state: GameState): number {
  return countSlots(state, (attempt) => attempt.outcome === 'correct')
}

/**
 * Questions actually asked - not the number of slots. The two differ when a
 * slot was skipped.
 */
function countPlayedQuestions(state: GameState): number {
  return countSlots(state, () => true)
}

/** Number of slots on which a matching attempt falls. */
function countSlots(state: GameState, matches: (attempt: AnswerAttempt) => boolean): number {
  const slots = new Set<number>()
  for (const attempt of state.attempts) {
    if (matches(attempt)) slots.add(attempt.slotIndex)
  }
  return slots.size
}
