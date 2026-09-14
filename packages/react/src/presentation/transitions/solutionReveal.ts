/**
 * Entrance of the solution view.
 *
 * The correct option is highlighted, an incorrectly named option is dimmed.
 * Both come from `visibleOptions[].state`, which the server sends ONLY in
 * the solution scene. This animation therefore reveals nothing that would
 * already have sat in the client beforehand.
 *
 * For the image reveal, the image is brought to full sharpness here; the
 * `reveal.status === 'completed'` state likewise comes from the server.
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
