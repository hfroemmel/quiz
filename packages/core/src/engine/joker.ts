/**
 * Joker rules - pure decisions, no state changes.
 *
 * Everything here answers one of three questions: "may a joker be drawn right
 * now?", "what does the draw come out as?" and "does this continue belong to the
 * draw that is running?". The engine applies the result, the operator's view
 * model turns it into a disabled button with a reason, and the tests check it
 * without a server. ONE decision function, three readers - that is why an
 * operator button can never offer something the engine would then refuse.
 *
 * Rejection messages are German plain text, like every other message in
 * `CommandRejection`: they are shown to the operator as they are.
 */
import {
  isChoiceQuestion,
  jokerOf,
  jokerRules,
  jokerTypes,
  type CommandRejectionReason,
  type CommandType,
  type GameState,
  type JokerType,
  type PlayerId,
} from '../contracts'
import { activePlayerId } from './buzzer'
import { attemptsForCurrentQuestion, pendingAttempt } from './scoring'

/**
 * Commands that a running draw puts on hold.
 *
 * Everything that would decide the question or move on from it. Sound,
 * language, the abort and the timed transition are NOT on the list: the first
 * two belong to the device, and the last two have to keep working even while
 * something is on screen.
 *
 * ONE list, two readers - the engine refuses these commands
 * (`jokerSequenceBlocks`) and the operator's preview stops offering them
 * (`availableCommands`). Two lists would drift apart on the first addition.
 */
export const jokerBlockedCommands: readonly CommandType[] = [
  'LOG_OPTION_ANSWER',
  'MARK_MANUAL_ANSWER',
  'RESOLVE_ATTEMPT',
  'RESOLVE_WITHOUT_ANSWER',
  'PASS_SECOND_CHANCE',
  'CONTINUE',
  'SKIP_QUESTION',
  'OPEN_BUZZER',
  'BUZZ',
  'SELECT_PLAYER_MANUALLY',
]

/**
 * Is a draw holding the question right now?
 *
 * `applied` is NOT holding: the effect is on screen, the question goes on, and
 * the operator carries on as usual.
 */
export function jokerSequenceHoldsQuestion(state: GameState | null): boolean {
  const phase = state?.jokerSequence?.phase
  return phase === 'drawing' || phase === 'revealed'
}

/**
 * Name of the timed transition that turns the card.
 *
 * The draw needs a step that happens WITHOUT a client asking for it, and the
 * engine already has one mechanism for that: `pendingTransition`. This is the
 * name it is scheduled under, in one place, so the engine can recognise its own
 * transition again when it comes due (`transitionId` carries it as a prefix -
 * see `Draft.scheduleTimedTransition`).
 */
export const JOKER_REVEAL_TRANSITION = 'joker-reveal'

/** Is the transition that just came due the turn of the card? */
export function isJokerRevealTransition(state: GameState | null, transitionId: string): boolean {
  return (
    state?.jokerSequence?.phase === 'drawing' && transitionId.startsWith(`${JOKER_REVEAL_TRANSITION}:`)
  )
}

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
 * A joker belongs to a question the room is looking at. Before the operator
 * releases the round (`question-presented`) the server does not even transmit
 * the options - and nobody has buzzed yet either, so there is no player whose
 * joker it would be. `solution`, `attempt-feedback` and `result` are out for the
 * opposite reason: there the question is decided.
 */
const answerablePhases = new Set<GameState['phase']>([
  'buzzer-open',
  'answer-locked',
  'second-chance',
  'reveal-ready',
  'reveal-running',
  'reveal-paused',
])

/**
 * Is the current question still open - answers up, nothing decided?
 *
 * The same set the draw itself is measured against, so "a joker may be drawn"
 * and "the audience mark is still shown" cannot drift apart.
 */
export function questionStillOpen(state: GameState): boolean {
  return Boolean(state.currentQuestion) && answerablePhases.has(state.phase)
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
 * The answers a 50:50 would still have to work with.
 *
 * Options that were already logged as wrong in an EARLIER attempt are used up:
 * the room has seen them fail, and the second chance cannot choose them again.
 * Counting them would let a 50:50 on a three-answer question in the second
 * chance leave the correct answer alone on screen - the solution, not a hint.
 */
export function drawableOptionIds(state: GameState): string[] {
  const runtime = state.currentQuestion
  if (!runtime) return []
  const spent = new Set([
    ...attemptsForCurrentQuestion(state)
      .filter((attempt) => attempt.outcome === 'incorrect' && attempt.loggedOptionId)
      .map((attempt) => attempt.loggedOptionId!),
    /*
     * AND WHAT A 50:50 HAS ALREADY STRUCK OUT. Those answers are gone from the
     * screen, so a second draw on the same question must neither count them as
     * open nor remove them twice - it would otherwise leave the correct answer
     * standing alone, which is the solution and not a hint.
     */
    ...(runtime.eliminatedOptionIds ?? []),
  ])
  return runtime.optionOrder.filter((optionId) => !spent.has(optionId))
}

/**
 * May a joker be drawn right now - and if so, whose?
 *
 * The player is NOT an argument. Only the player who holds the buzz can draw,
 * and the server is the one that knows who that is; a caller who could name a
 * player could name the wrong one. The decision therefore returns the player it
 * derived, and the engine writes exactly that one.
 *
 * The order of the checks is the order of the sentences the operator reads: the
 * situation first, then the supply, then the question itself.
 */
export function evaluateJokerDraw(
  state: GameState | null,
): JokerDecision & { playerId?: PlayerId } {
  if (!state || state.status !== 'active') return deny('no-active-game', 'Es läuft gerade kein Spiel.')
  if (!gameHasJokers(state)) {
    return deny('joker-not-applicable', 'In diesem Spiel gibt es keine Joker.')
  }

  /*
   * ONE SCREEN, ONE DRAW - WHILE ONE IS RUNNING. A second card in the air
   * while the first is still turning would be two cards in the middle of the
   * same screen.
   *
   * AN APPLIED DRAW IS NOT RUNNING, and that distinction is the whole point of
   * this check. The sequence stays in the state until the next question (its
   * effect is on screen), so asking for anything but `idle` locked the control
   * for the REST OF THE QUESTION: the player who buzzed drew their joker,
   * answered wrong, and the second chance then found a dark button - the other
   * player could not spend their own joker, with a sentence about a draw that
   * had long since finished. `jokerSequenceHoldsQuestion` is the same predicate
   * the engine blocks its commands with, so both say the same thing.
   */
  if (jokerSequenceHoldsQuestion(state)) {
    return deny('joker-sequence-active', 'Es läuft bereits eine Jokerziehung.')
  }

  if (!state.currentQuestion || !answerablePhases.has(state.phase)) {
    return deny(
      'invalid-phase',
      'Ein Joker gilt nur zu einer Frage, deren Antworten stehen und die noch nicht aufgelöst ist.',
    )
  }

  /*
   * THE JOKER BELONGS TO WHOEVER IS ANSWERING. Before a valid buzz nobody is,
   * and the draw has no owner - that is the one case in which the button is
   * dark although everything about the question is fine.
   */
  const playerId = activePlayerId(state)
  if (!playerId) {
    return deny('joker-no-answering-player', 'Es hat noch niemand gebuzzert.')
  }
  const player = state.players.find((entry) => entry.id === playerId)!

  if (jokerOf(state.jokerByPlayer, playerId).status === 'used') {
    return deny('joker-already-used', `${player.label} hat den Joker in diesem Spiel schon eingesetzt.`)
  }

  /*
   * A COMMITTED ANSWER CLOSES THE DOOR. Once an option is logged, the player
   * has decided; removing answers around that decision would either be
   * pointless or look like a correction. `RESOLVE_ATTEMPT` is the final step
   * and the phases above already exclude everything after it.
   */
  const pending = pendingAttempt(state)
  if (pending?.loggedOptionId || pending?.loggedManualVerdict) {
    return deny('answer-not-logged', 'Antwort eingeloggt. Joker kommt davor.')
  }

  /*
   * WHAT COULD COME OUT OF THIS QUESTION? If nothing, the draw is refused with
   * the reason - and the coin is never flipped over a question that cannot
   * carry the result.
   */
  const possible = drawableJokerTypes(state)
  if (possible.length === 0) return evaluateFiftyFiftySuitability(state)

  return { allowed: true, playerId }
}

/**
 * The variants this question could produce.
 *
 * A FREE-ANSWER QUESTION CAN ONLY GIVE THE AUDIENCE JOKER - today that is
 * `image-reveal`, where the picture is the question and the answer is spoken.
 * There is nothing to halve without options, and asking the room is the only
 * help that means anything there, so the draw stays open and the coin simply
 * has one side.
 *
 * THE ANSWERS DECIDE THIS, NOT THE NAME OF THE TYPE. `image-reveal` is the case
 * because it carries no options, and a text choice carries them and
 * is therefore an ordinary choice question with a prologue. A list of type names
 * here would be a second rule beside `isChoiceQuestion` and would get the next
 * type wrong - which is exactly how a 50:50 could be drawn on a question with
 * nothing to remove.
 *
 * A CHOICE QUESTION WITH TOO FEW OPEN ANSWERS gives nothing at all. Removing a
 * wrong answer from two would leave the correct one alone on screen, and an
 * audience joker on a question the 50:50 cannot serve would be a lottery on top
 * of a lottery: the player would get the lesser help because their question
 * happened to be short. Such a question is not drawable - see
 * `evaluateFiftyFiftySuitability` for the sentence the operator reads.
 */
export function drawableJokerTypes(state: GameState): JokerType[] {
  const question = state.currentQuestion?.question
  if (!question) return []
  if (!isChoiceQuestion(question)) return ['audience']
  if (evaluateFiftyFiftySuitability(state).allowed) return [...jokerTypes]
  /*
   * A QUESTION THAT HAS BEEN WORN DOWN STILL CARRIES THE AUDIENCE JOKER.
   *
   * The paragraph above is about a question that was never long enough - there
   * the draw stays shut, because a player must not get the lesser help by the
   * accident of a short question. A question that STARTED long enough and lost
   * its answers during play is a different situation: a 50:50 was applied, a
   * wrong answer was logged, and the player in the second chance would
   * otherwise get nothing at all. Nothing is worse than the audience joker,
   * and the desk says beforehand what will come (`onlyType`), exactly as it
   * does on a picture question.
   *
   * The count of the question decides which of the two cases this is - not the
   * open answers, which are what the play has made of them.
   */
  return (question.options ?? []).length >= jokerRules.fiftyFiftyMinOptionCount ? ['audience'] : []
}

/**
 * The extra conditions of the 50:50 - all about the question on screen.
 *
 * Separate from the draw itself because the operator's view shows this as the
 * reason a question is unsuitable, and because the numbers come from
 * `jokerRules` rather than from this function.
 */
export function evaluateFiftyFiftySuitability(state: GameState): JokerDecision {
  const runtime = state.currentQuestion
  if (!runtime) {
    return deny('invalid-phase', 'Es steht gerade keine Frage.')
  }
  const question = runtime.question

  /*
   * SINGLE CHOICE WITH EXACTLY ONE CORRECT ANSWER. The data model carries one
   * `correctOptionId`, so "several correct answers" cannot be expressed - but a
   * question without a choice at all can, and a true/false question is simply
   * one with two options, caught by the count below.
   */
  if (!isChoiceQuestion(question) || !question.correctOptionId) {
    return deny(
      'joker-not-applicable',
      'Joker nicht anwendbar.',
    )
  }

  const drawable = drawableOptionIds(state)
  if (!drawable.includes(question.correctOptionId)) {
    return deny(
      'joker-not-applicable',
      'Diese Frage ist für den Joker nicht geeignet: Die richtige Antwort steht nicht unter den offenen Antworten.',
    )
  }
  if (drawable.length < jokerRules.fiftyFiftyMinOptionCount) {
    return deny(
      'joker-not-applicable',
      `Diese Frage ist für den Joker nicht geeignet: Es sind nur noch ${drawable.length} Antworten offen, der 50:50-Joker braucht mindestens ${jokerRules.fiftyFiftyMinOptionCount}.`,
    )
  }
  return { allowed: true }
}

/**
 * Which variant the draw comes out as - a fair coin, on the server.
 *
 * `random` is injected so a test can hand in a fixed number instead of luck.
 * The order of `jokerTypes` decides which half is which, and the boundary is
 * exactly 0.5: `random() < 0.5` is the 50:50 joker, everything else the
 * audience joker.
 *
 * WITH ONE POSSIBLE VARIANT THERE IS NO COIN. A picture question can only
 * produce the audience joker, and a draw that asked chance anyway would spend a
 * number for nothing - and, worse, could come out as something the question
 * cannot carry.
 */
export function drawJokerType(random: () => number, possible: readonly JokerType[]): JokerType {
  if (possible.length === 1) return possible[0]!
  return random() < 0.5 ? jokerTypes[0] : jokerTypes[1]
}

/**
 * Which answers a 50:50 removes.
 *
 * The correct answer stays, exactly one wrong answer stays, everything else
 * goes - whether the question has three, four or seven answers. The surviving
 * wrong answer is drawn HERE, once, on the server, and the ids travel in the
 * snapshot: every client then removes the same ones, and nobody has to
 * reproduce a seeded draw.
 *
 * `random` is injected for the same reason as above.
 */
export function pickEliminatedOptions(input: {
  correctOptionId: string
  drawableOptionIds: readonly string[]
  random: () => number
}): string[] {
  const incorrect = input.drawableOptionIds.filter((optionId) => optionId !== input.correctOptionId)
  if (incorrect.length <= jokerRules.fiftyFiftySurvivingIncorrectCount) return []
  const keptIndex = Math.min(incorrect.length - 1, Math.floor(input.random() * incorrect.length))
  const kept = incorrect[keptIndex]!
  return incorrect.filter((optionId) => optionId !== kept)
}

/**
 * May the operator continue THIS draw?
 *
 * The id is what makes it safe. An operator view that repainted late, or a
 * click that arrived after a reconnect, carries the id of a draw that is
 * already over - and is refused rather than advancing the one that is running
 * now. Continuing is only possible from `revealed`: while the card is still
 * turning there is nothing to confirm, and after `applied` the step is done.
 */
export function evaluateJokerContinue(state: GameState | null, sequenceId: string): JokerDecision {
  if (!state || state.status !== 'active') return deny('no-active-game', 'Es läuft gerade kein Spiel.')
  const sequence = state.jokerSequence
  if (!sequence || sequence.phase === 'idle') {
    return deny('joker-no-sequence', 'Es läuft gerade keine Jokerziehung.')
  }
  if (sequence.sequenceId !== sequenceId) {
    return deny('joker-sequence-stale', 'Diese Jokerziehung ist nicht mehr die aktuelle.')
  }
  if (sequence.phase !== 'revealed') {
    return deny(
      'joker-sequence-stale',
      sequence.phase === 'drawing'
        ? 'Die Karte wird noch aufgedeckt.'
        : 'Dieser Joker ist bereits angewendet.',
    )
  }
  return { allowed: true }
}
