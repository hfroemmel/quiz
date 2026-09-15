/**
 * The start menu as a model, and the rules of the package.
 *
 * Two promises are checked here. First: everything a menu shows comes out of
 * the configuration - offers, order, artwork, player counts, difficulty
 * choice, languages. Second: a package that configures nothing plays exactly
 * as before, because every rule has the constant of the house as its default.
 */
import { describe, expect, it } from 'vitest'
import {
  deriveStartMenu,
  gameTiming,
  orderedQuizzes,
  playerCountsOf,
  projectOperator,
  resolveRules,
  scoringRules,
  selfServiceTiming,
  type QuizConfig,
} from '../src'
import { testConfig } from './helpers'

/** The catalogue as the desk sees it - through the projection, not by hand. */
function catalogOf(config: QuizConfig, locale = 'de-DE') {
  const view = projectOperator(null, {
    nowMs: 0,
    config,
    assetUrl: (assetId: string | undefined) => (assetId ? `/media/${assetId}` : undefined),
    contentVersion: 'test',
    eventDayId: 'event-day-test',
    locale,
  })
  return view.catalog
}

describe('quiz definition', () => {
  it('offers both player counts where the configuration says nothing', () => {
    expect(playerCountsOf({})).toEqual([1, 2])
  })

  it('takes the configured player counts, in the order of the offer', () => {
    expect(playerCountsOf({ playerCounts: [1] })).toEqual([1])
    expect(playerCountsOf({ playerCounts: [2, 1] })).toEqual([2, 1])
  })

  it('drops a player count named twice - one card per count', () => {
    expect(playerCountsOf({ playerCounts: [2, 2, 1] })).toEqual([2, 1])
  })

  it('places what states an order first, the rest in the order of the configuration', () => {
    const quizzes = [
      { id: 'c', label: 'C', audienceId: 'adults', themeId: 'default', presetIds: ['medium'], order: 30 },
      { id: 'a', label: 'A', audienceId: 'adults', themeId: 'default', presetIds: ['medium'], order: 10 },
      { id: 'b', label: 'B', audienceId: 'adults', themeId: 'default', presetIds: ['medium'] },
    ]
    expect(orderedQuizzes(quizzes).map((quiz) => quiz.id)).toEqual(['a', 'c', 'b'])
    expect(orderedQuizzes(undefined)).toEqual([])
  })
})

describe('rules of the package', () => {
  it('is the house rules where the package says nothing', () => {
    const rules = resolveRules(undefined)
    expect(rules.scoring).toEqual(scoringRules)
    expect(rules.timing).toEqual(gameTiming)
    expect(rules.selfServiceTiming).toEqual(selfServiceTiming)
    expect(rules.jokersEnabled).toBe(true)
    expect(rules.idleTimeoutMs).toBeUndefined()
    expect(rules.showDetailsAfterSolution).toBe(false)
  })

  it('replaces exactly the values that are configured', () => {
    const rules = resolveRules({ scoring: { firstAnswerPoints: 200 }, timing: { pauseScreenMs: 1_000 } })
    expect(rules.scoring.firstAnswerPoints).toBe(200)
    expect(rules.scoring.secondChancePoints).toBe(scoringRules.secondChancePoints)
    expect(rules.timing.pauseScreenMs).toBe(1_000)
    expect(rules.timing.correctFeedbackMs).toBe(gameTiming.correctFeedbackMs)
  })

  it('splits the timing block into the two groups the engine reads', () => {
    const rules = resolveRules({ timing: { questionLeadInMs: 0, imageRevealDurationMs: 5_000 } })
    expect(rules.selfServiceTiming.questionLeadInMs).toBe(0)
    expect(rules.selfServiceTiming.videoLeadInMs).toBe(selfServiceTiming.videoLeadInMs)
    expect(rules.timing.imageRevealDurationMs).toBe(5_000)
    expect(rules.timing).not.toHaveProperty('questionLeadInMs')
  })

  it('switches the jokers off on request', () => {
    expect(resolveRules({ jokers: { enabled: false } }).jokersEnabled).toBe(false)
  })

  it('carries the two rules a client needs into the catalogue', () => {
    const plain = catalogOf(testConfig)
    expect(plain.rules).toEqual({ showDetailsAfterSolution: false })

    const configured = catalogOf({
      ...testConfig,
      rules: { idleTimeoutMs: 90_000, showDetailsAfterSolution: true },
    })
    expect(configured.rules).toEqual({ idleTimeoutMs: 90_000, showDetailsAfterSolution: true })
  })
})

describe('deriveStartMenu', () => {
  it('turns the configured quizzes into offers, in the order of the menu', () => {
    const config: QuizConfig = {
      ...testConfig,
      quizzes: [
        { ...testConfig.quizzes![0]!, order: 20, playerCounts: [1, 2], emphasis: 'wide' },
        { ...testConfig.quizzes![1]!, order: 10, playerCounts: [1] },
        { ...testConfig.quizzes![2]!, order: 30 },
      ],
    }
    const menu = deriveStartMenu(config, catalogOf(config), 'de-DE')

    expect(menu.offers.map((offer) => offer.quizId)).toEqual(['kids', 'bundestag', 'bremen'])
    expect(menu.offers[1]).toMatchObject({ label: 'Bundestagsquiz', emphasis: 'wide', playerCounts: [1, 2] })
    expect(menu.offers[0]).toMatchObject({ playerCounts: [1], emphasis: 'regular' })
    // Nothing configured means both counts - the menu invents nothing.
    expect(menu.offers[2]!.playerCounts).toEqual([1, 2])
  })

  it('offers the difficulty choice only where the quiz has one, with its default', () => {
    const menu = deriveStartMenu(testConfig, catalogOf(testConfig), 'de-DE')
    const bundestag = menu.offers.find((offer) => offer.quizId === 'bundestag')!
    // Every level names the length of its round - that is what its card says.
    expect(bundestag.difficulties).toEqual([
      { presetId: 'easy', label: 'Leicht', isDefault: false, slotCount: 1 },
      { presetId: 'medium', label: 'Mittel', isDefault: true, slotCount: 1 },
      { presetId: 'hard', label: 'Schwer', isDefault: false, slotCount: 1 },
    ])
    expect(menu.offers.find((offer) => offer.quizId === 'kids')!.difficulties).toBeUndefined()
  })

  it('collects the player counts of all offers, ascending', () => {
    const config: QuizConfig = {
      ...testConfig,
      quizzes: [
        { ...testConfig.quizzes![0]!, playerCounts: [2] },
        { ...testConfig.quizzes![1]!, playerCounts: [1] },
      ],
    }
    const menu = deriveStartMenu(config, catalogOf(config), 'de-DE')
    expect(menu.playModes.map((mode) => mode.playerCount)).toEqual([1, 2])
    expect(menu.playModes.map((mode) => mode.textKey)).toEqual(['kiosk.solo', 'kiosk.duo'])
    // Without a configured wording the interface keeps its own.
    expect(menu.playModes.every((mode) => mode.label === undefined)).toBe(true)
  })

  it('takes the wording of a play mode from the package where it is configured', () => {
    const config: QuizConfig = {
      ...testConfig,
      interfaceStrings: { 'de-DE': { 'kiosk.solo': 'Ich allein' } },
    }
    const menu = deriveStartMenu(config, catalogOf(config), 'de-DE')
    expect(menu.playModes.find((mode) => mode.playerCount === 1)?.label).toBe('Ich allein')
    expect(menu.playModes.find((mode) => mode.playerCount === 2)?.label).toBeUndefined()
  })

  it('settles what there is only one of - and asks nothing', () => {
    const config: QuizConfig = {
      ...testConfig,
      quizzes: [{ ...testConfig.quizzes![1]!, playerCounts: [1] }],
    }
    const menu = deriveStartMenu(config, catalogOf(config), 'de-DE')
    expect(menu.preselect).toEqual({ quizId: 'kids', playerCount: 1 })
  })

  it('asks where there is something to choose', () => {
    const menu = deriveStartMenu(testConfig, catalogOf(testConfig), 'de-DE')
    expect(menu.preselect).toBeUndefined()
  })

  it('reports the artwork of a card as a URL', () => {
    const config: QuizConfig = {
      ...testConfig,
      quizzes: [{ ...testConfig.quizzes![0]!, artworkAssetId: 'art-bundestag' }],
    }
    const menu = deriveStartMenu(config, catalogOf(config), 'de-DE')
    expect(menu.offers[0]!.artworkUrl).toBe('/media/art-bundestag')
  })

  it('never returns an empty menu: without quizzes the audiences are the offer', () => {
    const config: QuizConfig = { ...testConfig, quizzes: undefined }
    const menu = deriveStartMenu(config, catalogOf(config), 'de-DE')

    expect(menu.offers.map((offer) => offer.audienceId)).toEqual(['adults', 'kids'])
    expect(menu.offers.every((offer) => offer.quizId === undefined)).toBe(true)
    expect(menu.offers[0]!.difficulties).toEqual([
      { presetId: 'easy', label: 'Leicht', isDefault: true, slotCount: 1 },
      { presetId: 'medium', label: 'Mittel', isDefault: false, slotCount: 1 },
      { presetId: 'hard', label: 'Schwer', isDefault: false, slotCount: 1 },
    ])
    /*
     * The kids' audience allows exactly one level. It is named all the same -
     * the start command needs its id - and that there is nothing to choose
     * there is said by the length, not by a missing list.
     */
    expect(menu.offers[1]!.difficulties).toEqual([
      { presetId: 'easy', label: 'Leicht', isDefault: true, slotCount: 1 },
    ])
  })

  it('says a quiz cannot be started, and why, instead of failing at the start', () => {
    const config: QuizConfig = {
      ...testConfig,
      quizzes: [
        { ...testConfig.quizzes![0]! },
        { ...testConfig.quizzes![2]!, id: 'europa', label: 'Europa-Quiz', poolIds: ['europa'] },
      ],
    }
    const menu = deriveStartMenu(config, catalogOf(config), 'de-DE')
    expect(menu.offers.find((offer) => offer.quizId === 'bundestag')).toMatchObject({ available: true })
    expect(menu.offers.find((offer) => offer.quizId === 'europa')).toMatchObject({
      available: false,
      unavailableReason: 'missing-pool',
    })
  })

  it('reports an empty question set the way the server hands it in', () => {
    const view = projectOperator(null, {
      nowMs: 0,
      config: testConfig,
      assetUrl: () => undefined,
      contentVersion: 'test',
      eventDayId: 'event-day-test',
      quizAvailability: { kids: 'no-questions' },
    })
    const menu = deriveStartMenu(testConfig, view.catalog, 'de-DE')
    expect(menu.offers.find((offer) => offer.quizId === 'kids')).toMatchObject({
      available: false,
      unavailableReason: 'no-questions',
    })
  })

  it('resolves labels and the language list for the chosen locale', () => {
    const config: QuizConfig = {
      ...testConfig,
      locales: [
        { id: 'de-DE', label: 'Deutsch' },
        { id: 'en-GB', label: 'English' },
      ],
      quizzes: [{ ...testConfig.quizzes![0]!, labels: { 'en-GB': 'Bundestag Quiz' } }],
    }
    const menu = deriveStartMenu(config, catalogOf(config, 'en-GB'), 'en-GB')
    expect(menu.locale).toBe('en-GB')
    expect(menu.offers[0]!.label).toBe('Bundestag Quiz')
    expect(menu.locales.map((entry) => entry.id)).toEqual(['de-DE', 'en-GB'])
  })
})
