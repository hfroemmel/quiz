/**
 * Neutrale Ueberblendung ueber den Pausen-/Logoscreen.
 *
 * Betrifft: jeden Wechsel in die Pausenszene und von dort in die naechste Frage.
 * Animiert wird der gesamte Szenencontainer (`scene-root`).
 *
 * Der Pausenscreen ist zwar eine eigene Praesentationsphase, aber KEINE zweite
 * Spielzustandslogik: Der Wechsel danach kommt vom Server, nicht von dieser Animation.
 */
import { easings, presentationTiming } from '../animationPresets'
import type { PresentationTransitionDefinition } from './types'

export const fadeThroughPause: PresentationTransitionDefinition = {
  id: 'fade-through-pause',
  description: 'Weiches Ausblenden der alten Szene, Logoscreen, weiches Einblenden der neuen Szene.',
  appliesTo: { from: '*', to: 'pause' },
  durationMs: presentationTiming.sceneFadeMs,
  easing: easings.standard,
  reducedMotionDurationMs: 120,
  soundCueId: 'scene-change',
  classNames: { from: 'scene-leave', active: 'scene-fade', to: 'scene-enter' },
}
