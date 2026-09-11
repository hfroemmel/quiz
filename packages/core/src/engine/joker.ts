/**
 * Joker rules - pure decisions, no state changes.
 *
 * Everything here answers one of two questions: "may this player spend their
 * joker this way right now?" and "which answers does a 50:50 hide?". The engine
 * applies the result, the operator's view model turns it into a disabled button
 * with a reason, and the tests check it without a server. ONE decision function,
 * three readers - that is why an operator button can never offer something the
 * engine would then refuse.
 *
 * Rejection messages are German plain text, like every other message in
 * `CommandRejection`: they are shown to the operator as they are.
 */
import {
  isChoiceQuestion,
  jokerOf,
  jokerRules,
  jokerTypeLabel,
  type CommandRejectionReason,
  type GameState,
  type JokerType,
  type PlayerId,
  type PlayerState,
} from '../contracts'
import { activePlayerId } from './buzzer'
import { attemptsForCurrentQuestion, pendingAttempt } from './scoring'

export type JokerDecision =
  | { allowed: true }
  | { allowed: false; reason: CommandRejectionReason; message: string }

const deny = (reason: CommandRejectionReason, message: string): JokerDecision => ({
  allowed: false,
  reason,
  message,
})

/**
 * Phases in which a question is on screen with its answers VISIBLE.
 *
 * The 50:50 removes answers, so it needs answers the room can see. Before the
 * operator releases the round (`question-presented`) the server does not even
 * transmit the options - removing two of something nobody has seen is not a
 * hint, it is a question that arrives pre-shortened. `solution`,
 * `attempt-feedback` and `result` are out for the opposite reason: there the
 * question is decided.
 *
 * The audience joker has no such need - it takes nothing off the screen - but it
 * shares the phases anyway: what it means is "ask the room about THIS question",
 * and that needs a question the room is looking at.
 */
const answerablePhases = new Set<GameState['phase']>([
  'buzzer-open',
  'answer-locked',
  'second-chance',
  'reveal-ready',
  'reveal-running',
  'reveal-paused',
])

function playerOf(state: GameState, playerId: PlayerId): PlayerState | undefined {
  return state.players.find((player) => player.id === playerId)
}

/**
 * Does this game have jokers at all?
 *
 * The SUPPLY answers it, not a configuration flag: a game that was started with
 * jokers carries one record per player, and one that was not carries nothing.
 * That makes the state self-describing - a game resumed from a save written
 * before this feature existed does not suddenly grow jokers halfway through -
 * and it keeps the decision in the one place that creates the supply
 * (`startGame`, operated games only).
 */
export function gameHasJokers(state: GameState | null): boolean {
  return Boolean(state && state.status === 'active' && state.jokerByPlayer)
}

/**
 * May this player spend their joker, this way, right now?
 *
 * The order of the checks is the order of the sentences the operator reads: the
 * spent joker first, because it is the one answer that holds whatever the
 * question looks like; then the situation; then, for the 50:50 alone, the
 * question itself.
 */
export function evaluateJokerUse(
  state: GameState | null,
  playerId: PlayerId,
  type: JokerType,
): JokerDecision {
  if (!state || state.status !== 'active') return deny('no-active-game', 'Es läuft gerade kein Spiel.')

  if (!gameHasJokers(state)) {
    return deny('joker-not-applicable', 'In diesem Spiel gibt es keine Joker.')
  }

  const player = playerOf(state, playerId)
  if (!player) return deny('unknown-player', 'Diesen Spieler gibt es in diesem Spiel nicht.')

  /*
   * ONE SUPPLY. It does not matter which variant was spent - after either one
   * this player has no joker, and the message says which one it was so the
   * operator can tell the room.
   */
  const joker = jokerOf(state.jokerByPlayer, playerId)
  if (joker.status === 'used') {
    return deny(
      'joker-already-used',
      `${player.label} hat den Joker in diesem Spiel schon als ${jokerTypeLabel(joker.type)} eingesetzt.`,
    )
  }

  if (!state.currentQuestion || !answerablePhases.has(state.phase)) {
    return deny(
      'invalid-phase',
      'Ein Joker gilt nur zu einer Frage, deren Antworten stehen und die noch nicht aufgelöst ist.',
    )
  }

  /*
   * A JOKER HELPS WHOEVER IS ANSWERING. Once one player holds the buzz, the
   * other one is not answering this question - a hint for them would change
   * nothing on screen except their own supply. In the second chance the roles
   * are the other way round, and the same rule reads it correctly.
   */
  const answering = answeringPlayer(state)
  if (answering && answering !== playerId) {
    const other = playerOf(state, answering)
    return deny(
      'joker-player-not-answering',
      `${other?.label ?? 'Der andere Spieler'} ist an der Reihe. ${player.label} kann zu dieser Frage keinen Joker einsetzen.`,
    )
  }
  if (player.lockedForCurrentQuestion) {
    return deny(
      'joker-player-not-answering',
      `${player.label} ist für diese Frage gesperrt und kann hier keinen Joker einsetzen.`,
    )
  }

  /* The audience joker asks nothing of the question - only of the moment. */
  if (type === 'audience') return { allowed: true }

  return evaluateFiftyFifty(state)
}

/**
 * Who is answering the current question, as far as it is decided.
 *
 * `null` while the buzzer is still open - then either player may take it, and
 * either may spend a joker to prepare for it.
 */
function answeringPlayer(state: GameState): PlayerId | null {
  return activePlayerId(state) ?? null
}

/**
 * The extra conditions of the 50:50 - all about the question on screen.
 *
 * They are separate because the audience joker shares none of them: it works on
 * a free-answer question and on a picture just as well.
 */
function evaluateFiftyFifty(state: GameState): JokerDecision {
  const runtime = state.currentQuestion!
  const question = runtime.question

  /*
   * A CONFIRMED ANSWER CLOSES THE DOOR - and so does a merely logged one.
   *
   * Once an attempt for this question carries an outcome, the question is
   * decided for that attempt. And once an option is logged but not yet resolved,
   * the player has committed: removing answers around that commitment would
   * either be pointless or look like a correction.
   */
  if (attemptsForCurrentQuestion(state).some((attempt) => attempt.outcome !== undefined)) {
    return deny('attempt-already-resolved', 'Zu dieser Frage wurde bereits eine Antwort gewertet.')
  }
  const pending = pendingAttempt(state)
  if (pending?.loggedOptionId || pending?.loggedManualVerdict) {
    return deny('answer-not-logged', 'Es ist schon eine Antwort eingeloggt. Der 50:50-Joker kommt davor.')
  }

  if (state.activeFiftyFifty && state.activeFiftyFifty.questionId === question.id) {
    return deny('joker-effect-active', 'Zu dieser Frage ist bereits ein 50:50-Joker aktiv.')
  }

  /*
   * SINGLE CHOICE WITH EXACTLY ONE CORRECT ANSWER. The data model carries one
   * `correctOptionId`, so "several correct answers" cannot be expressed - but a
   * question without a choice at all can, and a true/false question is simply
   * one with two options, caught by the count below.
   */
  if (!isChoiceQuestion(question) || !question.correctOptionId) {
    return deny(
      'joker-not-applicable',
      'Der 50:50-Joker gilt nur für Auswahlfragen mit genau einer richtigen Antwort. Der Joker bleibt erhalten.',
    )
  }
  if (!runtime.optionOrder.includes(question.correctOptionId)) {
    return deny(
      'joker-not-applicable',
      'Die richtige Antwort steht nicht unter den angezeigten Antworten. Der Joker bleibt erhalten.',
    )
  }
  if (runtime.optionOrder.length < jokerRules.fiftyFiftyMinOptionCount) {
    return deny(
      'joker-not-applicable',
      `Diese Frage hat nur ${runtime.optionOrder.length} Antworten. Der 50:50-Joker braucht mindestens ${jokerRules.fiftyFiftyMinOptionCount} und bleibt erhalten.`,
    )
  }
  return { allowed: true }
}

/** May the operator hand this player's joker back? Only if it was spent. */
export function evaluateJokerRestore(state: GameState | null, playerId: PlayerId): JokerDecision {
  if (!state || state.status !== 'active') return deny('no-active-game', 'Es läuft gerade kein Spiel.')
  if (!gameHasJokers(state)) {
    return deny('joker-not-applicable', 'In diesem Spiel gibt es keine Joker.')
  }
  const player = playerOf(state, playerId)
  if (!player) return deny('unknown-player', 'Diesen Spieler gibt es in diesem Spiel nicht.')
  if (jokerOf(state.jokerByPlayer, playerId).status !== 'used') {
    return deny('joker-not-used', `${player.label} hat den Joker noch nicht eingesetzt.`)
  }
  return { allowed: true }
}

/**
 * Which answers a 50:50 hides.
 *
 * The correct answer stays, exactly one wrong answer stays, everything else
 * goes - whether the question has three, four or seven answers. The surviving
 * wrong answer is drawn HERE, once, on the server, and the ids travel in the
 * snapshot: every client then hides the same ones, and nobody has to reproduce a
 * seeded draw.
 *
 * `random` is injected so a test can hand in a fixed number instead of luck.
 */
export function pickFiftyFiftyHiddenOptions(input: {
  correctOptionId: string
  optionOrder: readonly string[]
  random: () => number
}): string[] {
  const incorrect = input.optionOrder.filter((optionId) => optionId !== input.correctOptionId)
  if (incorrect.length <= jokerRules.fiftyFiftySurvivingIncorrectCount) return []
  const keptIndex = Math.min(incorrect.length - 1, Math.floor(input.random() * incorrect.length))
  const kept = incorrect[keptIndex]!
  return incorrect.filter((optionId) => optionId !== kept)
}
