/**
 * Result view with confetti.
 *
 * Confetti only runs when there is a winner. On a draw the view stays calm -
 * a celebration would be misleading in that case.
 *
 * The confetti is purely presentational: it influences neither the result
 * nor the manual score correction that remains possible.
 */
import { easings, presentationTiming } from '../animationPresets'
import type { PresentationTransitionDefinition } from './types'

export const resultCelebration: PresentationTransitionDefinition = {
  id: 'result-celebration',
  description: 'Endstand skaliert ein, Konfetti bei einem Gewinner.',
  appliesTo: { from: '*', to: 'result' },
  durationMs: 700,
  easing: easings.emphasized,
  reducedMotionDurationMs: 200,
  soundCueId: 'result',
  classNames: { active: 'result-celebration', to: 'scene-enter' },
}

/** How long the confetti runs. Purely visual. */
export const confettiDurationMs = presentationTiming.resultConfettiMs
