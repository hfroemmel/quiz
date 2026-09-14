/**
 * Die Klangregeln der Buehne - ohne Browser.
 *
 * Geprueft wird die reine Entscheidung, nicht der Hook: Was ein Schritt von
 * einem Zustand zum naechsten ausloest, haengt an nichts als diesen beiden
 * Zustaenden und der Zahl der Spieler.
 */
import { describe, expect, it } from 'vitest'
import { soundsFor, type SoundState } from '../src/presentation/useStageSounds'

const empty: SoundState = { optionCount: 0, chosenOptionId: undefined, phase: 'idle' }

const state = (part: Partial<SoundState>): SoundState => ({ ...empty, ...part })

describe('klaengeFuer', () => {
  it('meldet die eingeblendeten Antworten genau einmal', () => {
    const open = state({ optionCount: 4, phase: 'buzzer-open' })
    expect(soundsFor(empty, open, 2)).toEqual(['options-appear'])
    expect(soundsFor(open, open, 2)).toEqual([])
  })

  it('meldet jede neu eingeloggte Antwort - auch die geaenderte', () => {
    const before = state({ optionCount: 4, phase: 'answer-locked' })
    const first = state({ optionCount: 4, chosenOptionId: 'a', phase: 'answer-locked' })
    const second = state({ optionCount: 4, chosenOptionId: 'b', phase: 'answer-locked' })
    expect(soundsFor(before, first, 2)).toEqual(['answer-logged'])
    expect(soundsFor(first, first, 2)).toEqual([])
    expect(soundsFor(first, second, 2)).toEqual(['answer-logged'])
  })

  it('meldet den Zuschlag im Duell', () => {
    const open = state({ optionCount: 4, phase: 'buzzer-open' })
    const award = state({ optionCount: 4, phase: 'answer-locked' })
    expect(soundsFor(open, award, 2)).toEqual(['buzz'])
  })

  it('meldet den Zuschlag im Einzelspiel NIE', () => {
    const open = state({ optionCount: 4, phase: 'buzzer-open' })
    const award = state({ optionCount: 4, phase: 'answer-locked' })
    expect(soundsFor(open, award, 1)).toEqual([])
  })

  it('laesst im Einzelspiel den Auswahlton unberuehrt', () => {
    /*
     * Der Fingertipp auf eine Antwort holt dort Zuschlag und Antwort in einem
     * Zug: Phase und Auswahl wechseln im selben Schritt. Zu hoeren ist genau
     * ein Klang - der der Auswahl.
     */
    const open = state({ optionCount: 4, phase: 'buzzer-open' })
    const tapped = state({ optionCount: 4, chosenOptionId: 'a', phase: 'answer-locked' })
    expect(soundsFor(open, tapped, 1)).toEqual(['answer-logged'])
    expect(soundsFor(open, tapped, 2)).toEqual(['answer-logged', 'buzz'])
  })
})
