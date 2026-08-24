/**
 * Leerlauf-Aufsicht am unbeaufsichtigten Geraet.
 *
 * WARUM: Auf einer Frage liegt bewusst kein Zeitdruck - wer nachdenkt, soll
 * nachdenken duerfen. Genau deshalb bleibt ein Geraet ohne Aufsicht mit einer
 * offenen Frage stehen, wenn die Spieler einfach weggehen. Die Aufsicht bricht
 * das Spiel dann ab und gibt die Auswahl frei.
 *
 * Sie haengt bewusst NICHT an einem globalen Listener: Als Gast in einer fremden
 * Anwendung darf die Ansicht nichts am Fenster registrieren. Beruehrungen meldet
 * die Komponente selbst ueber `notice`.
 */
import { useCallback, useEffect, useRef } from 'react'

export interface IdleWatch {
  /** Eine Beruehrung melden. Setzt die Frist zurueck. */
  notice: () => void
}

export function useIdleWatch(options: { timeoutMs?: number; active: boolean; onIdle: () => void }): IdleWatch {
  const { timeoutMs, active } = options
  const onIdleRef = useRef(options.onIdle)
  onIdleRef.current = options.onIdle

  const lastTouchRef = useRef(0)
  const notice = useCallback(() => {
    lastTouchRef.current = Date.now()
  }, [])

  useEffect(() => {
    if (!timeoutMs || !active) return
    lastTouchRef.current = Date.now()

    /*
     * Geprueft wird in kurzen Abstaenden statt mit einem einzelnen langen Timer.
     * Ein Timer, der bei jeder Beruehrung neu gesetzt wird, wuerde bei jedem
     * Fingertipp eine Neuberechnung ausloesen; hier genuegt ein Zeitstempel.
     */
    const interval = setInterval(() => {
      if (Date.now() - lastTouchRef.current < timeoutMs) return
      onIdleRef.current()
    }, Math.min(timeoutMs, 5_000))

    return () => clearInterval(interval)
  }, [timeoutMs, active])

  return { notice }
}
