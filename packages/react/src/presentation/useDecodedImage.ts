/**
 * Ist dieses Bild fertig geladen?
 *
 * WOFUER: Der unscharfe Bildgrund der Buehne soll erscheinen, wenn er fertig
 * ist - nicht davor und nicht als Rest der vorigen Frage. Ein
 * `background-image`, das direkt gesetzt wird, laesst den alten Grund stehen,
 * bis der neue dekodiert ist: Auf der neuen Frage stuende dann fuer einen
 * Moment das Bild der alten.
 *
 * Deshalb wird die Adresse hier ZUERST geladen und erst danach gemeldet. Der
 * Spielablauf wartet nicht darauf - die Frage steht sofort; nur ihr Grund kommt
 * einen Wimpernschlag spaeter dazu.
 *
 * Die Entscheidung selbst ist eine reine Funktion (`bildstand`), damit sie ohne
 * Browser pruefbar ist.
 */
import { useEffect, useState } from 'react'

/** Was der Aufrufer wissen muss: welche Adresse fertig ist. */
export interface Bildstand {
  /** Die Adresse, die geladen wurde - `undefined`, solange keine fertig ist. */
  fertig: string | undefined
}

/**
 * Der neue Stand, nachdem `geladen` fertig geworden ist.
 *
 * Eine Meldung, die nicht mehr zur aktuellen Adresse gehoert, wird verworfen:
 * Bei schnellem Weiterklicken kommen die Bilder in beliebiger Reihenfolge
 * zurueck, und das zuletzt eingetroffene ist nicht das zuletzt gefragte.
 */
export function bildstand(vorher: Bildstand, gefragt: string | undefined, geladen: string): Bildstand {
  if (geladen !== gefragt) return vorher
  if (vorher.fertig === geladen) return vorher
  return { fertig: geladen }
}

export function useDecodedImage(url: string | undefined): string | undefined {
  const [stand, setStand] = useState<Bildstand>({ fertig: undefined })

  useEffect(() => {
    if (!url) {
      setStand({ fertig: undefined })
      return undefined
    }

    let aufgegeben = false
    const melden = () => {
      if (!aufgegeben) setStand((vorher) => bildstand(vorher, url, url))
    }

    const bild = new Image()
    bild.src = url
    /*
     * `decode()` wartet nicht nur auf die Bytes, sondern auch auf das
     * Auspacken - ein `onload` allein kann noch einen Ruckler beim ersten
     * Zeichnen bedeuten. Wo es fehlt oder scheitert (Firefox meldet fuer
     * manche Bilder einen Fehler, obwohl sie brauchbar sind), gilt `onload`.
     */
    if (bild.decode) {
      void bild.decode().then(melden, melden)
    } else {
      bild.onload = melden
      bild.onerror = melden
    }

    return () => {
      aufgegeben = true
    }
  }, [url])

  return stand.fertig === url ? stand.fertig : undefined
}
