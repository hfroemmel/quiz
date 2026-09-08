/**
 * Wann darf der Client das Videoelement anfassen?
 *
 * DAS ELEMENT IST DIE WAHRHEIT FUER DAS, WAS DER SAAL SIEHT. Der Server fuehrt
 * seine Position mit der Wanduhr: `positionMs + (jetzt - startedAtServerMs)`.
 * Eine Wiedergabe haelt da nie exakt mit - Laden, Dekodieren und ein zweites
 * Fenster auf demselben Rechner kosten Bruchteile von Sekunden, die sich
 * summieren. Wer bei jedem Schnappschuss auf die Serverposition springt, holt
 * sich fuer jeden dieser Bruchteile ein schwarzes Bild: Der Sprung setzt den
 * Dekoder zurueck, das Zuruecksetzen kostet Zeit, die Zeit vergroessert die
 * Abweichung - das ist das Flackern, und es wird schlimmer, je mehr Fenster um
 * denselben Dekoder konkurrieren.
 *
 * ANGEGLICHEN WIRD DESHALB NUR, WENN ES NICHTS ZU ZERSTOEREN GIBT:
 *   - Das Element laeuft nicht. Dann ist der Sprung unsichtbar - genau der Fall
 *     eines Fensters, das mitten im Video dazukommt.
 *   - Die Serverposition ist ZURUECKGEGANGEN. Waehrend einer durchlaufenden
 *     Wiedergabe kann sie das nicht; sie tut es nur, wenn jemand das Video von
 *     vorn gestartet hat. Dann ist der Sprung der Sinn der Sache.
 *
 * Ein Vorlauf des Servers bleibt dagegen unbeantwortet. Die Frage kommt ohnehin
 * zur Serverzeit - das Video wird dann um seinen Rueckstand beschnitten, und das
 * ist allemal besser als ein Bild, das im Sekundentakt schwarz wird.
 *
 * OHNE BROWSER PRUEFBAR: Deshalb steht die Entscheidung hier und nicht in der
 * Szene. Hinein gehen zwei Zahlen und zwei Wahrheitswerte, heraus kommt, was zu
 * tun ist.
 */
import type { PublicVideoState } from '@hfroemmel/quiz-core'

/** Was der Browser ueber sein Videoelement sagt. */
export interface Elementstand {
  positionMs: number
  paused: boolean
  /** Am Ende angekommen. `play()` wuerde hier von vorn beginnen. */
  ended: boolean
}

/** Was mit dem Element zu geschehen hat. */
export interface Videoangleich {
  /** Auf diese Stelle springen. `undefined` heisst: nicht anfassen. */
  springeNachMs?: number
  starten: boolean
  anhalten: boolean
}

/**
 * Toleranz beim Angleichen.
 *
 * Darunter ist ein Sprung kein Gewinn an Genauigkeit, sondern nur ein Ruckler:
 * Eine halbe Sekunde Versatz sieht niemand, ein zurueckgesetzter Dekoder schon.
 */
export const angleichToleranzMs = 600

export function videoangleich(
  server: Pick<PublicVideoState, 'status' | 'positionMs'>,
  element: Elementstand,
  zuletztGesehenePositionMs: number | undefined,
): Videoangleich {
  const laeuft = server.status === 'playing'

  // Ein Ruecksprung der Serverposition kann nur ein Neustart sein.
  const neuGestartet =
    zuletztGesehenePositionMs !== undefined && server.positionMs < zuletztGesehenePositionMs - angleichToleranzMs

  const abweichungMs = Math.abs(element.positionMs - server.positionMs)
  const angleichen = (element.paused || neuGestartet) && abweichungMs > angleichToleranzMs

  return {
    ...(angleichen ? { springeNachMs: server.positionMs } : {}),
    /*
     * Ein Element am Ende wird NICHT gestartet: `play()` spulte dort von selbst
     * zurueck und spielte das Video ein zweites Mal - waehrend der Server nur
     * noch auf seinen Nachlauf zur Frage wartet. Wird zugleich angeglichen,
     * hebt der Sprung das Ende auf, und gestartet wird wieder.
     */
    starten: laeuft && element.paused && (!element.ended || angleichen),
    anhalten: !laeuft && !element.paused,
  }
}

/**
 * Lohnt es sich, die gemessene Laufzeit zu melden?
 *
 * Die Meldung ist ein Befehl: Sie wird gespeichert, erhoeht die Revision und
 * geht an alle Clients. Ein zweites Fenster meldet dieselbe Zahl ein zweites Mal
 * - und mit jedem Neuaufbau des Elements kaeme sie erneut. Gemeldet wird
 * deshalb nur, was der Server noch nicht weiss.
 *
 * `Infinity` meldet ein Element, dessen Laenge nicht feststeht. Als Laufzeit
 * eingetragen, machte sie die Restzeitanzeige des Operators unbrauchbar und
 * legte den Uebergang zur Frage auf die Unendlichkeit.
 */
export function laufzeitMelden(bekannteMs: number | undefined, gemesseneMs: number): boolean {
  if (!Number.isFinite(gemesseneMs) || gemesseneMs <= 0) return false
  return bekannteMs === undefined || Math.abs(bekannteMs - gemesseneMs) > 250
}
