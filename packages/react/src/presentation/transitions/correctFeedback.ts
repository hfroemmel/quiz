/**
 * Correct animation.
 *
 * INTERPLAY WITH THE SOLUTION DISPLAY:
 * The server automatically switches to the solution scene after
 * `gameTiming.correctFeedbackMs + gameTiming.solutionDelayMs`. This animation
 * is therefore exactly as long as `correctFeedbackMs` - longer would mean the
 * solution appears while the animation is still running.
 *
 * Anyone who wants to change the duration changes
 * `gameTiming.correctFeedbackMs` in `@quiz/contracts/config.ts`. That keeps
 * the display and the state change in sync.
 */
import { easings, presentationTiming } from '../animationPresets'
import type { PresentationTransitionDefinition } from './types'

export const correctFeedback: PresentationTransitionDefinition = {
  id: 'correct-feedback',
  description: 'Gelieferte Bewegtgrafik: Kreis wächst, Konfetti stiebt aus, Haken zeichnet sich; Punktestand zählt hoch.',
  appliesTo: { from: '*', to: 'feedback' },
  durationMs: presentationTiming.correctFeedbackMs,
  easing: easings.emphasized,
  reducedMotionDurationMs: 400,
  soundCueId: 'answer-correct',
  classNames: { active: 'feedback-correct', to: 'scene-enter' },
  locked:
    'Dauer entspricht gameTiming.correctFeedbackMs. Der Server beendet die Phase nach genau ' +
    'dieser Zeit; eine abweichende Dauer würde Anzeige und Spielzustand auseinanderlaufen lassen.',
}
