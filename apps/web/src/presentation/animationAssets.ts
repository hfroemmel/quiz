/**
 * Registry der gelieferten Bewegtgrafiken (Spezifikation 22, Designergaenzung).
 *
 * Diese Dateien sind gestaltete Zulieferung, keine im Code gezeichneten Formen.
 * Sie liegen als VP9-WebM mit Alphakanal vor und werden ueber Vite gebuendelt -
 * damit sind sie Teil des Builds und funktionieren ohne Netzwerk.
 *
 * WARUM EINE REGISTRY:
 * Jede Datei bringt zwei Zeiten mit, die man kennen muss, um sie richtig
 * einzusetzen:
 *
 *   `durationMs`  Gesamtlaenge der Datei, inklusive Standbild am Ende.
 *   `payoffMs`    Zeitpunkt, an dem die Aussage vollstaendig zu sehen ist
 *                 (Haken fertig gezeichnet, Kreuz fertig gezeichnet).
 *
 * Eine Phase, die eine dieser Grafiken zeigt, muss mindestens bis `payoffMs`
 * laufen. Sonst schneidet der Zustandswechsel mitten in die Aussage hinein.
 * Deshalb steht der Wert hier und nicht als Kommentar in einer Komponente.
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
  /** Gesamtlaenge der Datei in Millisekunden. */
  durationMs: number
  /** Zeitpunkt, ab dem die Aussage vollstaendig sichtbar ist. */
  payoffMs: number
  /** Kantenlaenge der quadratischen Quelle in Bildpunkten. */
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
    description: 'Tuerkiser Kreis waechst, Konfetti stiebt aus, Haken zeichnet sich.',
  },
  wrong: {
    id: 'wrong',
    url: wrongClip,
    durationMs: 2_000,
    payoffMs: 1_400,
    sourceSizePx: 500,
    description: 'Roter Kreis waechst mit Ringimpuls, zwei Striche drehen sich zum Kreuz.',
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
    description: 'Gelber Impuls, der in Sterne zerfaellt.',
  },
  'question-marks': {
    id: 'question-marks',
    url: questionMarksClip,
    durationMs: 1_500,
    payoffMs: 800,
    sourceSizePx: 500,
    description: 'Drei Fragezeichen in Blautoenen, die nacheinander einsetzen.',
  },
} as const satisfies Record<string, AnimationClipAsset>

export type AnimationClipId = keyof typeof animationClips

/** Konfetti liegt als animiertes SVG vor und laeuft ohne Videodekoder. */
export const confettiOverlayUrl: string = confettiSvg
