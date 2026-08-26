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
 *
 * Die Eintraege sind bundlerneutral als `new URL(..., import.meta.url)`
 * adressiert - dieselben Dateien, die auch die Stylesheets emittieren lassen.
 */

export const kidsPreloadImages: readonly string[] = [
  new URL('../../assets/kinderquiz/backgrounds/karlchen-quiz-scene-16x9.webp', import.meta.url).href,
  new URL('../../assets/kinderquiz/backgrounds/paper-grain.svg', import.meta.url).href,
  new URL('../../assets/kinderquiz/characters/karlchen-presenter.svg', import.meta.url).href,
  new URL('../../assets/kinderquiz/characters/karlchen-mini.svg', import.meta.url).href,
  new URL('../../assets/kinderquiz/boxes/panel-question.svg', import.meta.url).href,
  new URL('../../assets/kinderquiz/boxes/frame-portrait.svg', import.meta.url).href,
  new URL('../../assets/kinderquiz/boxes/chip-question-counter.svg', import.meta.url).href,
  new URL('../../assets/kinderquiz/boxes/chip-score-player1.svg', import.meta.url).href,
  new URL('../../assets/kinderquiz/boxes/chip-score-player2.svg', import.meta.url).href,
  new URL('../../assets/kinderquiz/boxes/answer-box-a.svg', import.meta.url).href,
  new URL('../../assets/kinderquiz/boxes/answer-box-b.svg', import.meta.url).href,
  new URL('../../assets/kinderquiz/boxes/answer-box-c.svg', import.meta.url).href,
  new URL('../../assets/kinderquiz/boxes/answer-box-d.svg', import.meta.url).href,
  new URL('../../assets/kinderquiz/boxes/answer-box-correct.svg', import.meta.url).href,
  new URL('../../assets/kinderquiz/boxes/answer-box-incorrect.svg', import.meta.url).href,
  new URL('../../assets/kinderquiz/boxes/badge-letter-a.svg', import.meta.url).href,
  new URL('../../assets/kinderquiz/boxes/badge-letter-b.svg', import.meta.url).href,
  new URL('../../assets/kinderquiz/boxes/badge-letter-c.svg', import.meta.url).href,
  new URL('../../assets/kinderquiz/boxes/badge-letter-d.svg', import.meta.url).href,
]
