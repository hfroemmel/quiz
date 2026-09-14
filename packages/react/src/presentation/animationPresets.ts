/**
 * Central timings and easings of the presentation layer (specification 22.5).
 *
 * NO MAGIC NUMBERS IN JSX: every duration, every delay and every easing lives
 * here or in a transition definition under `transitions/`.
 *
 * There are two kinds of values to distinguish:
 *
 *  1. DOMAIN-RELEVANT - comes from `@quiz/contracts` (`gameTiming`) and is used
 *     by the server to end phases. These values must NOT be overridden here,
 *     or the display and the game state drift apart. Affected: feedback
 *     duration, solution delay, reveal duration, pause screen.
 *
 *  2. PURELY VISUAL - defined only here. Changes are safe because no state
 *     transition depends on them.
 */
import { gameTiming } from '@hfroemmel/quiz-core'

export const presentationTiming = {
  /* --- domain-relevant: mirrored from gameTiming, do not change here --- */
  /** Duration of the correct animation. The server switches to the solution after this. */
  correctFeedbackMs: gameTiming.correctFeedbackMs,
  /** Duration of the incorrect animation. Followed by a second chance or the solution. */
  incorrectFeedbackMs: gameTiming.incorrectFeedbackMs,
  /** Short pause between feedback and the solution. */
  solutionDelayMs: gameTiming.solutionDelayMs,
  /** Confirmed ten seconds of the image reveal. Binding. */
  imageRevealDurationMs: gameTiming.imageRevealDurationMs,
  /** Duration of the pause screen between two questions. */
  pauseScreenMs: gameTiming.pauseScreenMs,

  /* --- purely visual: safe to adjust here --- */
  /** Cross-fade on a scene change. */
  sceneFadeMs: 400,
  /** Delay with which answer options run in one after another. */
  optionStaggerMs: 70,
  /** How long confetti runs on the result view. */
  resultConfettiMs: 6_000,
  /** Duration of the score count-up animation. */
  scoreCountUpMs: 600,

  /* --- the joker draw --- */
  /*
   * The durations of the flight and the turn do NOT live here but in
   * `jokerDrawTiming` in the core: the server schedules the reveal step from
   * them, and a client that joins mid-flight computes its position from them.
   * Only the times that concern the presentation alone live here.
   */
  /** How long an answer takes to step back after a 50:50. */
  jokerEliminateMs: 250,
  /** Offset with which several answers step back one after another. */
  jokerEliminateStaggerMs: 110,
  /** Cross-fade between the player number and the group marker. */
  jokerMarkerFadeMs: 200,
  /** Fading out the revealed card when the operator moves on. */
  jokerDismissMs: 200,
} as const

export const easings = {
  /**
   * The flight of the joker card: fast start, long calm settle. It should
   * look thrown, not shot.
   */
  jokerFlight: 'cubic-bezier(0.22, 1, 0.36, 1)',
  /** Default for fading in and out. */
  standard: 'cubic-bezier(0.22, 0.61, 0.36, 1)',
  /** Emphasises the entrance, e.g. for the correct animation. */
  emphasized: 'cubic-bezier(0.16, 1, 0.3, 1)',
  /** Short, hard settle for the incorrect animation. */
  sharp: 'cubic-bezier(0.4, 0, 0.6, 1)',
} as const

/*
 * The image reveal no longer has a value here: grid size, order and tile
 * fade live in `revealGrid` (`@quiz/contracts/config`), because they
 * determine WHAT a player sees when, and therefore belong to fairness - not
 * to decoration.
 */

/**
 * Reduced motion: user or system setting `prefers-reduced-motion`. Every
 * transition definition supplies its own, shorter duration for it.
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export type PresentationTiming = typeof presentationTiming
