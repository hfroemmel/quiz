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
  it('follows the phase when the question type demands nothing else', () => {
    expect(sceneForPhase('buzzer-open', 'text-choice')).toBe('question')
    expect(sceneForPhase('answer-locked', 'text-choice')).toBe('question')
    expect(sceneForPhase('solution', 'text-choice')).toBe('solution')
    expect(sceneForPhase('reveal-running', 'image-reveal')).toBe('reveal')
  })

  it('keeps image recognition in the reveal scene during player selection', () => {
    expect(sceneForPhase('answer-locked', 'image-reveal')).toBe('reveal')
  })

  it('leaves the reveal as soon as it is resolved', () => {
    expect(sceneForPhase('solution', 'image-reveal')).toBe('solution')
    expect(sceneForPhase('attempt-feedback', 'image-reveal')).toBe('feedback')
  })
})
