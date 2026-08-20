/**
 * Helle oder dunkle Fassung der Buehne.
 *
 * WAS DAS IST UND WAS NICHT: Es ist eine Ansichtssache des Bedienenden, kein
 * Spielzustand. Der Server weiss nichts davon, es steht in keinem Snapshot und
 * es wird nicht uebertragen - jedes Fenster entscheidet fuer sich. Deshalb liegt
 * die Wahl im `localStorage` und nicht in der Zustandsmaschine.
 *
 * NUR DIE BUEHNE DER ERWACHSENEN kennt beide Fassungen. Die Kinderwelt ist eine
 * eigene Gestaltungswelt mit eigenem Papier und eigenen Zeichnungen; sie wird
 * vom Umschalter nicht beruehrt.
 */
import { useCallback, useEffect, useState } from 'react'

export const stageThemes = ['dark', 'bright'] as const
export type StageTheme = (typeof stageThemes)[number]

const STORAGE_KEY = 'quiz.stageTheme'
/** Die Buehne ist im Zweifel dunkel - so war sie von Anfang an gedacht. */
const FALLBACK: StageTheme = 'dark'

/*
 * Ein Wechsel gilt sofort in ALLEN Fenstern derselben Herkunft: Der Operator
 * schaltet in seiner Vorschau, der Beamer zieht nach. Das `storage`-Ereignis
 * erreicht nur fremde Fenster, deshalb zusaetzlich das eigene Ereignis.
 */
const CHANGE_EVENT = 'quiz:stage-theme'

function read(): StageTheme {
  const stored = window.localStorage.getItem(STORAGE_KEY)
  return stageThemes.includes(stored as StageTheme) ? (stored as StageTheme) : FALLBACK
}

export function useStageTheme(): [StageTheme, (next: StageTheme) => void] {
  const [theme, setTheme] = useState<StageTheme>(read)

  useEffect(() => {
    const sync = () => setTheme(read())
    window.addEventListener('storage', sync)
    window.addEventListener(CHANGE_EVENT, sync)
    return () => {
      window.removeEventListener('storage', sync)
      window.removeEventListener(CHANGE_EVENT, sync)
    }
  }, [])

  const choose = useCallback((next: StageTheme) => {
    window.localStorage.setItem(STORAGE_KEY, next)
    window.dispatchEvent(new Event(CHANGE_EVENT))
  }, [])

  return [theme, choose]
}
