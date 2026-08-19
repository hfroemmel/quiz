/**
 * Sichtbarer Zustand einer Antwortzeile.
 *
 * EINZIGE ABLEITUNG. Die Kinderansicht fuehrt KEINEN eigenen Zustand: Sie
 * uebersetzt nur, was der Server ohnehin sendet. `PublicOption.state` und die
 * Szene reichen dafuer vollstaendig aus.
 *
 *   Serverzustand                          -> Darstellung
 *   ------------------------------------------------------------------
 *   state = 'chosen'                       -> selected   (rote Flaeche, gelber Chip)
 *   Loesungsszene, state = 'correct'       -> correct    (gruene Flaeche)
 *   Loesungsszene, alles uebrige           -> disabled   (Papier, zurueckgenommen)
 *   state = 'chosen-incorrect' (2. Chance) -> incorrect  (verbrauchte Antwort)
 *   sonst                                  -> idle
 *
 * Zur Loesungsszene: Dort traegt ausschliesslich die richtige Antwort Farbe -
 * dieselbe Regel wie auf der dunklen Buehne (`docs/screens.md`). Eine vorher
 * gewaehlte falsche Antwort tritt zurueck, statt ein zweites Mal markiert zu
 * werden.
 */
import type { PublicOption, PublicScene } from '@quiz/contracts'

export const answerVisualStates = ['idle', 'selected', 'correct', 'incorrect', 'disabled'] as const
export type AnswerVisualState = (typeof answerVisualStates)[number]

export function answerVisualState(option: PublicOption, scene: PublicScene): AnswerVisualState {
  if (scene === 'solution') return option.state === 'correct' ? 'correct' : 'disabled'
  if (option.state === 'chosen') return 'selected'
  // Bereits als falsch bewertet: in der zweiten Chance verbraucht.
  if (option.state === 'chosen-incorrect') return 'incorrect'
  return 'idle'
}
