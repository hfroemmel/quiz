/**
 * Richtig-Animation.
 *
 * ZUSAMMENSPIEL MIT DER LOESUNGSANZEIGE:
 * Der Server wechselt nach `gameTiming.correctFeedbackMs + gameTiming.solutionDelayMs`
 * automatisch in die Loesungsszene. Diese Animation ist deshalb genau so lang wie
 * `correctFeedbackMs` - laenger wuerde bedeuten, dass die Loesung erscheint, waehrend
 * die Animation noch laeuft.
 *
 * Wer die Dauer aendern will, aendert `gameTiming.correctFeedbackMs` in
 * `@quiz/contracts/config.ts`. Dann bleiben Anzeige und Zustandswechsel synchron.
 */
import { easings, presentationTiming } from '../animationPresets.ts'
import type { PresentationTransitionDefinition } from './types.ts'

export const correctFeedback: PresentationTransitionDefinition = {
  id: 'correct-feedback',
  description: 'Gelieferte Bewegtgrafik: Kreis waechst, Konfetti stiebt aus, Haken zeichnet sich; Punktestand zaehlt hoch.',
  appliesTo: { from: '*', to: 'feedback' },
  durationMs: presentationTiming.correctFeedbackMs,
  easing: easings.emphasized,
  reducedMotionDurationMs: 400,
  soundCueId: 'answer-correct',
  classNames: { active: 'feedback-correct', to: 'scene-enter' },
  locked:
    'Dauer entspricht gameTiming.correctFeedbackMs. Der Server beendet die Phase nach genau ' +
    'dieser Zeit; eine abweichende Dauer wuerde Anzeige und Spielzustand auseinanderlaufen lassen.',
}
