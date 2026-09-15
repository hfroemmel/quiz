/**
 * Quiz types: what the server accepts, what it refuses and what is fixed
 * afterwards.
 *
 * The quiz type is the ONE decision of the desk before the evening. Everything
 * that makes a quiz - audience, question pool, theme and whether there is a
 * difficulty choice - is in the configuration; here it is checked that the
 * server derives exactly from that and takes nothing from the client.
 */
import { describe, expect, it } from 'vitest'
import { defaultPresetIdOf, quizSupportsDifficulty } from '../src'
import { resolveQuizMode } from '../src/engine/quizModes'
import { createHarness, makeQuestion, testConfig } from './helpers'

const script = () => Array.from({ length: 7 }, (_, index) => makeQuestion({ id: `q${index + 1}` }))

describe('Quiz configuration', () => {
  it('offers a difficulty choice only where there is more than one preset', () => {
    expect(quizSupportsDifficulty({ presetIds: ['easy', 'medium', 'hard'] })).toBe(true)
    expect(quizSupportsDifficulty({ presetIds: ['medium'] })).toBe(false)
  })

  it('takes the named level as default, otherwise the first', () => {
    expect(defaultPresetIdOf({ presetIds: ['easy', 'medium', 'hard'], defaultPresetId: 'medium' })).toBe('medium')
    expect(defaultPresetIdOf({ presetIds: ['easy', 'medium'] })).toBe('easy')
  })

  it('resolves audience, pool, theme and levels from the configuration', () => {
    const lookup = resolveQuizMode(testConfig, 'bremen')
    expect(lookup.ok).toBe(true)
    if (!lookup.ok) return
    expect(lookup.quiz).toMatchObject({
      id: 'bremen',
      audience: 'adults',
      themeId: 'default',
      poolIds: ['bremen'],
      presetIds: ['medium'],
      defaultPresetId: 'medium',
    })
  })

  it('names the reason when resolving a quiz mode that does not exist', () => {
    const lookup = resolveQuizMode(testConfig, 'atlantis')
    expect(lookup.ok).toBe(false)
    if (lookup.ok) return
    expect(lookup.message).toContain('atlantis')
  })

  it('rejects a quiz mode whose question pool is not configured', () => {
    const broken = {
      ...testConfig,
      quizzes: [
        { id: 'europa', label: 'Europa-Quiz', audienceId: 'adults', themeId: 'default', poolIds: ['europa'], presetIds: ['medium'] },
      ],
    }
    const lookup = resolveQuizMode(broken, 'europa')
    expect(lookup.ok).toBe(false)
    if (lookup.ok) return
    expect(lookup.message).toContain('europa')
  })

  it('rejects a quiz mode whose theme does not exist', () => {
    const broken = {
      ...testConfig,
      quizzes: [{ id: 'bunt', label: 'Buntquiz', audienceId: 'adults', themeId: 'neon', presetIds: ['medium'] }],
    }
    const lookup = resolveQuizMode(broken, 'bunt')
    expect(lookup.ok).toBe(false)
    if (lookup.ok) return
    expect(lookup.message).toContain('neon')
  })
})

describe('Game start via a quiz mode', () => {
  it('writes quiz mode, audience, pool and level into the game state', () => {
    const harness = createHarness(script())
    const state = harness.dispatch({ type: 'START_GAME', quizId: 'bremen' })
    expect(state.quizId).toBe('bremen')
    expect(state.audience).toBe('adults')
    expect(state.poolIds).toEqual(['bremen'])
    expect(state.presetId).toBe('medium')
  })

  it('takes the chosen difficulty where the quiz mode offers a choice', () => {
    const harness = createHarness(script())
    const state = harness.dispatch({ type: 'START_GAME', quizId: 'bundestag', presetId: 'hard' })
    expect(state.presetId).toBe('hard')
  })

  it('rejects an unknown quiz mode', () => {
    const harness = createHarness(script())
    const rejection = harness.expectReject({ type: 'START_GAME', quizId: 'atlantis' })
    expect(rejection.reason).toBe('unknown-quiz')
  })

  it('rejects a difficulty where the quiz mode offers none', () => {
    const harness = createHarness(script())
    const rejection = harness.expectReject({ type: 'START_GAME', quizId: 'kids', presetId: 'easy' })
    expect(rejection.reason).toBe('invalid-difficulty')
  })

  it('requires a difficulty where the quiz mode offers one', () => {
    const harness = createHarness(script())
    const rejection = harness.expectReject({ type: 'START_GAME', quizId: 'bundestag' })
    expect(rejection.reason).toBe('invalid-difficulty')
  })

  it('rejects a level that does not exist in this quiz mode', () => {
    const harness = createHarness(script())
    const rejection = harness.expectReject({ type: 'START_GAME', quizId: 'bundestag', presetId: 'regional' })
    expect(rejection.reason).toBe('invalid-difficulty')
  })

  it('rejects an audience next to the quiz mode - that would be a second setting', () => {
    const harness = createHarness(script())
    const rejection = harness.expectReject({
      type: 'START_GAME',
      quizId: 'bundestag',
      presetId: 'medium',
      audience: 'kids',
    })
    expect(rejection.reason).toBe('invalid-payload')
  })

  it('still starts without a quiz mode when audience and preset are given', () => {
    const harness = createHarness(script())
    const state = harness.dispatch({ type: 'START_GAME', audience: 'adults', presetId: 'medium' })
    expect(state.quizId).toBeUndefined()
    expect(state.audience).toBe('adults')
  })

  it('rejects a start without any setting', () => {
    const harness = createHarness(script())
    expect(harness.expectReject({ type: 'START_GAME' }).reason).toBe('invalid-payload')
  })
})

describe('Theme and offer list in the stage view', () => {
  it('shows all offers and no running quiz before the game', () => {
    const harness = createHarness(script())
    const view = harness.publicView()
    expect(view.scene).toBe('start')
    expect(view.quizId).toBeUndefined()
    expect(view.quizOffers.map((offer) => offer.id)).toEqual(['bundestag', 'kids', 'bremen'])
  })

  it('carries the offers without audience, pool and preset - the stage should derive nothing', () => {
    const harness = createHarness(script())
    const [offer] = harness.publicView().quizOffers
    /*
     * What the hall is told: the name, the motif where there is one, and which
     * card takes the row. Audience, pools, presets and theme are not in it -
     * they would be configuration, and a stage that could read it could derive
     * from it.
     */
    expect(Object.keys(offer!).sort()).toEqual(['emphasis', 'id', 'label'])
  })

  it('gives the Bundestag quiz the light default theme', () => {
    const harness = createHarness(script())
    harness.dispatch({ type: 'START_GAME', quizId: 'bundestag', presetId: 'medium' })
    const view = harness.publicView()
    expect(view.quizId).toBe('bundestag')
    expect(view.theme.id).toBe('default')
    expect(view.theme.skin).toBeUndefined()
  })

  it('gives the kids quiz the kids world', () => {
    const harness = createHarness(script())
    harness.dispatch({ type: 'START_GAME', quizId: 'kids' })
    expect(harness.publicView().theme.skin).toBe('kids')
  })

  it('leaves the Bremen quiz in the default theme - a colourful card is not a theme', () => {
    const harness = createHarness(script())
    harness.dispatch({ type: 'START_GAME', quizId: 'bremen' })
    const view = harness.publicView()
    expect(view.theme.id).toBe('default')
    expect(view.theme.skin).toBeUndefined()
  })

  it('keeps the confirmed configuration across a new projection', () => {
    const harness = createHarness(script())
    harness.dispatch({ type: 'START_GAME', quizId: 'bundestag', presetId: 'hard' })
    // A newly connected client gets the same state projected afresh.
    const first = harness.publicView()
    const second = harness.publicView()
    expect(second.quizId).toBe(first.quizId)
    expect(second.theme.id).toBe(first.theme.id)
    expect(harness.state?.presetId).toBe('hard')
  })
})

describe('Operator catalogue', () => {
  it('says for every quiz mode whether it has a difficulty choice', () => {
    const harness = createHarness(script())
    const quizzes = harness.operatorView().catalog.quizzes
    expect(quizzes.map((quiz) => [quiz.id, quiz.supportsDifficulty])).toEqual([
      ['bundestag', true],
      ['kids', false],
      ['bremen', false],
    ])
  })

  it('names the levels of the Bundestag quiz in the order of the offer', () => {
    const harness = createHarness(script())
    const bundestag = harness.operatorView().catalog.quizzes.find((quiz) => quiz.id === 'bundestag')
    expect(bundestag?.presetIds).toEqual(['easy', 'medium', 'hard'])
    expect(bundestag?.defaultPresetId).toBe('medium')
  })
})
