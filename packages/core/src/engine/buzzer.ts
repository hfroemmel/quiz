/**
 * Buzzer and eligibility rules (specification 8 and 10.3).
 *
 * DRY rule: whether a player may buzz is decided exclusively here. Hardware
 * buzzers (keys `A`/`B`) and the operator's manual player selection pass the
 * same check, so that the fallback has no different rules.
 */
import type { CommandRejectionReason, GamePhase, GameState, PlayerId, PlayerState } from '../contracts'

/**
 * Phases in which the server accepts buzzer events at all.
 *
 * `video-playing` is deliberately missing: no buzzing during the video. Because
 * eligibility depends on the phase alone, the forbidden combination "video
 * playing and buzzer open" structurally cannot exist.
 *
 * `reveal-paused` is included: when the operator pauses the reveal, answering
 * stays possible - only the picture is frozen.
 */
const buzzablePhases: readonly GamePhase[] = ['buzzer-open', 'reveal-running', 'reveal-paused']

export function isBuzzablePhase(phase: GamePhase): boolean {
  return buzzablePhases.includes(phase)
}

/**
 * Phases in which, in self-service, an answer can be tapped and confirmed: an
 * attempt is open and already belongs to a player. In the second chance there
 * is no buzz any more, which is why it stands here next to `answer-locked`.
 */
const answerablePhases: readonly GamePhase[] = ['answer-locked', 'second-chance']

export function isSelfServiceAnswerPhase(phase: GamePhase): boolean {
  return answerablePhases.includes(phase)
}

export interface BuzzDecision {
  allowed: boolean
  reason?: CommandRejectionReason
  message?: string
}

/**
 * May `playerId` get the buzz now?
 *
 * The server decides atomically: after the first accepted buzz `buzzer.open` is
 * false, every further event is refused until the game rule opens it again. An
 * artificial tie between two buzzers need not be handled - the order of command
 * acceptance is what counts.
 */
export function evaluateBuzz(state: GameState, playerId: PlayerId): BuzzDecision {
  if (state.status !== 'active') {
    return { allowed: false, reason: 'no-active-game', message: 'Es läuft gerade kein Spiel.' }
  }
  if (state.phase === 'answer-locked' && state.buzzer.acceptedPlayerId) {
    // Most common case: one player holds the buzz and the other keeps hammering
    // the buzzer. That deserves its own, understandable reason.
    return {
      allowed: false,
      reason: 'buzzer-already-taken',
      message: 'Ein Spieler hat bereits den Zuschlag. Mit "Buzzer zurücksetzen" erneut freigeben.',
    }
  }
  if (!isBuzzablePhase(state.phase)) {
    return {
      allowed: false,
      reason: 'invalid-phase',
      message: 'In dieser Phase ist der Buzzer gesperrt. Zuerst die Antwortphase freigeben.',
    }
  }
  if (!state.buzzer.open) {
    if (state.buzzer.acceptedPlayerId) {
      return {
        allowed: false,
        reason: 'buzzer-already-taken',
        message: 'Ein Spieler hat bereits den Zuschlag. Mit "Buzzer zurücksetzen" erneut freigeben.',
      }
    }
    return { allowed: false, reason: 'buzzer-closed', message: 'Der Buzzer ist derzeit gesperrt.' }
  }
  const player = state.players.find((entry) => entry.id === playerId)
  if (!player) {
    return { allowed: false, reason: 'invalid-payload', message: 'Unbekannter Spieler.' }
  }
  if (player.lockedForCurrentQuestion) {
    return {
      allowed: false,
      reason: 'player-locked',
      message: `${player.label} hatte bei dieser Frage bereits den ersten Versuch.`,
    }
  }
  return { allowed: true }
}

/**
 * Another player who may still answer this question.
 *
 * This is the only place that decides whether there is a second chance. In a
 * solo game there is nobody - so the second chance disappears there without the
 * state machine needing a special case.
 */
export function eligibleOpponent(state: GameState, playerId: PlayerId | null): PlayerState | undefined {
  return state.players.find((player) => player.id !== playerId && !player.lockedForCurrentQuestion)
}

/** The player who may answer right now - regardless of how they were determined. */
export function activePlayerId(state: GameState): PlayerId | undefined {
  if (state.phase === 'second-chance') {
    return state.players.find((player) => !player.lockedForCurrentQuestion)?.id
  }
  return state.buzzer.acceptedPlayerId
}
