/**
 * Die Uhr, die dem Operator sagt, wann er dran ist.
 *
 * Sie rechnet gegen die Serverzeit und nicht gegen die des Rechners, auf dem sie
 * laeuft - deshalb ist sie ohne Browser pruefbar, und deshalb wird sie hier
 * geprueft.
 */
import { describe, expect, it } from 'vitest'
import type { PublicVideoState } from '@hfroemmel/quiz-core'
import { formatiereDauer, videoProgress } from '../src/presentation/videoClock'

const laufend = (ueberschreibung: Partial<PublicVideoState> = {}): PublicVideoState => ({
  status: 'playing',
  positionMs: 10_000,
  durationMs: 60_000,
  hasError: false,
  ...ueberschreibung,
})

describe('videoProgress', () => {
  it('zaehlt vom Schnappschuss aus weiter, solange gespielt wird', () => {
    expect(videoProgress(laufend(), 1_000, 3_500)).toEqual({ playedMs: 12_500, remainingMs: 47_500 })
  })

  it('bleibt stehen, wenn das Video angehalten ist', () => {
    const angehalten = laufend({ status: 'paused' })
    expect(videoProgress(angehalten, 1_000, 60_000)).toEqual({ playedMs: 10_000, remainingMs: 50_000 })
  })

  it('laesst die Restzeit offen, solange niemand die Laufzeit gemeldet hat', () => {
    const ohneLaufzeit: PublicVideoState = { status: 'playing', positionMs: 4_000, hasError: false }
    expect(videoProgress(ohneLaufzeit, 0, 1_000)).toEqual({ playedMs: 5_000 })
  })

  it('laeuft nicht ueber das Ende hinaus', () => {
    /*
     * Der Schnappschuss kann aelter sein als der Schluss des Videos - etwa wenn
     * die Verbindung kurz stand. Eine negative Restzeit waere dem Operator kein
     * Hinweis, sondern ein Raetsel.
     */
    expect(videoProgress(laufend(), 0, 90_000)).toEqual({ playedMs: 60_000, remainingMs: 0 })
  })
})

describe('formatiereDauer', () => {
  it('schreibt Minuten und Sekunden zweistellig', () => {
    expect(formatiereDauer(0)).toBe('0:00')
    expect(formatiereDauer(9_000)).toBe('0:09')
    expect(formatiereDauer(65_000)).toBe('1:05')
    expect(formatiereDauer(600_000)).toBe('10:00')
  })

  it('rundet auf, damit die Null erst am Schluss steht', () => {
    expect(formatiereDauer(1)).toBe('0:01')
    expect(formatiereDauer(1_400)).toBe('0:02')
  })
})
