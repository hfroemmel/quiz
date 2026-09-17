/**
 * The colour variant as a preference - the rule, without a window.
 *
 * WHY THIS IS TESTED AT ALL. The choice looks like a trivial three-value
 * switch, and it went wrong in the one way a three-value switch can: an
 * application offered a variant its installed package did not know. The value
 * was stored, rejected on the next read and the box - a controlled field -
 * snapped back to what was in force. Nothing recoloured, nothing complained.
 *
 * So the two halves of that are nailed down here: which names exist (the
 * offer a host builds its box from) and what an unknown name means.
 */
import { describe, expect, it } from 'vitest'
import { stageThemeFrom, stageThemes, type StageTheme } from '../src/presentation/stageTheme'

describe('Colour variant of the stage', () => {
  it('offers light, dark and red - in the order a box shows them', () => {
    expect(stageThemes).toEqual(['bright', 'dark', 'red'])
  })

  it('gives every name of the offer back as itself', () => {
    for (const variant of stageThemes) {
      expect(stageThemeFrom(variant), variant).toBe(variant)
    }
  })

  it('falls back to light for anything it does not know', () => {
    /*
     * An empty storage, a variant from another build, a label instead of a
     * name, a different spelling: none of them is a variant of this build, and
     * every one of them has to land on the same calm ground.
     */
    for (const stored of [null, '', 'Rot', 'ROT', 'rot', 'blau', 'kids', 'default', ' red']) {
      expect(stageThemeFrom(stored), String(stored)).toBe('bright')
    }
  })

  it('accepts red - the variant that was missing from an older package', () => {
    const red: StageTheme = 'red'
    expect(stageThemes).toContain(red)
    expect(stageThemeFrom('red')).toBe('red')
  })
})
