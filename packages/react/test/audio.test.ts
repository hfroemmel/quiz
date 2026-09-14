/**
 * The inventory of sound files - pinned down.
 *
 * `soundCues.ts` runs a static registry. It used to be collected there by a
 * glob of whatever was in the folder - convenient, and once a problem: the
 * countdown used to have `tick.mp3` and an alarm sound `ring.mp3`. Both were
 * removed along with the countdown, and neither may come back through a
 * carelessly left-behind file.
 *
 * That is why the inventory stands here AS A LIST and not as a rule: whoever
 * adds a file has to name it here - and notices in doing so whether it even
 * has a cue that plays it.
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

describe('Sound files', () => {
  it('contains exactly the fixed set', () => {
    expect(readdirSync(audioDir).sort()).toEqual([...expected].sort())
    // And the static registry knows exactly these files.
    expect([...registeredAudioFilesForTest].sort()).toEqual([...expected].sort())
  })

  it('plays no countdown or alarm sound', () => {
    const all = soundCueIds.flatMap((cueId) => cueFilesForTest[cueId])
    for (const forbidden of ['tick.mp3', 'ring.mp3']) {
      expect(all, forbidden).not.toContain(forbidden)
      expect(readdirSync(audioDir), forbidden).not.toContain(forbidden)
    }
  })

  it('references no file that does not exist', () => {
    const present = new Set(readdirSync(audioDir))
    for (const cueId of soundCueIds) {
      for (const file of cueFilesForTest[cueId]) {
        expect(present.has(file), `${cueId} -> ${file}`).toBe(true)
      }
    }
  })
})
