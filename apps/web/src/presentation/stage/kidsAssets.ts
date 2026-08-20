/**
 * Zeichnungen der Kinderwelt, die vor dem ersten Bild einer Show geladen sein
 * sollen.
 *
 * WARUM NUR EINE LISTE: Die Adressen selbst stehen in den Stylesheets der
 * Bauteile - dorthin gehoeren sie, denn welche Zeichnung ein Zustand traegt,
 * ist eine Frage der Gestaltung und keine des Markups. Hier steht nur, was der
 * Browser vorab holen soll: Auf dem Buehnenscreen darf waehrend der Show nichts
 * nachladen. Ein Chip, der erst beim Wechsel auf 'richtig' geholt wird, blitzt
 * vor dem Saal leer auf.
 */

const BASE = '/assets/kinderquiz'

export const kidsPreloadImages: readonly string[] = [
  `${BASE}/backgrounds/karlchen-quiz-scene-16x9.webp`,
  `${BASE}/backgrounds/paper-grain.svg`,
  `${BASE}/characters/karlchen-presenter.svg`,
  `${BASE}/characters/karlchen-mini.svg`,
  `${BASE}/boxes/panel-question.svg`,
  `${BASE}/boxes/frame-portrait.svg`,
  `${BASE}/boxes/chip-question-counter.svg`,
  `${BASE}/boxes/chip-score-player1.svg`,
  `${BASE}/boxes/chip-score-player2.svg`,
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
