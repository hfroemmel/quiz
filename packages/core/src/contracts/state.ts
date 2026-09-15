/**
 * Authoritative runtime model (specification 18).
 *
 * This state lives exclusively in the local server. Clients send commands and
 * render filtered view models; they never change this state themselves.
 */
import { z } from 'zod'
import type { Question, QuestionPresentationType } from './content'
import type { JokerSequence, PlayerJokerStates } from './joker'

/**
 * Phases of the game flow.
 *
 * Impossible combinations are prevented structurally: opening the buzzer
 * depends on the phase alone (see `packages/domain/src/buzzer.ts`), so for
 * instance `video` can never have an open buzzer.
 */
export const gamePhases = [
  /** No game active. */
  'idle',
  /** Neutral pause/logo screen between two questions (timed). */
  'pause-screen',
  /**
   * Question visible, answer options still hidden, buzzer locked.
   * The moderator reads the question aloud before the operator opens it.
   */
  'question-presented',
  /**
   * Video part of a video question: the video area stands, the buzzer is locked.
   *
   * ONE PHASE, NOT THREE. Whether the video is playing, loading or already
   * finished is known only to the client that plays it - the server does not
   * learn it and does not need to. What it tracks is the section of the
   * question: video on the screen, and on it goes via `SHOW_QUESTION_AFTER_VIDEO`.
   */
  'video',
  /** Buzzer open (normal question). */
  'buzzer-open',
  /** A player holds the buzz, the operator logs the answer. */
  'answer-locked',
  /** Correct/wrong animation running (timed). */
  'attempt-feedback',
  /** Second chance of the other player on a normal question, no buzz needed. */
  'second-chance',
  /**
   * Image reveal: the image stands blurred, the reveal has not started yet.
   * The moderator reads the question aloud; buzzing is still locked.
   */
  'reveal-ready',
  /** Image reveal: reveal running, buzzer open. */
  'reveal-running',
  /** Image reveal: reveal frozen, buzzer still open. */
  'reveal-paused',
  /** Solution visible, question finished. */
  'solution',
  /** Result view after the last question. */
  'result',
  /** The game was aborted. There is deliberately no winner view. */
  'aborted',
] as const
export type GamePhase = (typeof gamePhases)[number]

export type PlayerId = 'player-1' | 'player-2'
export const playerIds: readonly PlayerId[] = ['player-1', 'player-2']

/**
 * Permitted player counts.
 *
 * A game has either two players (duel, the stage operation) or one (solo game
 * on the touch device). Both are the same flow; the player count only decides
 * whether there is a second chance and a winner.
 */
export const playerCounts = [1, 2] as const
export type PlayerCount = (typeof playerCounts)[number]
/** One schema for the player count - commands and configuration validate against it. */
export const playerCountSchema = z.union(
  playerCounts.map((count) => z.literal(count)) as unknown as [z.ZodLiteral<PlayerCount>, z.ZodLiteral<PlayerCount>],
)

/**
 * Who drives the flow.
 *
 * `operated`      A human is in control: the operator opens the buzzer, logs
 *                 the answer, resolves and advances. This is how the stage runs.
 * `self-service`  Nobody is in control: the players tap their answer themselves,
 *                 the evaluation follows at once, and the transitions run
 *                 through the server's timed phases. This is how the touch
 *                 device runs.
 *
 * The profile is NOT a second state machine. The phases are the same in both
 * cases; the profile only decides who triggers a transition and which
 * transitions are scheduled automatically.
 */
export const flowProfiles = ['operated', 'self-service'] as const
export type FlowProfile = (typeof flowProfiles)[number]

export interface PlayerState {
  id: PlayerId
  label: string
  score: number
  /**
   * On normal questions a player is locked for exactly this question after a
   * wrong first answer. On image reveals nobody is ever locked.
   */
  lockedForCurrentQuestion: boolean
}

export interface BuzzerState {
  /** Does the server currently accept buzzer events? */
  open: boolean
  /** Player whose buzz was the first accepted as valid. */
  acceptedPlayerId?: PlayerId
  /** Server time of acceptance; serves the traceability of the order. */
  acceptedAtMs?: number
  /** How the active player was determined. */
  acceptedVia?: 'hardware' | 'manual'
}

export type AttemptOutcome = 'correct' | 'incorrect' | 'passed' | 'no-answer'

export interface AnswerAttempt {
  id: string
  questionId: string
  slotIndex: number
  /** `null` when resolved without a player answer. */
  playerId: PlayerId | null
  /** 1 = first attempt of this question, 2 = second, and so on. Unlimited on image reveals. */
  attemptNumber: number
  /** Option logged by the operator (only with `option-comparison`). */
  loggedOptionId?: string
  /** Manual verdict logged by the operator (only with `manual-correct-incorrect`). */
  loggedManualVerdict?: 'correct' | 'incorrect'
  outcome?: AttemptOutcome
  awardedPoints: number
  createdAtMs: number
  resolvedAtMs?: number
}

/**
 * Reveal clock of the image reveal (specification 10.2).
 *
 * Every display of the reveal is computed from the same progress variable. The
 * server holds only the start time, the time already elapsed and the pause
 * state; clients derive `progress` from that and render smoothly without
 * changing the state.
 */
export interface RevealClockState {
  status: 'idle' | 'running' | 'paused' | 'completed'
  durationMs: number
  /** Server time at which the current running section began. */
  startedAtServerMs?: number
  /** Time already elapsed before the current running section. */
  elapsedBeforeStartMs: number
}

/**
 * The request to play a video - and explicitly NOT a playback status.
 *
 * It says: "play the video of this question, from the start." It does not say
 * whether it is loaded, started, far along or finished; none of that is in the
 * server state, and nobody reports it back. The flow runs one way - desk,
 * server, stage - and ends there.
 *
 * IT LIVES IN THE STATE AND NOT IN AN EVENT. A fleeting event is missed by
 * whoever loses the connection at the wrong moment. A request in the snapshot
 * is still there after a reload, and a stage that joins just now executes it
 * exactly once.
 */
export interface VideoPlaybackRequest {
  /**
   * Question this request belongs to.
   *
   * This lets the stage recognise a request that does not belong to what it
   * currently shows - and leave it be instead of starting the wrong video.
   */
  questionId: string
  /**
   * Identity of THIS request. Every accepted click creates a new one.
   *
   * It is the whole mechanism: the same id means "already executed", a new id
   * means "start from second zero". So there is neither a confirmation nor a
   * status value.
   */
  requestId: string
  /** ISO timestamp of acceptance - for the log, not for the flow. */
  requestedAt: string
}

/** A question used in the game, including game-specific presentation data. */
export interface RuntimeQuestion {
  question: Question
  /** Slot it was drawn from. */
  slotId: string
  slotIndex: number
  /**
   * Visible order of the options for this game. Shuffling does not change the
   * evaluation because the comparison is always against `correctOptionId`.
   */
  optionOrder: string[]
}

/** Timed phase transition with a defined fallback time. */
export interface PendingTimedTransition {
  /** Phase to switch to when the time is up. */
  nextPhase: GamePhase
  /** Server time at which the switch happens at the latest. */
  endsAtMs: number
  /** Id for the presentation layer of the transition currently running. */
  transitionId: string
}

/** What the stage screen was last signalled by the rules. */
export interface PresentationTransitionState {
  transitionId: string
  startedAtServerMs: number
  durationMs: number
}

export interface GameState {
  gameId: string
  eventDayId: string
  status: 'active' | 'completed' | 'aborted'
  phase: GamePhase
  /** Incremented on every accepted state change (optimistic concurrency). */
  revision: number

  /**
   * The quiz type this game was started with.
   *
   * IT IS THE CONFIRMED CONFIGURATION: the server resolved audience, pools,
   * preset and theme from it and fixed them here. A reload or a resumed game
   * reads the same state and recomputes nothing.
   *
   * It is absent for games that begin without a quiz choice - at the kiosk
   * device, at the touch device and in states from older versions.
   */
  quizId?: string
  /** Audience of the game (formerly `quizModeId`). */
  audience: string
  /** Chosen question pools. If the field is missing, there is no pool filter. */
  poolIds?: string[]
  presetId: string
  /** Flow profile of the game. Fixed at the start and never changes. */
  flowProfile: FlowProfile
  totalQuestions: number
  currentSlotIndex: number
  /** Question ids already used in the game, including the current one. */
  selectedQuestionIds: string[]
  /** Repetition groups of the questions already used. */
  selectedRepetitionGroupIds: string[]
  currentQuestion?: RuntimeQuestion

  /**
   * One or two players, in fixed order (`player-1`, `player-2`).
   * The length is fixed at game start and does not change afterwards.
   */
  players: PlayerState[]
  buzzer: BuzzerState
  attempts: AnswerAttempt[]
  reveal?: RevealClockState
  video?: VideoPlaybackRequest

  /** Global sound status; kept during the game. */
  soundEnabled: boolean
  /**
   * Locale this game runs in.
   *
   * It is part of the game state and not only of the device: a resumed game
   * should continue in the language it was started in. If it is missing
   * (states from older versions), the base locale applies.
   */
  locale?: string

  /**
   * The joker of every player, keyed by player id (see `joker.ts`).
   *
   * ONE supply per player, spendable as a 50:50 or as an audience joker.
   *
   * ITS ABSENCE IS THE STATEMENT "this game has no jokers": only an operated
   * game gets a supply, and a self-service game at a kiosk or a touch device
   * therefore carries nothing here - as does a game saved before the feature
   * existed. Read it through `jokerOf` and ask `gameHasJokers(state)`; nothing
   * else decides whether this game knows jokers.
   */
  jokerByPlayer?: PlayerJokerStates

  /**
   * The draw currently running - it belongs to the CURRENT QUESTION.
   *
   * It sits on the game and not on the player because there is one shared
   * screen: the card flies across it, and the answers a 50:50 removes are gone
   * for everyone, even though the joker is charged to one player. The sequence
   * is set back to `idle` on every question change, while the spent joker above
   * survives until a new game starts.
   *
   * Optional for the same reason as `jokerByPlayer`: a game without jokers -
   * and a state saved before the feature existed - carries nothing here.
   */
  jokerSequence?: JokerSequence

  pendingTransition?: PendingTimedTransition
  lastTransition?: PresentationTransitionState
  updatedAtMs: number
}

/** Helper: does the question belong to the image reveal with unlimited attempts? */
export function isImageReveal(type: QuestionPresentationType): boolean {
  return type === 'image-reveal'
}
