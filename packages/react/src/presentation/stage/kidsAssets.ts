/**
 * Kids' world artwork that should be loaded before a show's first image.
 *
 * WHY JUST A LIST: the URLs themselves live in the components' stylesheets -
 * that is where they belong, because which drawing a state carries is a
 * design question, not a markup one. This only states what the browser
 * should fetch ahead of time: nothing may load lazily on the stage screen
 * during the show. A chip only fetched on switching to 'richtig' would flash
 * up blank in front of the room.
 *
 * The entries are addressed bundler-neutrally as `new URL(..., import.meta.url)`
 * - the same files the stylesheets also cause to be emitted.
 */

export const kidsPreloadImages: readonly string[] = [
  new URL('../../assets/kinderquiz/backgrounds/background.webp', import.meta.url).href,
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
