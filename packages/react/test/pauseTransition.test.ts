/**
 * The interstitial view before the question - its TIMING, not its look.
 *
 * How it looks is new in the children's world: the counter and category now
 * sit large on a drawn board. How long it stands is NOT new, and that is
 * exactly what this test pins down. The duration hangs off the transition,
 * the switch afterwards comes from the server - a value that shifted here
 * unnoticed would move the question change of a whole evening.
 */
import { describe, expect, it } from 'vitest'
import { fadeThroughPause } from '../src/presentation/transitions/fadeThrough'
import { presentationTiming } from '../src/presentation/animationPresets'

describe('the interstitial before a question', () => {
  it('keeps the timing it always had', () => {
    expect(presentationTiming.sceneFadeMs).toBe(400)
    expect(fadeThroughPause.durationMs).toBe(400)
    // Anyone who wants no motion still gets the short version.
    expect(fadeThroughPause.reducedMotionDurationMs).toBe(120)
  })

  it('is a presentation step and decides nothing about the game', () => {
    /*
     * The transition hangs off the SCENE and not off a question: it
     * describes how the switch happens, not when. If it carried a target
     * state, the interstitial view would be a second game control alongside
     * the server.
     */
    expect(fadeThroughPause.appliesTo).toEqual({ from: '*', to: 'pause' })
    expect(Object.keys(fadeThroughPause)).not.toContain('nextPhase')
    expect(Object.keys(fadeThroughPause)).not.toContain('advance')
  })
})
