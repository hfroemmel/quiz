/**
 * Enthuellungsuhr: Fake-Clock-Tests fuer Countdown, Rasteraufloesung und
 * Pausenverhalten (Spezifikation 10.2 und 22.7).
 */
import { describe, expect, it } from 'vitest'
import { gameTiming, revealGrid, type RevealGrid } from '@quiz/contracts'
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
} from '../src/reveal.ts'

const DURATION = gameTiming.imageRevealDurationMs

describe('Reveal-Uhr', () => {
  it('leitet Countdown und Rasteraufloesung aus derselben Fortschrittsvariable ab', () => {
    const clock = startReveal(createRevealClock(DURATION), 0)
    const plan = revealTilePlan(revealGrid, revealSeed('bild.webp'))

    // Bei jedem Zeitpunkt muessen Countdown und offene Kacheln zum selben `progress` passen.
    for (const elapsed of [0, 1_000, 2_500, 5_000, 7_500, 9_999, 10_000]) {
      const progress = revealProgress(clock, elapsed)
      expect(revealCountdownSeconds(clock, elapsed)).toBe(Math.ceil((1 - progress) * (DURATION / 1000)))
      /*
       * Die Kacheln fallen gleichmaessig ueber die Zeit: Bei halbem Fortschritt
       * ist die Haelfte offen. Die letzte oeffnet bei genau 1 - deshalb `floor`
       * und nicht `round`.
       */
      expect(openTiles(plan, progress)).toBe(Math.floor(progress * plan.length + 1e-9))
    }
  })

  it('laeuft von 10 auf 0 und ist bei 0 vollstaendig aufgedeckt', () => {
    const clock = startReveal(createRevealClock(DURATION), 0)
    expect(revealCountdownSeconds(clock, 0)).toBe(10)
    expect(revealCountdownSeconds(clock, 5_000)).toBe(5)
    expect(revealCountdownSeconds(clock, DURATION)).toBe(0)

    const plan = revealTilePlan(revealGrid, revealSeed('bild.webp'))
    expect(openTiles(plan, revealProgress(clock, DURATION))).toBe(plan.length)
  })

  it('friert beim Pausieren exakt ein und setzt an derselben Stelle fort', () => {
    let clock = startReveal(createRevealClock(DURATION), 1_000)
    clock = pauseReveal(clock, 4_000)
    expect(clock.status).toBe('paused')
    expect(revealElapsedMs(clock, 4_000)).toBe(3_000)

    // Auch viel spaeter bleibt der Stand unveraendert - kein Informationsvorteil.
    expect(revealElapsedMs(clock, 60_000)).toBe(3_000)
    expect(revealCountdownSeconds(clock, 60_000)).toBe(7)

    clock = resumeReveal(clock, 100_000)
    expect(revealElapsedMs(clock, 102_000)).toBe(5_000)
  })

  it('clamped den Fortschritt bei Ueberlauf, statt negativ zu werden', () => {
    const clock = startReveal(createRevealClock(DURATION), 0)
    expect(revealProgress(clock, 99_999)).toBe(1)
    expect(revealCountdownSeconds(clock, 99_999)).toBe(0)
    expect(isRevealFinished(clock, 99_999)).toBe(true)
  })

  it('deckt vollstaendig auf und setzt technisch korrekt zurueck', () => {
    let clock = startReveal(createRevealClock(DURATION), 0)
    clock = completeReveal(clock)
    expect(revealProgress(clock, 0)).toBe(1)
    expect(clock.status).toBe('completed')

    clock = resetReveal(clock)
    expect(clock.status).toBe('idle')
    expect(revealProgress(clock, 0)).toBe(0)
  })

  it('rechnet nach einem Reconnect allein aus Serverzeiten weiter', () => {
    // Der Client kennt nur `startedAtServerMs` und `elapsedBeforeStartMs`.
    const clock = { status: 'running' as const, durationMs: DURATION, startedAtServerMs: 500, elapsedBeforeStartMs: 2_000 }
    expect(revealElapsedMs(clock, 3_500)).toBe(5_000)
    expect(revealProgress(clock, 3_500)).toBeCloseTo(0.5, 6)
  })
})

/** Wie viele Kacheln bei diesem Fortschritt offen sind. */
function openTiles(plan: number[], progress: number): number {
  return plan.filter((openAt) => progress >= openAt).length
}

describe('Aufdeckplan des Rasters', () => {
  const seed = revealSeed('/media/img-42.webp')

  it('gibt jeder Kachel genau einen Platz in der Reihenfolge', () => {
    const plan = revealTilePlan(revealGrid, seed)
    expect(plan).toHaveLength(revealGrid.columns * revealGrid.rows)
    expect(new Set(plan).size).toBe(plan.length)
    expect(Math.min(...plan)).toBeGreaterThan(0)
    expect(Math.max(...plan)).toBe(1)
  })

  it('beginnt vollstaendig verdeckt und endet vollstaendig offen', () => {
    const plan = revealTilePlan(revealGrid, seed)
    expect(openTiles(plan, 0)).toBe(0)
    expect(openTiles(plan, 1)).toBe(plan.length)
  })

  it('deckt mit dem Fortschritt immer weiter auf und nimmt nie etwas zurueck', () => {
    const plan = revealTilePlan(revealGrid, seed)
    let previous = 0
    for (let step = 0; step <= 100; step++) {
      const open = openTiles(plan, step / 100)
      expect(open).toBeGreaterThanOrEqual(previous)
      previous = open
    }
  })

  it('liefert fuer dieselbe Frage dieselbe Reihenfolge und fuer eine andere eine andere', () => {
    expect(revealTilePlan(revealGrid, seed)).toEqual(revealTilePlan(revealGrid, seed))
    expect(revealTilePlan(revealGrid, revealSeed('/media/img-43.webp'))).not.toEqual(revealTilePlan(revealGrid, seed))
  })

  /*
   * Der Kern der Regel "markante Bereiche zuletzt": Gemittelt ueber viele Bilder
   * muss die Mitte spaeter fallen als der Rand. Einzelne Faelle duerfen abweichen -
   * genau dafuer ist die Streuung da.
   */
  it('deckt die Bildmitte spaeter auf als den Rand', () => {
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

  it('nimmt jede Rastergroesse an - die Voreinstellung ist keine Bedingung', () => {
    const winzig: RevealGrid = { ...revealGrid, columns: 2, rows: 2 }
    const plan = revealTilePlan(winzig, seed)
    expect(plan).toHaveLength(4)
    expect(openTiles(plan, 0.5)).toBe(2)
  })

  it('kommt ohne Kacheln aus, statt zu stolpern', () => {
    expect(revealTilePlan({ ...revealGrid, columns: 0, rows: 0 }, seed)).toEqual([])
  })
})
