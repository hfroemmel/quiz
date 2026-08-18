/**
 * Falsch-Animation.
 *
 * Nach einer falschen ERSTEN Antwort einer normalen Frage folgt bewusst NICHT die
 * Loesung, sondern die zweite Chance. Diese Animation darf deshalb nichts zeigen,
 * was auf die richtige Antwort schliessen laesst - der Server sendet die Loesung in
 * dieser Phase ohnehin nicht mit.
 *
 * Dauer entspricht `gameTiming.incorrectFeedbackMs`.
 */
import { easings, presentationTiming } from '../animationPresets.ts'
import type { PresentationTransitionDefinition } from './types.ts'

export const incorrectFeedback: PresentationTransitionDefinition = {
  id: 'incorrect-feedback',
  description: 'Kurzes rotes Ruetteln, kein Hinweis auf die richtige Antwort.',
  appliesTo: { from: '*', to: 'feedback' },
  durationMs: presentationTiming.incorrectFeedbackMs,
  easing: easings.sharp,
  reducedMotionDurationMs: 360,
  soundCueId: 'answer-incorrect',
  classNames: { active: 'feedback-incorrect', to: 'scene-enter' },
  locked:
    'Dauer entspricht gameTiming.incorrectFeedbackMs. Ausserdem darf diese Animation die Loesung ' +
    'nicht vorwegnehmen, weil nach dem ersten Fehlversuch die zweite Chance folgt.',
}
