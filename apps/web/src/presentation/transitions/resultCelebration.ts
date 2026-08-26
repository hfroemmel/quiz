/**
 * Ergebnisansicht mit Konfetti.
 *
 * Konfetti laeuft nur, wenn es einen Gewinner gibt. Bei Unentschieden bleibt die
 * Ansicht ruhig - eine Feier waere in dem Fall irrefuehrend.
 *
 * Das Konfetti ist reine Darstellung: Es beeinflusst weder das Ergebnis noch die
 * weiterhin moegliche manuelle Punktkorrektur.
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

/** Wie lange das Konfetti laeuft. Rein visuell. */
export const confettiDurationMs = presentationTiming.resultConfettiMs
