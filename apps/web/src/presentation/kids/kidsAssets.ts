/**
 * Assetkarte der Kinderquizwelt.
 *
 * EINZIGE STELLE mit Pfaden des Assetpakets. Keine Komponente schreibt einen
 * Pfad selbst; damit bleibt ein Austausch des Pakets eine Aenderung an einer
 * Datei. Die Zuordnung folgt `implementation/asset-manifest.json` des Pakets.
 *
 * Die Dateien liegen unter `apps/web/public/assets/kinderquiz/` und werden
 * unveraendert mitgebaut. Sie kommen bewusst NICHT als Data-URI in den
 * JavaScript-Bundle: Der Browser soll sie einmal laden und danach aus dem Cache
 * nehmen, und ein ausgetauschtes Bild soll keinen neuen Bundle erzwingen.
 */

const BASE = '/assets/kinderquiz'

export const kidsAssets = {
  /** Dekorative Hintergrundszene, rechts zentriert, formatfuellend. */
  scene: `${BASE}/backgrounds/karlchen-quiz-scene-16x9.webp`,
  /** Sehr dezente Papierkoernung ueber der gesamten Flaeche. */
  paperGrain: `${BASE}/backgrounds/paper-grain.svg`,
  /** Karlchen in ganzer Figur, rechte Spalte. */
  presenter: `${BASE}/characters/karlchen-presenter.png`,
  /** Kleiner Karlchen, der ueber die Bildkante schaut. */
  mini: `${BASE}/characters/karlchen-mini.png`,
  characterShadow: `${BASE}/decorations/character-shadow.svg`,
  categoryUnderline: `${BASE}/decorations/category-underline.svg`,

  /**
   * Schriften des Pakets. Sie liegen neben den Bildern und werden nicht
   * gebuendelt: Nur so hat die Adresse eine feste Form, die `index.html`
   * vorladen kann, ohne den Bundlernamen zu kennen.
   */
  fonts: {
    hand: `${BASE}/fonts/PatrickHand-Regular.woff2`,
    numeric: `${BASE}/fonts/Fredoka-Bold.woff2`,
  },

  questionPanel: `${BASE}/frames/question-panel.svg`,
  mediaFrame: `${BASE}/frames/media-frame.svg`,
  questionCounter: `${BASE}/frames/question-counter.svg`,

  /**
   * Spielerkarten. Die farbige Haelfte liegt in der Zeichnung immer LINKS;
   * gespiegelt wird der Inhalt, nicht die Grafik (siehe `PlayerScoreCard`).
   */
  score: {
    blue: { active: `${BASE}/frames/score-player-blue.svg`, idle: `${BASE}/frames/score-player-blue-idle.svg` },
    lavender: {
      active: `${BASE}/frames/score-player-lavender-active.svg`,
      idle: `${BASE}/frames/score-player-lavender.svg`,
    },
  },

  /** Antwortflaechen je Zustand - siehe `answerVisualState`. */
  answer: {
    idle: `${BASE}/frames/answer-default.svg`,
    selected: `${BASE}/frames/answer-selected.svg`,
    correct: `${BASE}/frames/answer-correct.svg`,
    incorrect: `${BASE}/frames/answer-incorrect.svg`,
    disabled: `${BASE}/frames/answer-default.svg`,
  },
  /** Buchstabenchips A-D, gleiche Zustandsnamen wie die Flaechen. */
  chip: {
    idle: `${BASE}/chips/answer-neutral.svg`,
    selected: `${BASE}/chips/answer-active.svg`,
    correct: `${BASE}/chips/answer-correct.svg`,
    incorrect: `${BASE}/chips/answer-incorrect.svg`,
    disabled: `${BASE}/chips/answer-neutral.svg`,
  },
} as const

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
  kidsAssets.answer.idle,
  kidsAssets.answer.selected,
  kidsAssets.answer.correct,
  kidsAssets.answer.incorrect,
  kidsAssets.chip.idle,
  kidsAssets.chip.selected,
  kidsAssets.chip.correct,
  kidsAssets.chip.incorrect,
]
