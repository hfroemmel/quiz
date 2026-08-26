/**
 * Auftritt der Loesungsansicht.
 *
 * Die richtige Option wird hervorgehoben, eine falsch genannte Option abgesetzt.
 * Beides stammt aus `visibleOptions[].state`, das der Server ERST in der
 * Loesungsszene mitsendet. Diese Animation deckt also nichts auf, was vorher schon
 * im Client gelegen haette.
 *
 * Beim Bilderkennen wird das Bild hier auf volle Schaerfe gebracht; der Zustand
 * `reveal.status === 'completed'` kommt ebenfalls vom Server.
 */
import { easings, presentationTiming } from '../animationPresets'
import type { PresentationTransitionDefinition } from './types'

export const solutionReveal: PresentationTransitionDefinition = {
  id: 'solution-reveal',
  description: 'Lösungskarte fährt auf, richtige Option leuchtet, Punktestände aktualisieren sich.',
  appliesTo: { from: '*', to: 'solution' },
  durationMs: 560,
  delayMs: presentationTiming.solutionDelayMs,
  easing: easings.emphasized,
  reducedMotionDurationMs: 160,
  soundCueId: 'solution',
  classNames: { active: 'solution-reveal', to: 'scene-enter' },
}
