/**
 * The joker - one per player, per live game, DRAWN rather than chosen.
 *
 * A player who has buzzed asks for their joker; the operator draws it, and the
 * SERVER decides by coin flip whether it becomes a 50:50 or an audience joker.
 * Nobody picks the variant - not the player, not the operator, and least of all
 * a client. That is the whole point of the draw: a choice would be a tactical
 * decision, a draw is a moment.
 *
 * THREE THINGS KEPT APART, because they have three lifetimes:
 *
 *   PlayerJokerState   Does this player still hold their joker, and if not, how
 *                      did it come out? Permanent for the length of one game,
 *                      keyed by player id.
 *   JokerSequence      The draw as it RUNS: flying, revealed, applied. One at a
 *                      time in the whole game, because there is one shared
 *                      screen it happens on.
 *   eliminatedOptionIds (inside the sequence) What a 50:50 does to the question
 *                      on screen. Dies with the question, while the spent joker
 *                      above survives until a new game.
 *
 * A single flag could not do any two of those: it would either bring the
 * eliminated answers back on the next question or keep the joker drawable for
 * ever.
 *
 * This file is free of host knowledge: no transport, no React, no branch on
 * which application is running. Who may draw is a matter of the command roles
 * (`commands.ts`), and only an operator may.
 */
import type { PlayerId } from './state'

/** The two ways a drawn joker can come out. */
export const jokerTypes = ['fiftyFifty', 'audience'] as const
export type JokerType = (typeof jokerTypes)[number]

/**
 * The joker of one player, for the length of one game.
 *
 * `usedAtQuestionId` and `usedAt` are not needed to play - they are the record
 * of when it happened, which the operator's log reads. `usedAt` is an ISO
 * timestamp so the record stays readable outside the running process.
 *
 * THE STATUS FLIPS WHEN THE DRAW STARTS, not when it is applied. A draw cannot
 * be taken back, so a joker that is in the air is already spent; anything else
 * would let a reload during the flight hand it back.
 */
export type PlayerJokerState =
  | { status: 'available' }
  | {
      status: 'used'
      type: JokerType
      /** The question it was drawn on. */
      usedAtQuestionId: string
      usedAt: string
    }

/**
 * Keyed by player id - never `player1Joker` and `player2Joker`.
 *
 * PARTIAL, because a solo game has one player: the record holds an entry per
 * player of THIS game and nothing for a player who is not playing. Read it
 * through `jokerOf`, which turns a missing entry into an available joker.
 */
export type PlayerJokerStates = Partial<Record<PlayerId, PlayerJokerState>>

/** What every phase of a running draw carries. */
interface JokerSequenceBase {
  /**
   * Identity of THIS draw.
   *
   * It is what makes a late `CONTINUE_JOKER` harmless: a client that was
   * looking at the previous draw sends the previous id, and the server refuses
   * it instead of skipping a step of the current one.
   */
  sequenceId: string
  playerId: PlayerId
  questionId: string
  /** Drawn once, on the server, before anything is written. */
  type: JokerType
  /** ISO timestamp of the draw - the clients resume the flight against it. */
  startedAt: string
  /**
   * What a 50:50 will remove, drawn together with the type and stored from the
   * first moment. Absent for an audience joker.
   *
   * IT IS DECIDED BEFORE IT IS VISIBLE: the ids exist during `drawing` and
   * `revealed` already, but the projection only transmits them once the
   * sequence is `applied`. A reload mid-flight therefore cannot re-draw them,
   * and no client can read the outcome off the wire ahead of the reveal.
   */
  eliminatedOptionIds?: string[]
}

/**
 * The draw as a state machine - the server owns every step.
 *
 *   idle → drawing → revealed → applied → idle (next question)
 *
 * `drawing` is the flight and the card turn, `revealed` the card standing in
 * the middle waiting for the operator, `applied` the effect on the question.
 * The clients render the phase; they never advance it themselves.
 */
export type JokerSequence =
  | { phase: 'idle' }
  | ({ phase: 'drawing' } & JokerSequenceBase)
  | ({ phase: 'revealed' } & JokerSequenceBase)
  | ({ phase: 'applied' } & JokerSequenceBase)

/** A running draw - every phase but `idle`. */
export type ActiveJokerSequence = Extract<JokerSequence, { sequenceId: string }>

/** Rules of the draw, in one place because tests and messages both need them. */
export const jokerRules = {
  /**
   * Below this many options a 50:50 has nothing to remove.
   *
   * With two options, removing one wrong answer would leave the correct answer
   * alone on screen - that is not a hint, that is the solution. And because the
   * DRAW can come out either way, such a question must not even be drawable:
   * the alternative would be to discover it after the coin flip and hand a
   * player an audience joker because their question was unsuitable.
   */
  fiftyFiftyMinOptionCount: 3,
  /** How many wrong answers survive. Always exactly one, whatever the count. */
  fiftyFiftySurvivingIncorrectCount: 1,
} as const

/**
 * How long the draw runs on screen, in milliseconds.
 *
 * SHARED, because three parties need the same numbers: the stage animates
 * against them, a client that reconnects mid-flight computes its position in
 * them, and the tests assert on them. They live in the core and not in a
 * stylesheet for that reason - a stylesheet cannot be read by the server.
 */
export const jokerDrawTiming = {
  /** Overlay fades in, the small card leaves the scoreboard. */
  liftOffMs: 120,
  /** Flight from the scoreboard to the middle of the screen. */
  flightMs: 580,
  /** Short overshoot and settle once the middle is reached. */
  settleMs: 120,
  /**
   * The card turning on its vertical axis - AFTER the server has revealed the
   * variant, because that is what the back of the card shows.
   */
  flipMs: 680,
} as const

/**
 * When the card is in the middle and the variant may be told, counted from
 * `startedAt`.
 *
 * THE TURN COMES AFTER THIS, not before. The clients do not learn what was
 * drawn while the card is flying (see `projection.ts`) - and a card that
 * started turning before the variant arrived would show an empty back. So the
 * server holds `drawing` exactly as long as the flight takes, and the turn
 * begins with the snapshot that carries the result.
 */
export const jokerRevealAtMs =
  jokerDrawTiming.liftOffMs + jokerDrawTiming.flightMs + jokerDrawTiming.settleMs

/** A fresh supply: every player of a new game holds their joker. */
export function createJokerStates(playerIds: readonly PlayerId[]): PlayerJokerStates {
  return Object.fromEntries(playerIds.map((id) => [id, { status: 'available' } as const]))
}

/**
 * The joker of one player, tolerant of states that predate the feature.
 *
 * A game saved before jokers existed - or resumed from such a save after a
 * restart - has no such record. Reading through this helper means a resumed game
 * does not crash and does not silently hand out a spent joker.
 */
export function jokerOf(
  jokerByPlayer: PlayerJokerStates | undefined,
  playerId: PlayerId,
): PlayerJokerState {
  return jokerByPlayer?.[playerId] ?? { status: 'available' }
}

/** The running draw, or `undefined` while none runs. */
export function activeJokerSequence(sequence: JokerSequence | undefined): ActiveJokerSequence | undefined {
  return sequence && sequence.phase !== 'idle' ? sequence : undefined
}

/** German name of a variant, for the sentences an operator and the room read. */
export function jokerTypeLabel(type: JokerType): string {
  return type === 'fiftyFifty' ? '50:50-Joker' : 'Publikumsjoker'
}
