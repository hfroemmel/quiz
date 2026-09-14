/**
 * Entrance of a new question.
 *
 * Affects: the switch into the question, video and image-reveal scenes.
 * The question prompt (`question-prompt`) and answer tiles (`option-card`)
 * are animated; the tiles run in one after another with `optionStaggerMs`.
 *
 * Important: the buzzer being opened does NOT depend on this animation. The
 * server decides via `OPEN_BUZZER` when buzzing is allowed.
 */
import { easings, presentationTiming } from '../animationPresets'
import type { PresentationTransitionDefinition } from './types'

export const questionEnter: PresentationTransitionDefinition = {
  id: 'question-enter',
  description: 'Frage steigt leicht von unten ein, Antwortoptionen folgen versetzt.',
  appliesTo: { from: '*', to: 'question' },
  durationMs: 520,
  easing: easings.emphasized,
  reducedMotionDurationMs: 140,
  soundCueId: 'question-appear',
  classNames: { active: 'question-enter', to: 'scene-enter' },
}

export const revealEnter: PresentationTransitionDefinition = {
  id: 'reveal-enter',
  description: 'Bilderkennen: das verdeckte Bild blendet ein.',
  appliesTo: { from: '*', to: 'reveal' },
  durationMs: 420,
  easing: easings.standard,
  reducedMotionDurationMs: 120,
  soundCueId: 'question-appear',
  classNames: { active: 'reveal-enter', to: 'scene-enter' },
  locked:
    'Die Einblendung darf laufen, der Enthüllungsfortschritt selbst wird aber ausschließlich ' +
    'aus dem Serverzustand berechnet. Welche Kacheln offen sind, darf niemals aus dieser ' +
    'Animation abgeleitet werden.',
}

export const videoEnter: PresentationTransitionDefinition = {
  id: 'video-enter',
  description: 'Videophase: die Videofläche wächst aus der Mitte heraus und blendet ein.',
  appliesTo: { from: '*', to: 'video' },
  durationMs: 640,
  easing: easings.emphasized,
  reducedMotionDurationMs: 120,
  classNames: { active: 'video-enter', to: 'scene-enter' },
}
