/**
 * Zustand einer Antwortzeile - abgeleitet an genau EINER Stelle.
 *
 * Der Server sendet den fachlichen Zustand (`PublicOption.state`) und die Szene.
 * Daraus folgt, wie die Zeile aussieht. Die Ableitung steht hier und nicht in
 * den Komponenten, damit Buehne, Kinderwelt und Tests dieselbe Wahrheit lesen.
 *
 * Die Namen beschreiben die AUSSAGE, nicht das Aussehen: Wie ein `incorrect` in
 * der jeweiligen Gestaltungswelt gezeichnet wird - grau zurueckgenommen auf der
 * Buehne, gedeckt rot in der Kinderwelt -, entscheidet allein das Stylesheet.
 */
import type { PublicOption, PublicScene } from '@hfroemmel/quiz-core'

export const answerStates = ['idle', 'selected', 'correct', 'incorrect', 'disabled'] as const
export type AnswerState = (typeof answerStates)[number]

export function answerState(option: PublicOption, scene: PublicScene): AnswerState {
  /*
   * In der Loesungsszene traegt NUR die richtige Antwort Farbe. Alle uebrigen
   * treten gleichmaessig zurueck - auch die, die ein Spieler vorher gewaehlt
   * hatte. Zwei hervorgehobene Zeilen wuerden die Aussage der Szene aufweichen.
   */
  if (scene === 'solution') return option.state === 'correct' ? 'correct' : 'disabled'
  if (option.state === 'chosen') return 'selected'
  // Ausserhalb der Loesung heisst das: in der zweiten Chance verbraucht.
  if (option.state === 'chosen-incorrect') return 'incorrect'
  if (option.state === 'correct') return 'correct'
  return 'idle'
}

/**
 * Antwortzeilen aus den Optionen des Servers.
 *
 * Frage- und Loesungsszene bauen dieselben Zeilen; die Ableitung steht deshalb
 * hier und nicht zweimal in den Szenen.
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

/** Buchstabe zur Position: 0 wird zu A. */
export function optionLetter(index: number): string {
  return String.fromCharCode(65 + index)
}
