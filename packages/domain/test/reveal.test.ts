/**
 * Enthuellungsuhr: Fake-Clock-Tests fuer Countdown, Bildschaerfe und Pausenverhalten
 * (Spezifikation 10.2 und 22.7).
 */
import { describe, expect, it } from 'vitest'
import { gameTiming } from '@quiz/contracts'
import {
  completeReveal,
  createRevealClock,
  isRevealFinished,
  pauseReveal,
  resetReveal,
  resumeReveal,
  revealBlurPx,
  revealCountdownSeconds,
  revealElapsedMs,
  revealProgress,
  startReveal,
} from '../src/reveal.ts'

const DURATION = gameTiming.imageRevealDurationMs

describe('Reveal-Uhr', () => {
  it('leitet Countdown und Bildschaerfe aus derselben Fortschrittsvariable ab', () => {
    const clock = startReveal(createRevealClock(DURATION), 0)

    // Bei jedem Zeitpunkt muessen Countdown und Blur zum selben `progress` passen.
    for (const elapsed of [0, 1_000, 2_500, 5_000, 7_500, 9_999, 10_000]) {
      const progress = revealProgress(clock, elapsed)
      expect(revealCountdownSeconds(clock, elapsed)).toBe(Math.ceil((1 - progress) * (DURATION / 1000)))
      expect(revealBlurPx(clock, elapsed, 40)).toBeCloseTo(40 * (1 - progress), 6)
    }
  })

  it('laeuft von 10 auf 0 und ist bei 0 vollstaendig scharf', () => {
    const clock = startReveal(createRevealClock(DURATION), 0)
    expect(revealCountdownSeconds(clock, 0)).toBe(10)
    expect(revealCountdownSeconds(clock, 5_000)).toBe(5)
    expect(revealCountdownSeconds(clock, DURATION)).toBe(0)
    expect(revealBlurPx(clock, DURATION, 40)).toBe(0)
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
    expect(revealBlurPx(clock, 99_999, 40)).toBe(0)
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
