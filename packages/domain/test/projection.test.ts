/**
 * Szenenwahl der Buehne (Spezifikation 22.1).
 *
 * Die Szene folgt der Phase. Einzige Ausnahme ist das Bilderkennen: Auch wenn ein
 * Spieler den Zuschlag hat, bleibt das Bild mit dem eingefrorenen Countdown stehen -
 * genau darueber wird in diesem Moment gesprochen.
 */
import { describe, expect, it } from 'vitest'
import { sceneForPhase } from '../src/projection.ts'

describe('sceneForPhase', () => {
  it('folgt der Phase, wenn der Fragetyp nichts anderes verlangt', () => {
    expect(sceneForPhase('buzzer-open', 'text-choice')).toBe('question')
    expect(sceneForPhase('answer-locked', 'text-choice')).toBe('question')
    expect(sceneForPhase('solution', 'text-choice')).toBe('solution')
    expect(sceneForPhase('reveal-running', 'image-reveal')).toBe('reveal')
  })

  it('haelt das Bilderkennen bei der Spielerauswahl in der Enthuellungsszene', () => {
    expect(sceneForPhase('answer-locked', 'image-reveal')).toBe('reveal')
  })

  it('verlaesst die Enthuellung, sobald aufgeloest wird', () => {
    expect(sceneForPhase('solution', 'image-reveal')).toBe('solution')
    expect(sceneForPhase('attempt-feedback', 'image-reveal')).toBe('feedback')
  })
})
