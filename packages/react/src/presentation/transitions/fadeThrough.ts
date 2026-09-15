/**
 * Neutral cross-fade over the pause/logo screen.
 *
 * Affects: every switch into the pause scene and from there into the next
 * question. The whole scene container (`scene-root`) is animated.
 *
 * The pause screen is indeed its own presentation phase, but NOT a second
 * game-state logic: the switch afterwards comes from the server, not from
 * this animation.
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
