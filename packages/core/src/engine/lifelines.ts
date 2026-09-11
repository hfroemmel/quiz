/**
 * Lifeline rules - pure decisions, no state changes.
 *
 * Everything here answers one of two questions: "may this lifeline be used
 * right now?" and "which answers does the 50:50 hide?". The engine applies the
 * result, the projection shows it to the operator as a greyed-out button with a
 * reason, and the tests check it without a server. ONE decision function, three
 * readers - that is why an operator button can never offer something the engine
 * would then refuse.
 *
 * Rejection messages are German plain text, like every other message in
 * `CommandRejection`: they are shown to the operator as they are.
 */
import {
  isChoiceQuestion,
  lifelineRules,
  lifelineTypeEnabled,
  lifelinesOf,
  type CommandRejectionReason,
  type GameState,
  type LifelineConfig,
  type LifelineType,
  type PlayerId,
  type PlayerState,
} from '../contracts'
import { attemptsForCurrentQuestion, pendingAttempt } from './scoring'

export type LifelineDecision =
  | { allowed: true }
  | { allowed: false; reason: CommandRejectionReason; message: string }

const deny = (reason: CommandRejectionReason, message: string): LifelineDecision => ({
  allowed: false,
  reason,
  message,
})

/** Human-readable name of a lifeline, for messages the operator reads. */
export function lifelineLabel(type: LifelineType): string {
  return type === 'fiftyFifty' ? '50:50-Joker' : 'Publikumsjoker'
}

/**
 * Phases in which a question is on screen and still open.
 *
 * `solution`, `attempt-feedback` and `result` are missing on purpose: there the
 * question is decided, and hiding answers afterwards would change nothing but
 * confuse the room. `pause-screen` is missing too - the next question is drawn,
 * but nobody has read it yet.
 */
const openQuestionPhases = new Set<GameState['phase']>([
  'question-presented',
  'video-ready',
  'video-playing',
  'buzzer-open',
  'answer-locked',
  /*
   * The second chance counts as open. The other player is on, the question is
   * still unanswered for them, and asking the audience at that moment is the
   * most natural use of that lifeline there is. The 50:50 refuses itself here
   * anyway - by then an answer has been scored (see `evaluateFiftyFifty`), and
   * that is a rule of the 50:50, not of the phase.
   */
  'second-chance',
  'reveal-ready',
  'reveal-running',
  'reveal-paused',
])

function playerOf(state: GameState, playerId: PlayerId): PlayerState | undefined {
  return state.players.find((player) => player.id === playerId)
}

/**
 * May this player use this lifeline right now?
 *
 * The order of the checks is the order of the sentences the operator gets: the
 * most general reason first ("this installation has no lifelines"), the most
 * specific last ("this question has only two answers"). A player who has
 * already spent a lifeline hears that before anything about the question -
 * otherwise a spent 50:50 on a two-answer question would blame the question.
 */
export function evaluateLifelineUse(
  state: GameState | null,
  config: LifelineConfig,
  playerId: PlayerId,
  type: LifelineType,
): LifelineDecision {
  if (!config.enabled) return deny('lifelines-disabled', 'Joker sind in dieser Aufstellung nicht vorgesehen.')
  if (!lifelineTypeEnabled(config, type)) {
    return deny('lifeline-type-disabled', `Der ${lifelineLabel(type)} ist in dieser Aufstellung nicht vorgesehen.`)
  }
  if (!state || state.status !== 'active') return deny('no-active-game', 'Es läuft gerade kein Spiel.')

  const player = playerOf(state, playerId)
  if (!player) return deny('unknown-player', 'Diesen Spieler gibt es in diesem Spiel nicht.')

  if (lifelinesOf(player)[type].used) {
    return deny('lifeline-already-used', `${player.label} hat den ${lifelineLabel(type)} in diesem Spiel schon eingesetzt.`)
  }

  if (!openQuestionPhases.has(state.phase) || !state.currentQuestion) {
    return deny('invalid-phase', 'Ein Joker kann nur zu einer laufenden, noch offenen Frage eingesetzt werden.')
  }

  /* The audience lifeline is a status the operator keeps - no question rules. */
  if (type === 'audience') return { allowed: true }

  return evaluateFiftyFifty(state)
}

/**
 * The extra conditions of the 50:50 - all about the question on screen.
 *
 * They are separate because the audience lifeline shares none of them: it works
 * on a free-answer question and on a picture just as well.
 */
function evaluateFiftyFifty(state: GameState): LifelineDecision {
  const runtime = state.currentQuestion!
  const question = runtime.question

  /*
   * A CONFIRMED ANSWER CLOSES THE DOOR - and so does a merely logged one.
   *
   * Once an attempt for this question carries an outcome, the question is
   * decided for that attempt (this also covers the second chance, where one
   * wrong answer is already publicly used up). And once an option is logged but
   * not yet resolved, the player has committed: removing answers around that
   * commitment would either be pointless or look like a correction.
   */
  if (attemptsForCurrentQuestion(state).some((attempt) => attempt.outcome !== undefined)) {
    return deny('attempt-already-resolved', 'Zu dieser Frage wurde bereits eine Antwort gewertet.')
  }
  const pending = pendingAttempt(state)
  if (pending?.loggedOptionId || pending?.loggedManualVerdict) {
    return deny('answer-not-logged', 'Es ist schon eine Antwort eingeloggt. Der 50:50-Joker kommt davor.')
  }

  if (state.activeFiftyFifty && state.activeFiftyFifty.questionId === question.id) {
    return deny('lifeline-effect-active', 'Zu dieser Frage ist bereits ein 50:50-Joker aktiv.')
  }

  if (!isChoiceQuestion(question) || !question.correctOptionId) {
    return deny(
      'lifeline-not-applicable',
      'Der 50:50-Joker gilt nur für Fragen mit Antwortauswahl und genau einer richtigen Antwort.',
    )
  }
  if (!runtime.optionOrder.includes(question.correctOptionId)) {
    return deny('lifeline-not-applicable', 'Die richtige Antwort steht nicht unter den angezeigten Antworten.')
  }
  if (runtime.optionOrder.length < lifelineRules.fiftyFiftyMinOptionCount) {
    return deny(
      'lifeline-not-applicable',
      `Diese Frage hat nur ${runtime.optionOrder.length} Antworten. Der 50:50-Joker braucht mindestens ${lifelineRules.fiftyFiftyMinOptionCount} und bleibt deshalb erhalten.`,
    )
  }
  return { allowed: true }
}

/** May the operator give this lifeline back? Only if it was spent. */
export function evaluateLifelineRestore(
  state: GameState | null,
  config: LifelineConfig,
  playerId: PlayerId,
  type: LifelineType,
): LifelineDecision {
  if (!config.enabled) return deny('lifelines-disabled', 'Joker sind in dieser Aufstellung nicht vorgesehen.')
  if (!state || state.status !== 'active') return deny('no-active-game', 'Es läuft gerade kein Spiel.')
  const player = playerOf(state, playerId)
  if (!player) return deny('unknown-player', 'Diesen Spieler gibt es in diesem Spiel nicht.')
  if (!lifelinesOf(player)[type].used) {
    return deny('lifeline-not-used', `${player.label} hat den ${lifelineLabel(type)} noch nicht eingesetzt.`)
  }
  return { allowed: true }
}

/**
 * Which answers the 50:50 hides.
 *
 * The correct answer stays, exactly one wrong answer stays, everything else
 * goes - whether the question has three, four or seven answers. The surviving
 * wrong answer is drawn HERE, once, on the server, and the ids travel in the
 * snapshot: every client then hides the same two, and nobody has to reproduce a
 * seeded draw.
 *
 * `random` is injected so a test can hand in a counter instead of luck.
 */
export function pickFiftyFiftyHiddenOptions(input: {
  correctOptionId: string
  optionOrder: readonly string[]
  random: () => number
}): string[] {
  const incorrect = input.optionOrder.filter((optionId) => optionId !== input.correctOptionId)
  if (incorrect.length <= lifelineRules.fiftyFiftySurvivingIncorrectCount) return []
  const keptIndex = Math.min(incorrect.length - 1, Math.floor(input.random() * incorrect.length))
  const kept = incorrect[keptIndex]!
  return incorrect.filter((optionId) => optionId !== kept)
}
