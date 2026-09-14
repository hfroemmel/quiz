/**
 * Scene choice of the stage (specification 22.1).
 *
 * The scene follows the phase. The only exception is the image reveal: even
 * when a player holds the buzz, the frozen picture stays - that is exactly what
 * is being talked about at this moment.
 */
import { describe, expect, it } from 'vitest'
import { sceneForPhase } from '../src/engine/projection'

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
