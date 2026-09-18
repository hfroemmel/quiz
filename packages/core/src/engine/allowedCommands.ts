/**
 * Derivation of the commands that make sense right now from the state (specification 21.1).
 *
 * DRY rule: operator and moderator clients do not rebuild this table. They
 * receive `allowedCommands` in the view model and show their controls
 * accordingly. That way a button always names exactly the action it actually
 * performs in the current state - instead of permanently showing many disabled
 * buttons.
 *
 * This function is a preview, not a second validation: the engine still decides
 * for good when it processes the command.
 */
import {
  isChoiceQuestion,
  roleMayIssue,
  type ActorRole,
  type CommandType,
  type GameState,
} from '../contracts'
import { isBuzzablePhase, isSelfServiceAnswerPhase } from './buzzer'
import {
  evaluateJokerContinue,
  evaluateJokerDraw,
  jokerBlockedCommands,
  jokerSequenceHoldsQuestion,
} from './joker'

export function availableCommands(state: GameState | null): CommandType[] {
  const list = new Set<CommandType>()

  if (state?.status === 'active' && state.flowProfile === 'self-service') {
    return selfServiceCommands(state)
  }

  if (!state || state.status !== 'active') {
    list.add('START_GAME')
    if (state) {
      list.add('SET_SOUND_ENABLED')
      list.add('SET_LOCALE')
      // On the result view the manual score correction stays available;
      // the result is recomputed deterministically afterwards.
      if (state.status === 'completed') list.add('ADJUST_SCORE')
    }
    return [...list]
  }

  list.add('SET_SOUND_ENABLED')
  list.add('SET_LOCALE')
  list.add('ABORT_GAME')
  list.add('ADJUST_SCORE')

  const question = state.currentQuestion?.question
  const isChoice = question ? isChoiceQuestion(question) : false
  const addAnswerLogging = () => {
    if (isChoice) list.add('LOG_OPTION_ANSWER')
    /*
     * "Correct"/"wrong" by hand exists only where the question provides for
     * it - the image reveal with a free answer. On a choice question it would
     * be a second evaluation path next to the logged option and would bypass
     * the automatic evaluation.
     *
     * A question without a real choice (fewer than two options) has no letter
     * keys - there the manual verdict is the only way, whatever the record
     * says as its evaluation mode.
     */
    if (question?.evaluationMode === 'manual-correct-incorrect' || !isChoice) list.add('MARK_MANUAL_ANSWER')
    list.add('RESOLVE_ATTEMPT')
  }

  switch (state.phase) {
    case 'pause-screen':
      list.add('SKIP_QUESTION')
      break

    case 'question-presented':
      list.add('OPEN_BUZZER')
      list.add('RESOLVE_WITHOUT_ANSWER')
      list.add('SKIP_QUESTION')
      break

    case 'buzzer-open':
      list.add('BUZZ')
      list.add('SELECT_PLAYER_MANUALLY')
      list.add('RESET_BUZZER')
      list.add('RESOLVE_WITHOUT_ANSWER')
      list.add('SKIP_QUESTION')
      break

    case 'answer-locked':
      addAnswerLogging()
      list.add('RESOLVE_WITHOUT_ANSWER')
      list.add('RESET_BUZZER')
      list.add('SKIP_QUESTION')
      if (question?.questionType === 'image-reveal') list.add('REVEAL_IMAGE_COMPLETELY')
      break

    case 'second-chance':
      addAnswerLogging()
      list.add('PASS_SECOND_CHANCE')
      list.add('RESOLVE_WITHOUT_ANSWER')
      list.add('RESET_BUZZER')
      list.add('SKIP_QUESTION')
      break

    case 'reveal-ready':
      // Before the start there is nothing to buzz for - the image is still blurred.
      list.add('START_IMAGE_REVEAL')
      list.add('RESOLVE_WITHOUT_ANSWER')
      list.add('SKIP_QUESTION')
      break

    case 'reveal-running':
      list.add('BUZZ')
      list.add('SELECT_PLAYER_MANUALLY')
      list.add('PAUSE_IMAGE_REVEAL')
      list.add('REVEAL_IMAGE_COMPLETELY')
      list.add('RESET_IMAGE_REVEAL')
      list.add('RESET_BUZZER')
      list.add('RESOLVE_WITHOUT_ANSWER')
      list.add('SKIP_QUESTION')
      break

    case 'reveal-paused':
      list.add('BUZZ')
      list.add('SELECT_PLAYER_MANUALLY')
      list.add('RESUME_IMAGE_REVEAL')
      list.add('REVEAL_IMAGE_COMPLETELY')
      list.add('RESET_IMAGE_REVEAL')
      list.add('RESET_BUZZER')
      list.add('RESOLVE_WITHOUT_ANSWER')
      list.add('SKIP_QUESTION')
      break

    case 'solution':
      list.add('CONTINUE')
      break

    case 'attempt-feedback':
    default:
      // During the feedback sequence there is deliberately no action: the switch
      // runs through the server's defined fallback time.
      break
  }

  for (const type of jokerCommands(state)) list.add(type)
  /*
   * A running draw takes everything else off the desk - the same rule the
   * engine applies to the commands themselves (`jokerSequenceBlocks`). The
   * operator is left with the one step the draw is waiting for.
   */
  if (jokerSequenceHoldsQuestion(state)) {
    return [...list].filter((type) => !jokerBlockedCommands.includes(type))
  }
  return [...list]
}

/**
 * Which joker commands are worth offering right now?
 *
 * Asked against the SAME rules the engine applies: a command that would be
 * refused does not appear, so the operator never gets a button that leads to a
 * refusal. WHY the draw is unavailable is a finer question - the operator view
 * answers it with a sentence per player (see `projection.ts`).
 */
function jokerCommands(state: GameState): CommandType[] {
  const list: CommandType[] = []
  if (evaluateJokerDraw(state).allowed) list.push('DRAW_JOKER')
  /*
   * Continuing needs the id of the running draw, which this preview does not
   * carry - so it asks with the id the state itself holds. The operator client
   * sends the id from the same snapshot.
   */
  const sequence = state.jokerSequence
  if (sequence && sequence.phase !== 'idle' && evaluateJokerContinue(state, sequence.sequenceId).allowed) {
    list.push('CONTINUE_JOKER')
  }
  return list
}

/**
 * Self-service: deliberately its own, very short list.
 *
 * It is NOT created by filtering the operator list. At the touch device there
 * is no opening, no resetting and no skipping - the server schedules these
 * transitions itself. What remains is the same command sequence as at the
 * operator's desk: take the buzz, log the answer, confirm the answer.
 */
function selfServiceCommands(state: GameState): CommandType[] {
  const list = new Set<CommandType>(['SET_SOUND_ENABLED', 'SET_LOCALE', 'ABORT_GAME'])

  if (isBuzzablePhase(state.phase) && state.buzzer.open) list.add('BUZZ')
  if (isSelfServiceAnswerPhase(state.phase)) {
    list.add('LOG_OPTION_ANSWER')
    // Confirming only makes sense once an option is logged; that is decided
    // by the engine (`answer-not-logged`), not by this preview.
    list.add('RESOLVE_ATTEMPT')
  }
  /*
   * After the solution the game only goes on when a player taps. The server
   * used to schedule a transition here; whoever was still reading why their
   * answer was wrong lost the picture under their eyes.
   */
  if (state.phase === 'solution') list.add('CONTINUE')

  return [...list]
}

/** Command list restricted to the role. */
export function allowedCommandsForRole(state: GameState | null, role: ActorRole): CommandType[] {
  return availableCommands(state).filter((type) => roleMayIssue(role, type))
}
