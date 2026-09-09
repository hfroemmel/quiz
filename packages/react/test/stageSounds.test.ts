/**
 * Die Klangregeln der Buehne - ohne Browser.
 *
 * Geprueft wird die reine Entscheidung, nicht der Hook: Was ein Schritt von
 * einem Zustand zum naechsten ausloest, haengt an nichts als diesen beiden
 * Zustaenden und der Zahl der Spieler.
 */
import { describe, expect, it } from 'vitest'
import { klaengeFuer, type Klangstand } from '../src/presentation/useStageSounds'

const leer: Klangstand = { optionCount: 0, chosenOptionId: undefined, phase: 'idle' }

const stand = (teil: Partial<Klangstand>): Klangstand => ({ ...leer, ...teil })

describe('klaengeFuer', () => {
  it('meldet die eingeblendeten Antworten genau einmal', () => {
    const offen = stand({ optionCount: 4, phase: 'buzzer-open' })
    expect(klaengeFuer(leer, offen, 2)).toEqual(['options-appear'])
    expect(klaengeFuer(offen, offen, 2)).toEqual([])
  })

  it('meldet jede neu eingeloggte Antwort - auch die geaenderte', () => {
    const vorher = stand({ optionCount: 4, phase: 'answer-locked' })
    const erste = stand({ optionCount: 4, chosenOptionId: 'a', phase: 'answer-locked' })
    const zweite = stand({ optionCount: 4, chosenOptionId: 'b', phase: 'answer-locked' })
    expect(klaengeFuer(vorher, erste, 2)).toEqual(['answer-logged'])
    expect(klaengeFuer(erste, erste, 2)).toEqual([])
    expect(klaengeFuer(erste, zweite, 2)).toEqual(['answer-logged'])
  })

  it('meldet den Zuschlag im Duell', () => {
    const offen = stand({ optionCount: 4, phase: 'buzzer-open' })
    const zuschlag = stand({ optionCount: 4, phase: 'answer-locked' })
    expect(klaengeFuer(offen, zuschlag, 2)).toEqual(['buzz'])
  })

  it('meldet den Zuschlag im Einzelspiel NIE', () => {
    const offen = stand({ optionCount: 4, phase: 'buzzer-open' })
    const zuschlag = stand({ optionCount: 4, phase: 'answer-locked' })
    expect(klaengeFuer(offen, zuschlag, 1)).toEqual([])
  })

  it('laesst im Einzelspiel den Auswahlton unberuehrt', () => {
    /*
     * Der Fingertipp auf eine Antwort holt dort Zuschlag und Antwort in einem
     * Zug: Phase und Auswahl wechseln im selben Schritt. Zu hoeren ist genau
     * ein Klang - der der Auswahl.
     */
    const offen = stand({ optionCount: 4, phase: 'buzzer-open' })
    const getippt = stand({ optionCount: 4, chosenOptionId: 'a', phase: 'answer-locked' })
    expect(klaengeFuer(offen, getippt, 1)).toEqual(['answer-logged'])
    expect(klaengeFuer(offen, getippt, 2)).toEqual(['answer-logged', 'buzz'])
  })
})
