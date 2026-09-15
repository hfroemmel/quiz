/**
 * Shape of the built quiz package.
 *
 * The package carries a checksum over its content, and that runs through
 * `JSON.stringify` - where the ORDER of the keys counts. The loading path
 * sorts fields into place via the schema; the package must therefore stay
 * byte-identical across write and re-read, otherwise it is rejected at start
 * although nothing is missing content-wise.
 *
 * The first time, the bug only showed up in the end-to-end run because it
 * appears neither in the type system nor in the content report. That is why
 * it is pinned here.
 *
 * Since schema v2 the package also carries NO colours and fonts anymore -
 * presentation is the host's business. This test pins that down as well.
 */
import { describe, expect, it } from 'vitest'
import { quizConfigSchema } from '@hfroemmel/quiz-core'

const config = {
  questionsPerGame: 1,
  difficulties: [{ id: 'easy', label: 'Leicht' }],
  categories: [{ id: 'allgemein', label: 'Allgemein' }],
  pools: [
    { id: 'bundestag', label: 'Bundestag' },
    { id: 'saarbruecken', label: 'Saarbrücken' },
  ],
  themes: [
    { id: 'default', label: 'Standard' },
    { id: 'kids', label: 'Kinder', skin: 'kids', presentationAnimationSetId: 'standard' },
  ],
  presets: [{ id: 'standard', label: 'Standard', slots: [{ id: 'text', filters: {} }] }],
  audiences: [{ id: 'adults', label: 'Erwachsene', themeId: 'default', allowedPresetIds: ['standard'] }],
}

describe('Built quiz package', () => {
  it('strips presentation fields off a theme - colours belong to the host', () => {
    const parsed = quizConfigSchema.parse({
      ...config,
      themes: [{ id: 'default', label: 'Standard', colors: { accent: '#123456' }, typography: { headingFont: 'X' } }],
    })
    expect(parsed.themes[0]).toEqual({ id: 'default', label: 'Standard' })
  })

  it('stays byte-identical across write and re-read - otherwise the checksum tips', () => {
    const built = quizConfigSchema.parse(config)
    const reloaded = quizConfigSchema.parse(JSON.parse(JSON.stringify(built)))
    expect(JSON.stringify(reloaded)).toBe(JSON.stringify(built))
  })
})
