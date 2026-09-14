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
export interface ImageState {
  /** Die Adresse, die geladen wurde - `undefined`, solange keine fertig ist. */
  done: string | undefined
}

/**
 * Der neue Stand, nachdem `geladen` fertig geworden ist.
 *
 * Eine Meldung, die nicht mehr zur aktuellen Adresse gehoert, wird verworfen:
 * Bei schnellem Weiterklicken kommen die Bilder in beliebiger Reihenfolge
 * zurueck, und das zuletzt eingetroffene ist nicht das zuletzt gefragte.
 */
export function imageState(before: ImageState, asked: string | undefined, loaded: string): ImageState {
  if (loaded !== asked) return before
  if (before.done === loaded) return before
  return { done: loaded }
}

export function useDecodedImage(url: string | undefined): string | undefined {
  const [state, setState] = useState<ImageState>({ done: undefined })

  useEffect(() => {
    if (!url) {
      setState({ done: undefined })
      return undefined
    }

    let givenUp = false
    const report = () => {
      if (!givenUp) setState((before) => imageState(before, url, url))
    }

    const image = new Image()
    image.src = url
    /*
     * `decode()` wartet nicht nur auf die Bytes, sondern auch auf das
     * Auspacken - ein `onload` allein kann noch einen Ruckler beim ersten
     * Zeichnen bedeuten. Wo es fehlt oder scheitert (Firefox meldet fuer
     * manche Bilder einen Fehler, obwohl sie brauchbar sind), gilt `onload`.
     */
    if (image.decode) {
      void image.decode().then(report, report)
    } else {
      image.onload = report
      image.onerror = report
    }

    return () => {
      givenUp = true
    }
  }, [url])

  return state.done === url ? state.done : undefined
}

/* Former names, kept for one release so that hosts can migrate. */
/** @deprecated Renamed to `ImageState`. */
export type Bildstand = ImageState
/** @deprecated Renamed to `imageState`. */
export const bildstand = imageState
