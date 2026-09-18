/**
 * Central registry of all transition animations (specification 22.1).
 *
 * The domain only decides WHICH phase applies. This file decides which
 * animation, which duration, which easing and which sound cue belong to it.
 *
 * ADDING A NEW TRANSITION ANIMATION
 *   1. create the definition in the `transitions/` directory
 *   2. import it here and register it in `transitions`
 *   3. map the affected scene edge via `appliesTo`
 *   4. add `reducedMotionDurationMs`
 *   5. check it in the `/preview` development view
 *   6. update the visual regression test (test/e2e/presentation.spec.ts)
 */
import type { PublicScene } from '@hfroemmel/quiz-core'
import { prefersReducedMotion } from '../animationPresets'
import type { PresentationTransitionDefinition } from './types'
import { fadeThroughPause } from './fadeThrough'
import { questionEnter, revealEnter } from './questionEnter'
import { correctFeedback } from './correctFeedback'
import { incorrectFeedback } from './incorrectFeedback'
import { solutionReveal } from './solutionReveal'
import { resultCelebration } from './resultCelebration'

export const transitions: PresentationTransitionDefinition[] = [
  fadeThroughPause,
  questionEnter,
  revealEnter,
  correctFeedback,
  incorrectFeedback,
  solutionReveal,
  resultCelebration,
]

export const transitionsById = new Map(transitions.map((definition) => [definition.id, definition]))

/**
 * Picks the transition for a scene edge.
 *
 * The feedback scene has two variants; which one applies is decided by the
 * attempt's outcome - and that comes from the server state, not from the
 * presentation.
 */
export function transitionFor(
  from: PublicScene | undefined,
  to: PublicScene,
  variant?: 'correct' | 'incorrect',
): PresentationTransitionDefinition | undefined {
  if (to === 'feedback') return variant === 'correct' ? correctFeedback : incorrectFeedback
  return transitions.find(
    (definition) => definition.appliesTo.to === to && (definition.appliesTo.from === '*' || definition.appliesTo.from === from),
  )
}

/** Effective duration taking `prefers-reduced-motion` into account. */
export function effectiveDurationMs(definition: PresentationTransitionDefinition): number {
  return prefersReducedMotion() ? definition.reducedMotionDurationMs : definition.durationMs
}

/** CSS variables with which a scene parameterises its animation. */
export function transitionStyle(definition: PresentationTransitionDefinition | undefined): Record<string, string> {
  if (!definition) return {}
  return {
    '--transition-duration': `${effectiveDurationMs(definition)}ms`,
    '--transition-delay': `${definition.delayMs ?? 0}ms`,
    '--transition-easing': definition.easing,
  }
}
