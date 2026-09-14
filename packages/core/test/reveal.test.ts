/**
 * Reveal clock: fake-clock tests for remaining seconds, grid resolution and
 * pause behaviour (specification 10.2 and 22.7).
 */
import { describe, expect, it } from 'vitest'
import { gameTiming, revealGrid, type RevealGrid } from '../src'
import {
  completeReveal,
  createRevealClock,
  isRevealFinished,
  pauseReveal,
  resetReveal,
  resumeReveal,
  revealCountdownSeconds,
  revealElapsedMs,
  revealProgress,
  revealSeed,
  revealTilePlan,
  startReveal,
} from '../src/engine/reveal'

const DURATION = gameTiming.imageRevealDurationMs

describe('Reveal clock', () => {
  it('derives remaining seconds and grid resolution from the same progress variable', () => {
    const clock = startReveal(createRevealClock(DURATION), 0)
    const plan = revealTilePlan(revealGrid, revealSeed('bild.webp'))

    // At every point in time remaining seconds and open tiles have to match the same `progress`.
    for (const elapsed of [0, 1_000, 2_500, 5_000, 7_500, 9_999, 10_000]) {
      const progress = revealProgress(clock, elapsed)
      expect(revealCountdownSeconds(clock, elapsed)).toBe(Math.ceil((1 - progress) * (DURATION / 1000)))
      /*
       * The tiles fall evenly over time: at half progress half of them are
       * open. The last one opens at exactly 1 - hence `floor` and not `round`.
       */
      expect(openTiles(plan, progress)).toBe(Math.floor(progress * plan.length + 1e-9))
    }
  })

  it('runs from 10 to 0 and is fully uncovered at 0', () => {
    const clock = startReveal(createRevealClock(DURATION), 0)
    expect(revealCountdownSeconds(clock, 0)).toBe(10)
    expect(revealCountdownSeconds(clock, 5_000)).toBe(5)
    expect(revealCountdownSeconds(clock, DURATION)).toBe(0)

    const plan = revealTilePlan(revealGrid, revealSeed('bild.webp'))
    expect(openTiles(plan, revealProgress(clock, DURATION))).toBe(plan.length)
  })

  it('freezes exactly on pause and resumes at the same spot', () => {
    let clock = startReveal(createRevealClock(DURATION), 1_000)
    clock = pauseReveal(clock, 4_000)
    expect(clock.status).toBe('paused')
    expect(revealElapsedMs(clock, 4_000)).toBe(3_000)

    // Much later the state is still unchanged - no information advantage.
    expect(revealElapsedMs(clock, 60_000)).toBe(3_000)
    expect(revealCountdownSeconds(clock, 60_000)).toBe(7)

    clock = resumeReveal(clock, 100_000)
    expect(revealElapsedMs(clock, 102_000)).toBe(5_000)
  })

  it('clamps the progress on overflow instead of going negative', () => {
    const clock = startReveal(createRevealClock(DURATION), 0)
    expect(revealProgress(clock, 99_999)).toBe(1)
    expect(revealCountdownSeconds(clock, 99_999)).toBe(0)
    expect(isRevealFinished(clock, 99_999)).toBe(true)
  })

  it('uncovers completely and resets technically correct', () => {
    let clock = startReveal(createRevealClock(DURATION), 0)
    clock = completeReveal(clock)
    expect(revealProgress(clock, 0)).toBe(1)
    expect(clock.status).toBe('completed')

    clock = resetReveal(clock)
    expect(clock.status).toBe('idle')
    expect(revealProgress(clock, 0)).toBe(0)
  })

  it('continues after a reconnect from server times alone', () => {
    // The client knows only `startedAtServerMs` and `elapsedBeforeStartMs`.
    const clock = { status: 'running' as const, durationMs: DURATION, startedAtServerMs: 500, elapsedBeforeStartMs: 2_000 }
    expect(revealElapsedMs(clock, 3_500)).toBe(5_000)
    expect(revealProgress(clock, 3_500)).toBeCloseTo(0.5, 6)
  })
})

/** How many tiles are open at this progress. */
function openTiles(plan: number[], progress: number): number {
  return plan.filter((openAt) => progress >= openAt).length
}

describe('Reveal plan of the grid', () => {
  const seed = revealSeed('/media/img-42.webp')

  it('gives every tile exactly one place in the order', () => {
    const plan = revealTilePlan(revealGrid, seed)
    expect(plan).toHaveLength(revealGrid.columns * revealGrid.rows)
    expect(new Set(plan).size).toBe(plan.length)
    expect(Math.min(...plan)).toBeGreaterThan(0)
    expect(Math.max(...plan)).toBe(1)
  })

  it('starts fully covered and ends fully open', () => {
    const plan = revealTilePlan(revealGrid, seed)
    expect(openTiles(plan, 0)).toBe(0)
    expect(openTiles(plan, 1)).toBe(plan.length)
  })

  it('uncovers further and further with the progress and never takes anything back', () => {
    const plan = revealTilePlan(revealGrid, seed)
    let previous = 0
    for (let step = 0; step <= 100; step++) {
      const open = openTiles(plan, step / 100)
      expect(open).toBeGreaterThanOrEqual(previous)
      previous = open
    }
  })

  it('delivers the same order for the same question and a different one for another', () => {
    expect(revealTilePlan(revealGrid, seed)).toEqual(revealTilePlan(revealGrid, seed))
    expect(revealTilePlan(revealGrid, revealSeed('/media/img-43.webp'))).not.toEqual(revealTilePlan(revealGrid, seed))
  })

  /*
   * The core of the rule "distinctive areas last": averaged over many pictures
   * the centre has to fall later than the edge. Individual cases may deviate -
   * that is exactly what the scatter is for.
   */
  it('uncovers the image centre later than the edge', () => {
    const middle: number[] = []
    const border: number[] = []
    for (let run = 0; run < 40; run++) {
      const plan = revealTilePlan(revealGrid, revealSeed(`bild-${run}`))
      plan.forEach((openAt, index) => {
        const column = index % revealGrid.columns
        const row = Math.floor(index / revealGrid.columns)
        const isBorder = column === 0 || row === 0 || column === revealGrid.columns - 1 || row === revealGrid.rows - 1
        ;(isBorder ? border : middle).push(openAt)
      })
    }
    const average = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length
    expect(average(middle)).toBeGreaterThan(average(border))
  })

  it('accepts any grid size - the default is not a condition', () => {
    const tiny: RevealGrid = { ...revealGrid, columns: 2, rows: 2 }
    const plan = revealTilePlan(tiny, seed)
    expect(plan).toHaveLength(4)
    expect(openTiles(plan, 0.5)).toBe(2)
  })

  it('copes without tiles instead of stumbling', () => {
    expect(revealTilePlan({ ...revealGrid, columns: 0, rows: 0 }, seed)).toEqual([])
  })
})
