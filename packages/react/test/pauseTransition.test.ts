/**
 * The interstitial view before the question - its TIMING, not its look.
 *
 * How it looks is new in the children's world: the counter and category now
 * sit large on a drawn board. How LONG it stands is what this test pins down -
 * the duration comes from the server's own value, the switch afterwards too,
 * and a number that shifted here unnoticed would move the question change of a
 * whole evening.
 *
 * It stands one and a half seconds, halved from three. The test below says why
 * that is the floor rather than a preference: the category needs a second of it
 * to arrive.
 */
import { describe, expect, it } from 'vitest'
import { gameTiming } from '@hfroemmel/quiz-core'
import { fadeThroughPause } from '../src/presentation/transitions/fadeThrough'
import { presentationTiming } from '../src/presentation/animationPresets'

describe('the interstitial before a question', () => {
  it('keeps the timing it always had', () => {
    expect(presentationTiming.sceneFadeMs).toBe(400)
    expect(fadeThroughPause.durationMs).toBe(400)
    // Anyone who wants no motion still gets the short version.
    expect(fadeThroughPause.reducedMotionDurationMs).toBe(120)
  })

  it('stands long enough for everything on it to have arrived', () => {
    /*
     * THIS IS THE ONE THING THAT BREAKS IF THE SCREEN GETS SHORTER. The
     * counter is there from the first frame, the category fades in after a
     * delay (`pause-category-in` in `scenes.module.css`: 400 ms delay,
     * 600 ms of fade), and the whole point of the screen is that both can be
     * read before the question stands. Halving it from three seconds to one
     * and a half leaves half a second of standstill - shortening it further
     * would cut the category off mid-fade, and nothing else in the code would
     * say so.
     */
    const categoryArrivesAtMs = 400 + 600
    expect(presentationTiming.pauseScreenMs).toBe(1_500)
    expect(presentationTiming.pauseScreenMs).toBeGreaterThan(categoryArrivesAtMs)
  })

  it('mirrors the server value and does not keep one of its own', () => {
    /*
     * The presentation copies the domain timings so a component does not have
     * to reach into the rules for them - but it must be a copy of THAT value.
     * A number typed here instead would be a second truth about how long the
     * server waits, and the two would drift apart at the next change.
     */
    expect(presentationTiming.pauseScreenMs).toBe(gameTiming.pauseScreenMs)
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
