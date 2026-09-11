/**
 * The joker - one per player, per live game.
 *
 * ONE SUPPLY, TWO WAYS TO SPEND IT. A player holds a single joker and decides
 * whether to spend it as a 50:50 or as an audience joker. The moment either one
 * is spent, that player has no joker left for the rest of the game - the other
 * variant included. That is why the state below is one union and not two flags:
 * two flags would let a game exist in which a player has "used the 50:50" and
 * "still has the audience joker", which is not a state this game has.
 *
 * TWO THINGS KEPT APART, because they have two lifetimes:
 *
 *   PlayerJokerState        Does this player still hold their joker, and if not,
 *                           how did they spend it? Permanent for the length of
 *                           one game, keyed by player id.
 *   ActiveFiftyFiftyEffect  What a 50:50 currently DOES to the question on
 *                           screen. Temporary: it dies with the question, while
 *                           the spent joker above survives until a new game.
 *
 * A single flag could not do both: it would either bring the hidden answers back
 * on the next question or keep the joker spendable for ever.
 *
 * This file is free of host knowledge: no transport, no React, no branch on
 * which application is running. Who may spend a joker is a matter of the command
 * roles (`commands.ts`), and only an operator may.
 */
import type { PlayerId } from './state'

/** The two ways a joker can be spent. */
export const jokerTypes = ['fiftyFifty', 'audience'] as const
export type JokerType = (typeof jokerTypes)[number]

/**
 * The joker of one player, for the length of one game.
 *
 * `usedAtQuestionId` and `usedAt` are not needed to play - they are the record
 * of when it happened, which the operator's log reads and which makes the
 * administrative reset honest: it drops the whole entry, not just a flag.
 * `usedAt` is an ISO timestamp so the record stays readable outside the running
 * process.
 */
export type PlayerJokerState =
  | { status: 'available' }
  | {
      status: 'used'
      type: JokerType
      /** The question it was spent on. `null` where none was on screen. */
      usedAtQuestionId: string | null
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

/**
 * The 50:50 effect on the CURRENT question.
 *
 * It carries the hidden option ids rather than a rule, because every client has
 * to show exactly the same answers. Were each client to draw "one wrong answer
 * to keep" from the same seed, a single differing build would put a different
 * pair on the stage screen than in the operator's preview.
 *
 * `questionId` is what makes a stale effect impossible to apply to a new
 * question: the projection compares it against the question actually on screen.
 */
export interface ActiveFiftyFiftyEffect {
  playerId: PlayerId
  questionId: string
  /**
   * Options hidden for this question.
   *
   * Named after `optionId` / `optionOrder` / `PublicOption`, which is what
   * answers are called everywhere else in this codebase.
   */
  hiddenOptionIds: string[]
}

/** Rules of the 50:50, in one place because tests and messages both need them. */
export const jokerRules = {
  /**
   * Below this many options the 50:50 has nothing to remove.
   *
   * With two options, removing one wrong answer would leave the correct answer
   * alone on screen - that is not a hint, that is the solution. Such a question
   * must not even consume the joker.
   */
  fiftyFiftyMinOptionCount: 3,
  /** How many wrong answers survive. Always exactly one, whatever the count. */
  fiftyFiftySurvivingIncorrectCount: 1,
} as const

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

/** German name of a variant, for the sentences an operator reads. */
export function jokerTypeLabel(type: JokerType): string {
  return type === 'fiftyFifty' ? '50:50-Joker' : 'Publikumsjoker'
}
