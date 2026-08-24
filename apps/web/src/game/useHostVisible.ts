/**
 * Ist die Seite, in der das Quiz laeuft, gerade sichtbar?
 *
 * WOFUER: Wechselt der Gastgeber in ein anderes Fenster oder einen anderen Tab,
 * soll das Quiz nicht weiter in den Raum klingen.
 *
 * GRENZE, die ehrlich benannt sein muss: Der Browser meldet nur den Wechsel von
 * Fenster oder Tab. Blendet eine Gastgeberanwendung das Quiz lediglich aus - etwa
 * mit `display: none` -, bleibt die Seite fuer den Browser sichtbar. Das
 * verlaessliche Mittel ist und bleibt deshalb das Entfernen der Komponente; dabei
 * wird alles abgeraeumt.
 */
import { useEffect, useState } from 'react'

export function useHostVisible(): boolean {
  const [visible, setVisible] = useState(() => typeof document === 'undefined' || !document.hidden)

  useEffect(() => {
    const update = () => setVisible(!document.hidden)
    document.addEventListener('visibilitychange', update)
    return () => document.removeEventListener('visibilitychange', update)
  }, [])

  return visible
}
