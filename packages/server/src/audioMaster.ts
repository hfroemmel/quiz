/**
 * Wer von allen verbundenen Clients den Ton ausgibt.
 *
 * Genau EINER klingt. Zwei Fenster mit derselben Soundmarke ergeben ein Echo,
 * das im Saal schlimmer ist als Stille - deshalb entscheidet der Server und nicht
 * der Client.
 *
 * DIE FREIGABE STEHT VOR DER ROLLE. Ein Browserfenster verweigert jede
 * Tonausgabe, solange dort nicht einmal geklickt oder getippt wurde. Die Buehne
 * ist genau das Fenster, das im Betrieb NIE angefasst wird: Bekaeme sie die
 * Tonhoheit trotzdem, bliebe die ganze Veranstaltung still, waehrend der Operator
 * daneben stumm geschaltet ist - ohne dass irgendwo ein Fehler zu sehen waere.
 *
 * In der Desktop-Anwendung ist die Wiedergabe von Anfang an erlaubt (siehe
 * `apps/desktop/src/main.ts`); dort meldet die Buehne sofort frei und behaelt die
 * Tonhoheit wie bisher. Und sobald in einer Buehne einmal geklickt wurde, holt
 * sie sich die Tonhoheit zurueck.
 */
import type { ClientRole } from '@quiz/contracts'

export interface AudioCandidate {
  role: ClientRole
  /** Der Client hat gemeldet, dass sein Fenster hoerbar Ton ausgeben darf. */
  audioReady: boolean
  isLocal: boolean
}

/**
 * Waehlt den Audio-Master.
 *
 * Reihenfolge: eine freigegebene Buehne, ein freigegebener Operator, eine
 * beliebige Buehne, ein beliebiger Operator. Innerhalb jeder Gruppe gewinnt der
 * lokale Client. Die beiden letzten Stufen greifen, solange noch nirgends
 * geklickt wurde - dann ist die Buehne die beste Vermutung.
 */
export function chooseAudioMaster<T extends AudioCandidate>(candidates: readonly T[]): T | undefined {
  const stages = candidates.filter((entry) => entry.role === 'stage')
  const operators = candidates.filter((entry) => entry.role === 'operator')
  const local = (pool: T[]): T | undefined => pool.find((entry) => entry.isLocal) ?? pool[0]
  const ready = (pool: T[]): T[] => pool.filter((entry) => entry.audioReady)
  return local(ready(stages)) ?? local(ready(operators)) ?? local(stages) ?? local(operators)
}
