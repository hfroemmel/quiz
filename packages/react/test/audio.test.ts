/**
 * Der Bestand an Klangdateien - festgeschrieben.
 *
 * `soundCues.ts` fuehrt eine statische Registry. Frueher sammelte dort ein Glob
 * ein, was im Ordner lag - bequem und einmal ein Problem: Zum Countdown
 * gehoerten `tick.mp3` und ein Weckerton `ring.mp3`. Beide sind mit dem
 * Countdown entfallen, und beide duerfen nicht durch eine unbedacht
 * zurueckgelegte Datei wiederkommen.
 *
 * Deshalb steht der Bestand hier ALS LISTE und nicht als Regel: Wer eine Datei
 * hinzufuegt, muss sie hier nennen - und merkt dabei, ob sie ueberhaupt einen
 * Cue hat, der sie abspielt.
 */
import { readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { soundCueIds, cueFilesForTest, registeredAudioFilesForTest } from '../src/presentation/soundCues'

const audioDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'assets', 'audio')

const expected = [
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
    expect(readdirSync(audioDir).sort()).toEqual([...expected].sort())
    // Und die statische Registry kennt exakt diese Dateien.
    expect([...registeredAudioFilesForTest].sort()).toEqual([...expected].sort())
  })

  it('spielt keinen Countdown- oder Weckerton', () => {
    const all = soundCueIds.flatMap((cueId) => cueFilesForTest[cueId])
    for (const forbidden of ['tick.mp3', 'ring.mp3']) {
      expect(all, forbidden).not.toContain(forbidden)
      expect(readdirSync(audioDir), forbidden).not.toContain(forbidden)
    }
  })

  it('verweist auf keine Datei, die es nicht gibt', () => {
    const present = new Set(readdirSync(audioDir))
    for (const cueId of soundCueIds) {
      for (const file of cueFilesForTest[cueId]) {
        expect(present.has(file), `${cueId} -> ${file}`).toBe(true)
      }
    }
  })
})
