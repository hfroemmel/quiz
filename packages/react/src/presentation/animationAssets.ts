/**
 * Registry of the delivered motion graphics (specification 22, design
 * addendum).
 *
 * These files are designed supplies, not shapes drawn in code. They exist as
 * VP9 WebM with an alpha channel and are bundled via Vite - that makes them
 * part of the build and lets them work without a network.
 *
 * WHY A REGISTRY:
 * Every file brings two timings that need to be known in order to use it
 * correctly:
 *
 *   `durationMs`  Total length of the file, including the still frame at the end.
 *   `payoffMs`    Point in time at which the statement is fully visible
 *                 (checkmark fully drawn, cross fully drawn).
 *
 * A phase that shows one of these graphics has to run at least until
 * `payoffMs`. Otherwise the state change cuts into the middle of the
 * statement. That is why the value lives here and not as a comment in a
 * component.
 */
import correctClip from '../assets/animations/correct.webm'
import wrongClip from '../assets/animations/wrong.webm'
import trophyClip from '../assets/animations/trophy.webm'
import starsClip from '../assets/animations/stars.webm'
import questionMarksClip from '../assets/animations/question-marks.webm'
import confettiSvg from '../assets/animations/confetti.svg'

export interface AnimationClipAsset {
  id: string
  url: string
  /** Total length of the file in milliseconds. */
  durationMs: number
  /** Point in time from which the statement is fully visible. */
  payoffMs: number
  /** Edge length of the square source in pixels. */
  sourceSizePx: number
  description: string
}

export const animationClips = {
  correct: {
    id: 'correct',
    url: correctClip,
    durationMs: 4_000,
    payoffMs: 1_400,
    sourceSizePx: 500,
    description: 'Türkiser Kreis wächst, Konfetti stiebt aus, Haken zeichnet sich.',
  },
  wrong: {
    id: 'wrong',
    url: wrongClip,
    durationMs: 2_000,
    payoffMs: 1_400,
    sourceSizePx: 500,
    description: 'Roter Kreis wächst mit Ringimpuls, zwei Striche drehen sich zum Kreuz.',
  },
  trophy: {
    id: 'trophy',
    url: trophyClip,
    durationMs: 2_000,
    payoffMs: 1_300,
    sourceSizePx: 500,
    description: 'Pokal, in dem sich eine Medaille bildet.',
  },
  stars: {
    id: 'stars',
    url: starsClip,
    durationMs: 1_000,
    payoffMs: 600,
    sourceSizePx: 500,
    description: 'Gelber Impuls, der in Sterne zerfällt.',
  },
  'question-marks': {
    id: 'question-marks',
    url: questionMarksClip,
    durationMs: 1_500,
    payoffMs: 800,
    sourceSizePx: 500,
    description: 'Drei Fragezeichen in Blautönen, die nacheinander einsetzen.',
  },
} as const satisfies Record<string, AnimationClipAsset>

export type AnimationClipId = keyof typeof animationClips

/** Confetti exists as an animated SVG and runs without a video decoder. */
export const confettiOverlayUrl: string = confettiSvg
