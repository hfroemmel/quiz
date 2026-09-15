/**
 * The menu of a device - what it may offer, and what it may not.
 *
 * Two promises are checked here. First: a device only ever offers what it can
 * play through on its own. A quiz whose levels need somebody to judge an answer
 * does not belong in its menu - not greyed out, not with a notice, but not at
 * all, because at the device there is nobody to ask. Second: a device belongs
 * to ONE audience, and the other one's offers never appear on it; the desk, by
 * contrast, names no audience and sees the whole package.
 */
import { describe, expect, it } from 'vitest'
import { deriveStartMenu, projectPlayer, type CatalogViewModel, type QuizConfig } from '../src'
import { testConfig } from './helpers'

/** A slot the device can decide on its own: the answer is compared, not judged. */
const compared = { id: 'text', filters: { evaluationModes: ['option-comparison' as const] } }
/** And one that needs an operator - a picture somebody has to look at. */
const judged = { id: 'image', filters: {} }

const deviceConfig: QuizConfig = {
  ...testConfig,
  presets: [
    { id: 'touch-easy', label: 'Leicht', slots: [compared] },
    { id: 'touch-hard', label: 'Schwer', slots: [compared] },
    { id: 'stage', label: 'Bühnenrunde', slots: [judged] },
  ],
  audiences: [
    {
      id: 'adults',
      label: 'Erwachsene',
      themeId: 'default',
      allowedPresetIds: ['touch-easy', 'touch-hard', 'stage'],
    },
    { id: 'kids', label: 'Kinder', themeId: 'kids', allowedPresetIds: ['touch-easy'] },
  ],
  quizzes: [
    {
      id: 'bundestag',
      label: 'Bundestagsquiz',
      audienceId: 'adults',
      themeId: 'default',
      presetIds: ['touch-easy', 'touch-hard'],
      defaultPresetId: 'touch-hard',
    },
    {
      id: 'buehne',
      label: 'Bühnenquiz',
      audienceId: 'adults',
      themeId: 'default',
      presetIds: ['stage'],
    },
    {
      id: 'kinder',
      label: 'Kinderquiz',
      audienceId: 'kids',
      themeId: 'kids',
      presetIds: ['stage', 'touch-easy'],
      defaultPresetId: 'stage',
    },
  ],
}

/** The catalogue as the device sees it - through the projection, not by hand. */
function deviceCatalog(config: QuizConfig = deviceConfig): CatalogViewModel {
  return projectPlayer(null, {
    nowMs: 0,
    config,
    assetUrl: () => undefined,
    contentVersion: 'test',
    eventDayId: 'event-day-test',
    locale: 'de-DE',
  }).catalog
}

describe('the catalogue of a device', () => {
  it('drops a quiz whose levels it cannot play through', () => {
    expect(deviceCatalog().quizzes.map((quiz) => quiz.id)).toEqual(['bundestag', 'kinder'])
  })

  it('shortens a quiz to its playable levels and moves the default there', () => {
    const kids = deviceCatalog().quizzes.find((quiz) => quiz.id === 'kinder')!
    expect(kids.presetIds).toEqual(['touch-easy'])
    expect(kids.defaultPresetId).toBe('touch-easy')
  })

  it('keeps what the configuration says about a difficulty choice', () => {
    /*
     * The engine expects a level with the start command wherever the
     * CONFIGURATION offers more than one - shortening the list at the device
     * must not silently change that expectation.
     */
    const kids = deviceCatalog().quizzes.find((quiz) => quiz.id === 'kinder')!
    expect(kids.supportsDifficulty).toBe(true)
    expect(deviceCatalog().quizzes.find((quiz) => quiz.id === 'bundestag')!.supportsDifficulty).toBe(true)
  })

  it('leaves a level the device cannot play out of the choice, and the one left is the default', () => {
    const menu = deriveStartMenu(deviceConfig, deviceCatalog(), 'de-DE', { audienceId: 'kids' })
    expect(menu.offers[0]!.difficulties).toEqual([{ presetId: 'touch-easy', label: 'Leicht', isDefault: true }])
  })
})

describe('the menu of a device', () => {
  it('offers only the audience the device belongs to', () => {
    const adults = deriveStartMenu(deviceConfig, deviceCatalog(), 'de-DE', { audienceId: 'adults' })
    expect(adults.offers.map((offer) => offer.quizId)).toEqual(['bundestag'])

    const kids = deriveStartMenu(deviceConfig, deviceCatalog(), 'de-DE', { audienceId: 'kids' })
    expect(kids.offers.map((offer) => offer.quizId)).toEqual(['kinder'])
  })

  it('falls back to the audience itself where it has no quiz of its own', () => {
    const config: QuizConfig = {
      ...deviceConfig,
      quizzes: deviceConfig.quizzes!.filter((quiz) => quiz.audienceId === 'adults'),
    }
    const menu = deriveStartMenu(config, deviceCatalog(config), 'de-DE', { audienceId: 'kids' })

    expect(menu.offers).toHaveLength(1)
    expect(menu.offers[0]).toMatchObject({ audienceId: 'kids', label: 'Kinder' })
    expect(menu.offers[0]!.quizId).toBeUndefined()
  })

  it('settles the single offer of a device instead of asking for it', () => {
    const menu = deriveStartMenu(deviceConfig, deviceCatalog(), 'de-DE', { audienceId: 'adults' })
    expect(menu.preselect).toMatchObject({ quizId: 'bundestag' })
  })

  it('shows the whole package where no audience is named - the desk', () => {
    const menu = deriveStartMenu(deviceConfig, deviceCatalog(), 'de-DE')
    expect(menu.offers.map((offer) => offer.quizId)).toEqual(['bundestag', 'kinder'])
  })
})
