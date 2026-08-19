/**
 * Assetkarte der Kinderquizwelt.
 *
 * EINZIGE STELLE mit Pfaden des Assetpakets. Keine Komponente schreibt einen
 * Pfad selbst; damit bleibt ein Austausch des Pakets eine Aenderung an einer
 * Datei.
 *
 * Die Boxen unter `boxes/` sind die ORIGINALPFADE des Entwurfs (aus `Boxes.svg`
 * geschnitten) und werden per 9-Slice skaliert - siehe `.kids-surface--slice`.
 * Drei Dateien sind abgeleitet, weil der Entwurf sie nicht enthaelt (der Weg
 * steht im README des Pakets): `answer-box-correct` (Papier -> Gruen),
 * `answer-box-incorrect` (Rot -> gedecktes Rot) und das lila Feld in
 * `chip-score-player2` (blaues Feld aus Spieler 1, verschoben, #B6B5D6).
 *
 * Die Dateien liegen unter `apps/web/public/assets/kinderquiz/` und werden
 * unveraendert mitgebaut. Sie kommen bewusst NICHT als Data-URI in den
 * JavaScript-Bundle: Der Browser soll sie einmal laden und danach aus dem Cache
 * nehmen, und ein ausgetauschtes Bild soll keinen neuen Bundle erzwingen.
 */
import type { AnswerVisualState } from './answerVisualState.ts'

const BASE = '/assets/kinderquiz'

/**
 * Jede Antwortzeile hat im Entwurf ihre EIGENE Zeichnung - die Konturen von
 * A bis D wackeln verschieden. Zeile B liegt nur als rote (gewaehlte) Fassung
 * vor; im Ruhezustand bekommt sie deshalb eine der Nachbarzeichnungen.
 */
const IDLE_BOX = ['a', 'd', 'c', 'd'] as const
const IDLE_BADGE = ['a', 'd', 'c', 'd'] as const

export const kidsAssets = {
  /** Dekorative Hintergrundszene, rechts zentriert, formatfuellend. */
  scene: `${BASE}/backgrounds/karlchen-quiz-scene-16x9.webp`,
  /** Sehr dezente Papierkoernung ueber der gesamten Flaeche. */
  paperGrain: `${BASE}/backgrounds/paper-grain.svg`,
  /** Karlchen in ganzer Figur (Vektor), rechte Spalte. */
  presenter: `${BASE}/characters/karlchen-presenter.svg`,
  /** Kleiner Karlchen, der ueber die Bildkante schaut (Vektor). */
  mini: `${BASE}/characters/karlchen-mini.svg`,
  characterShadow: `${BASE}/decorations/character-shadow.svg`,
  categoryUnderline: `${BASE}/decorations/category-underline.svg`,

  /**
   * Schrift des Pakets. Sie liegt neben den Bildern und wird nicht gebuendelt:
   * Nur so hat die Adresse eine feste Form, die `index.html` vorladen kann.
   * Die Ziffern- und Buchstabenschrift ist Melior und kommt aus dem regulaeren
   * Schriftbestand der Anwendung (`apps/web/src/styles.css`).
   */
  fonts: {
    hand: `${BASE}/fonts/PatrickHand-Regular.woff2`,
  },

  questionPanel: `${BASE}/boxes/panel-question.svg`,
  mediaFrame: `${BASE}/boxes/frame-portrait.svg`,
  questionCounter: `${BASE}/boxes/chip-question-counter.svg`,

  /**
   * Spielerkarten. Das farbige Feld liegt in beiden Zeichnungen LINKS;
   * gespiegelt wird der Inhalt, nicht die Grafik (siehe `PlayerScoreCard`).
   */
  score: {
    blue: `${BASE}/boxes/chip-score-player1.svg`,
    lavender: `${BASE}/boxes/chip-score-player2.svg`,
  },
} as const

/** Antwortflaeche fuer Zustand und Zeile - siehe `answerVisualState`. */
export function answerSurface(state: AnswerVisualState, index: number): string {
  if (state === 'selected') return `${BASE}/boxes/answer-box-b.svg`
  if (state === 'correct') return `${BASE}/boxes/answer-box-correct.svg`
  if (state === 'incorrect') return `${BASE}/boxes/answer-box-incorrect.svg`
  return `${BASE}/boxes/answer-box-${IDLE_BOX[index % IDLE_BOX.length]}.svg`
}

/** Buchstabenfeld: gelb fuer die gewaehlte Antwort, sonst Papier. */
export function answerBadge(state: AnswerVisualState, index: number): string {
  if (state === 'selected') return `${BASE}/boxes/badge-letter-b.svg`
  return `${BASE}/boxes/badge-letter-${IDLE_BADGE[index % IDLE_BADGE.length]}.svg`
}

/**
 * Bilder, die vor dem ersten Bild einer Show geladen sein sollen.
 *
 * Auf dem Buehnenscreen darf nichts nachladen, waehrend der Saal hinsieht.
 */
export const kidsPreloadImages: readonly string[] = [
  kidsAssets.scene,
  kidsAssets.presenter,
  kidsAssets.mini,
  kidsAssets.questionPanel,
  kidsAssets.mediaFrame,
  kidsAssets.questionCounter,
  kidsAssets.score.blue,
  kidsAssets.score.lavender,
  `${BASE}/boxes/answer-box-a.svg`,
  `${BASE}/boxes/answer-box-b.svg`,
  `${BASE}/boxes/answer-box-c.svg`,
  `${BASE}/boxes/answer-box-d.svg`,
  `${BASE}/boxes/answer-box-correct.svg`,
  `${BASE}/boxes/answer-box-incorrect.svg`,
  `${BASE}/boxes/badge-letter-a.svg`,
  `${BASE}/boxes/badge-letter-b.svg`,
  `${BASE}/boxes/badge-letter-c.svg`,
  `${BASE}/boxes/badge-letter-d.svg`,
]
