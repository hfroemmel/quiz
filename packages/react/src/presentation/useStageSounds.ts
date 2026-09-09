/**
 * Klaenge, die sich aus dem Zustand ergeben - nicht aus einem Klick.
 *
 * Der Szenenwechsel bringt seine Soundmarke aus dem Uebergangsregistry mit. Alles
 * andere passiert INNERHALB einer Szene und braucht deshalb einen eigenen Blick
 * auf den Snapshot:
 *
 *   Antworten eingeblendet   sichtbare Optionen wechseln von keiner auf welche
 *   Antwort eingeloggt       eine Option bekommt den Zustand `chosen`
 *   Buzzer betaetigt         die Phase wechselt auf `answer-locked`
 *
 * Der Buzzerklang haengt bewusst am Phasenwechsel des Servers: Ein Tastendruck bei
 * gesperrtem Buzzer wird abgewiesen - und bleibt damit auch still.
 *
 * Die Entscheidung selbst steht als reine Funktion darunter (`klaengeFuer`),
 * damit sie ohne Browser pruefbar ist; der Hook fuehrt nur Buch darueber, was
 * zuletzt galt.
 */
import { useEffect, useRef } from 'react'
import type { PublicQuizViewModel } from '@hfroemmel/quiz-core'
import type { SoundCueId } from './soundCues'

/** Was von einem Snapshot uebrig bleiben muss, um den naechsten zu beurteilen. */
export interface Klangstand {
  optionCount: number
  chosenOptionId: string | undefined
  phase: PublicQuizViewModel['phase']
}

export function klangstand(view: PublicQuizViewModel): Klangstand {
  return {
    optionCount: view.visibleOptions?.length ?? 0,
    chosenOptionId: view.visibleOptions?.find((option) => option.state === 'chosen')?.id,
    phase: view.phase,
  }
}

/**
 * Die Klaenge, die der Schritt von `vorher` nach `jetzt` ausloest.
 *
 * IM EINZELSPIEL GIBT ES KEINEN BUZZERKLANG - nirgends und nie. Es gibt dort
 * auch keinen Buzzer: Der erste Fingertipp auf eine Antwort holt sich den
 * Zuschlag selbst, und die Buehne quittierte diesen Tipp bisher mit zwei
 * Klaengen uebereinander - dem Auswahlton und dem Buzzer. Gehoert hat sich das
 * wie ein Fehler, und der Buzzer ist der falsche von beiden: Er meldet, dass
 * jemand einem anderen zuvorgekommen ist, und niemand ist da.
 *
 * Im Duell bleibt er unveraendert. Die Phase `answer-locked` wird ausschliesslich
 * durch einen angenommenen Buzz erreicht (siehe `claimPlayer` in der Engine),
 * der Klang haengt damit weiter genau am Buzzern.
 */
export function klaengeFuer(vorher: Klangstand, jetzt: Klangstand, spieler: number): SoundCueId[] {
  const klaenge: SoundCueId[] = []
  if (jetzt.optionCount > 0 && vorher.optionCount === 0) klaenge.push('options-appear')
  if (jetzt.chosenOptionId && jetzt.chosenOptionId !== vorher.chosenOptionId) klaenge.push('answer-logged')
  if (spieler > 1 && jetzt.phase === 'answer-locked' && vorher.phase !== 'answer-locked') klaenge.push('buzz')
  return klaenge
}

export function useStageSounds(view: PublicQuizViewModel, play: (cueId: SoundCueId) => void): void {
  const previous = useRef<Klangstand>({ optionCount: 0, chosenOptionId: undefined, phase: view.phase })

  const stand = klangstand(view)
  const { optionCount, chosenOptionId, phase } = stand
  const spieler = view.playerScores.length

  useEffect(() => {
    const jetzt: Klangstand = { optionCount, chosenOptionId, phase }
    for (const cue of klaengeFuer(previous.current, jetzt, spieler)) play(cue)
    previous.current = jetzt
  }, [optionCount, chosenOptionId, phase, spieler, play])
}
