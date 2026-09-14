/**
 * State of an answer row - derived in exactly ONE place.
 *
 * The server sends the domain state (`PublicOption.state`) and the scene.
 * From that follows how the row looks. The derivation lives here and not in
 * the components, so the stage, the kids' world and the tests all read the
 * same truth.
 *
 * The names describe the CLAIM, not the look: how an `incorrect` is drawn in
 * each design world - dimmed grey on the stage, muted red in the kids' world
 * - is decided solely by the stylesheet.
 */
import type { PublicOption, PublicScene } from '@hfroemmel/quiz-core'

export const answerStates = ['idle', 'selected', 'correct', 'incorrect', 'disabled'] as const
export type AnswerState = (typeof answerStates)[number]

export function answerState(option: PublicOption, scene: PublicScene): AnswerState {
  /*
   * In the solution scene ONLY the correct answer carries colour. All others
   * step back uniformly - including the one a player had previously chosen.
   * Two highlighted rows would blur the scene's message.
   */
  if (scene === 'solution') return option.state === 'correct' ? 'correct' : 'disabled'
  if (option.state === 'chosen') return 'selected'
  // Outside the solution this means: used up in the second chance.
  if (option.state === 'chosen-incorrect') return 'incorrect'
  if (option.state === 'correct') return 'correct'
  return 'idle'
}

/**
 * Answer rows built from the server's options.
 *
 * The question and solution scenes build the same rows; the derivation
 * therefore lives here rather than being duplicated in both scenes.
 */
export function answerRows(options: PublicOption[], scene: PublicScene) {
  return options.map((option, index) => ({
    id: option.id,
    letter: optionLetter(index),
    text: option.text,
    state: answerState(option, scene),
    /*
     * Taken out of play by a 50:50. Kept apart from `state` on purpose: an
     * eliminated answer can still be the correct one, and in the solution scene
     * it is shown as both. It also keeps its POSITION - the row list does not
     * shrink, so the remaining answers do not jump under the players' eyes.
     */
    eliminated: option.eliminated === true,
  }))
}

/** Letter for a position: 0 becomes A. */
export function optionLetter(index: number): string {
  return String.fromCharCode(65 + index)
}
