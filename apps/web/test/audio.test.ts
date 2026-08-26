/**
 * Der Bestand an Klangdateien - festgeschrieben.
 *
 * `soundCues.ts` sammelt ein, was im Ordner liegt (`import.meta.glob`). Das ist
 * bequem und war einmal ein Problem: Zum Countdown gehoerten `tick.mp3` und ein
 * Weckerton `ring.mp3`. Beide sind mit dem Countdown entfallen, und beide
 * duerfen nicht durch eine unbedacht zurueckgelegte Datei wiederkommen.
 *
 * Deshalb steht der Bestand hier ALS LISTE und nicht als Regel: Wer eine Datei
 * hinzufuegt, muss sie hier nennen - und merkt dabei, ob sie ueberhaupt einen
 * Cue hat, der sie abspielt.
 */
import { readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { soundCueIds, cueFilesForTest } from '../src/presentation/soundCues.ts'

const audioDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'assets', 'audio')

const erwartet = [
  'applause.wav',
  'buzzer.mp3',
  'correct.mp3',
  'decide.mp3',
  'opener.mp3',
  'score.mp3',
  'swoosh.mp3',
  'wrong.mp3',
]

describe('Klangdateien', () => {
  it('enthaelt genau den festgeschriebenen Bestand', () => {
    expect(readdirSync(audioDir).sort()).toEqual([...erwartet].sort())
  })

  it('spielt keinen Countdown- oder Weckerton', () => {
    const alle = soundCueIds.flatMap((cueId) => cueFilesForTest[cueId])
    for (const verboten of ['tick.mp3', 'ring.mp3']) {
      expect(alle, verboten).not.toContain(verboten)
      expect(readdirSync(audioDir), verboten).not.toContain(verboten)
    }
  })

  it('verweist auf keine Datei, die es nicht gibt', () => {
    const vorhanden = new Set(readdirSync(audioDir))
    for (const cueId of soundCueIds) {
      for (const datei of cueFilesForTest[cueId]) {
        expect(vorhanden.has(datei), `${cueId} -> ${datei}`).toBe(true)
      }
    }
  })
})
