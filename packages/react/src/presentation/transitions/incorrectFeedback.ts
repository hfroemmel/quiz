/**
 * Incorrect animation.
 *
 * After a FIRST wrong answer to a normal question, the solution deliberately
 * does NOT follow - the second chance does. This animation must therefore
 * show nothing that would allow the correct answer to be inferred - the
 * server does not send the solution during this phase anyway.
 *
 * Duration matches `gameTiming.incorrectFeedbackMs`.
 */
import { easings, presentationTiming } from '../animationPresets'
import type { PresentationTransitionDefinition } from './types'

export const incorrectFeedback: PresentationTransitionDefinition = {
  id: 'incorrect-feedback',
  description: 'Gelieferte Bewegtgrafik: Kreis wächst mit Ringimpuls, zwei Striche drehen sich zum Kreuz.',
  appliesTo: { from: '*', to: 'feedback' },
  durationMs: presentationTiming.incorrectFeedbackMs,
  easing: easings.sharp,
  reducedMotionDurationMs: 360,
  soundCueId: 'answer-incorrect',
  classNames: { active: 'feedback-incorrect', to: 'scene-enter' },
  locked:
    'Dauer entspricht gameTiming.incorrectFeedbackMs. Außerdem darf diese Animation die Lösung ' +
    'nicht vorwegnehmen, weil nach dem ersten Fehlversuch die zweite Chance folgt.',
}
