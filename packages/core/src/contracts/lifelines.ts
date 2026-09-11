/**
 * Lifelines - the "Joker" of the quiz, as state, configuration and rules.
 *
 * ONE FEATURE, THREE SEPARATE THINGS. Keeping them apart is what makes the
 * feature reusable across the live stage, the kiosk and any future host:
 *
 *   LifelineConfig     Does this INSTALLATION offer lifelines, which ones, and
 *                      who may trigger them? It belongs to the host, not to the
 *                      game: a device that offers no lifelines must not grow a
 *                      different game state, it simply never shows them.
 *   PlayerLifelines    Has this PLAYER already spent a given lifeline in THIS
 *                      game? Permanent for the length of one game, per player,
 *                      keyed by player id - never `player1FiftyFiftyUsed`.
 *   ActiveFiftyFiftyEffect
 *                      What the 50:50 currently DOES to the question on screen.
 *                      Temporary: it dies with the question, while the usage
 *                      above survives until a new game starts.
 *
 * The third one is the reason the first two cannot be merged. "Spent" and
 * "currently in effect" have different lifetimes, and a single flag would either
 * bring the hidden answers back on the next question or keep the lifeline
 * spendable forever.
 *
 * This file is deliberately free of any host knowledge: no `if (standalone)`,
 * no transport, no React. Everything here is data and pure decision.
 */
import type { PlayerId } from './state'

/**
 * The kinds of lifeline the system knows.
 *
 * Adding one means adding it here and teaching the engine what it does; the
 * per-player record, the configuration and every view model derive from this
 * list, so nothing has to be widened by hand.
 */
export const lifelineTypes = ['fiftyFifty', 'audience'] as const
export type LifelineType = (typeof lifelineTypes)[number]

/**
 * One lifeline of one player, for the length of one game.
 *
 * `usedAtQuestionId` and `usedAtMs` are not needed to play - they are the record
 * of WHEN it happened, which the operator's audit log and any later analysis
 * read. They also make the administrative restore honest: it clears the whole
 * entry, not just a flag.
 */
export interface LifelineUsage {
  used: boolean
  usedAtQuestionId?: string
  usedAtMs?: number
}

/** All lifelines of one player. Every known type has an entry, always. */
export type PlayerLifelines = Record<LifelineType, LifelineUsage>

/**
 * The 50:50 effect on the CURRENT question.
 *
 * It carries the hidden option ids rather than a rule, because every client has
 * to show exactly the same answers. Were each client to pick "one wrong answer
 * to keep" from the same seed, a single differing build would put a different
 * pair on the stage screen than in the operator's preview.
 *
 * `playerId` is who it is charged to, `questionId` is what it applies to. The
 * effect is visible to everyone on a shared stage - one screen, one question -
 * but it belongs to one player.
 */
export interface ActiveFiftyFiftyEffect {
  playerId: PlayerId
  questionId: string
  /**
   * Options that are hidden for this question.
   *
   * Named after `optionId` / `optionOrder` / `PublicOption`, which is what
   * answers are called everywhere else in this codebase.
   */
  hiddenOptionIds: string[]
}

/**
 * What an installation offers.
 *
 * `activationMode` is the whole difference between the live stage and a kiosk:
 * on stage the operator triggers a lifeline for a player who asked out loud, at
 * a kiosk the player would tap it themselves. It is NOT a second game rule -
 * the engine validates the same way in both cases; the mode only says whose
 * command is accepted.
 */
export interface LifelineConfig {
  enabled: boolean
  types: Record<LifelineType, boolean>
  activationMode: 'operator' | 'player'
}

/**
 * OFF BY DEFAULT, AND THAT IS THE POINT.
 *
 * A host that knows nothing about lifelines must behave exactly as before: no
 * dots, no commands, no layout change. Every integration opts in explicitly.
 */
export const defaultLifelineConfig: LifelineConfig = {
  enabled: false,
  types: { fiftyFifty: false, audience: false },
  activationMode: 'operator',
}

/** Rules of the 50:50, in one place because tests and UI both need them. */
export const lifelineRules = {
  /**
   * Below this many options the 50:50 has nothing to remove.
   *
   * With two options, removing one wrong answer would leave the correct answer
   * alone on screen - that is not a hint, that is the solution. Such a question
   * must not even consume the lifeline.
   */
  fiftyFiftyMinOptionCount: 3,
  /** How many wrong answers survive. Always exactly one, whatever the option count. */
  fiftyFiftySurvivingIncorrectCount: 1,
} as const

/**
 * Fill in what a host left out.
 *
 * Hosts hand in partial configuration - "enable the 50:50" and nothing else -
 * and every consumer needs a complete record. Note the guard: a config with
 * `enabled: true` but every type switched off is the same as no lifelines at
 * all, and is normalized to that so no consumer has to check twice.
 */
export function normalizeLifelineConfig(config?: Partial<LifelineConfig> | undefined): LifelineConfig {
  const types: Record<LifelineType, boolean> = {
    ...defaultLifelineConfig.types,
    ...(config?.types ?? {}),
  }
  const anyType = lifelineTypes.some((type) => types[type])
  return {
    enabled: (config?.enabled ?? defaultLifelineConfig.enabled) && anyType,
    types,
    activationMode: config?.activationMode ?? defaultLifelineConfig.activationMode,
  }
}

/** A fresh set for a player who is just entering a game: everything available. */
export function createPlayerLifelines(): PlayerLifelines {
  return { fiftyFifty: { used: false }, audience: { used: false } }
}

/**
 * The lifelines of a player, tolerant of states that predate the feature.
 *
 * A game saved before lifelines existed - or resumed from such a save after a
 * restart - has players without the field. Reading through this helper means a
 * resumed game does not crash and does not silently hand out spent lifelines.
 */
export function lifelinesOf(player: { lifelines?: PlayerLifelines }): PlayerLifelines {
  return { ...createPlayerLifelines(), ...(player.lifelines ?? {}) }
}

/** Is this type offered at all by the current installation? */
export function lifelineTypeEnabled(config: LifelineConfig, type: LifelineType): boolean {
  return config.enabled && config.types[type] === true
}

/** The types an installation offers, in the canonical order. */
export function enabledLifelineTypes(config: LifelineConfig): LifelineType[] {
  return config.enabled ? lifelineTypes.filter((type) => config.types[type]) : []
}
