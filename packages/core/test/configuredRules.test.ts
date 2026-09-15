/**
 * What a package configures, the engine plays.
 *
 * The values in `config.rules` are not decoration: they reach the game through
 * the engine context. A package that configures nothing plays with the
 * constants of the house - that case is pinned down in every other test file,
 * so here only the configured one is checked, and always against the effect,
 * never against the setting.
 */
import { describe, expect, it } from 'vitest'
import { gameTiming } from '../src'
import { buzzIn, createHarness, makeQuestion, startGame } from './helpers'

const sevenNormal = () =>
  Array.from({ length: 7 }, (_, index) =>
    makeQuestion({ id: `q${index + 1}`, questionType: 'text-choice', evaluationMode: 'option-comparison' }),
  )

describe('scoring out of the package', () => {
  it('books the configured points for a first correct answer', () => {
    const harness = createHarness(sevenNormal(), { rules: { scoring: { firstAnswerPoints: 200 } } })
    startGame(harness)
    buzzIn(harness, 'player-1')

    harness.dispatch({ type: 'LOG_OPTION_ANSWER', optionId: 'a' })
    harness.dispatch({ type: 'RESOLVE_ATTEMPT' })

    expect(harness.state!.players[0]!.score).toBe(200)
    expect(harness.scoreTransactions).toEqual([expect.objectContaining({ playerId: 'player-1', delta: 200 })])
  })

  it('books the configured points for a correct second chance', () => {
    const harness = createHarness(sevenNormal(), { rules: { scoring: { secondChancePoints: 10 } } })
    startGame(harness)
    buzzIn(harness, 'player-1')

    harness.dispatch({ type: 'LOG_OPTION_ANSWER', optionId: 'b' })
    harness.dispatch({ type: 'RESOLVE_ATTEMPT' })
    harness.settle()
    expect(harness.state!.phase).toBe('second-chance')

    harness.dispatch({ type: 'LOG_OPTION_ANSWER', optionId: 'a' })
    harness.dispatch({ type: 'RESOLVE_ATTEMPT' })
    expect(harness.state!.players[1]!.score).toBe(10)
  })

  it('corrects by the configured step', () => {
    const harness = createHarness(sevenNormal(), { rules: { scoring: { manualAdjustmentStep: 25 } } })
    startGame(harness)

    harness.dispatch({ type: 'ADJUST_SCORE', playerId: 'player-2', direction: 'increase' })
    expect(harness.state!.players[1]!.score).toBe(25)
  })

  it('reports the configured points to the moderator as what the answer is worth', () => {
    const harness = createHarness(sevenNormal(), { rules: { scoring: { firstAnswerPoints: 200 } } })
    startGame(harness)
    buzzIn(harness, 'player-1')
    expect(harness.moderatorView().answering?.pointsIfCorrect).toBe(200)
  })
})

describe('timings out of the package', () => {
  it('holds the pause screen for the configured time', () => {
    const harness = createHarness(sevenNormal(), { rules: { timing: { pauseScreenMs: 500 } } })
    harness.dispatch({ type: 'START_GAME', audience: 'adults', presetId: 'medium' })
    expect(harness.state!.phase).toBe('pause-screen')

    harness.advance(499)
    expect(harness.state!.phase).toBe('pause-screen')
    harness.advance(1)
    expect(harness.state!.phase).not.toBe('pause-screen')
  })

  it('leaves the timings the package says nothing about alone', () => {
    const harness = createHarness(sevenNormal(), { rules: { timing: { pauseScreenMs: 500 } } })
    startGame(harness)
    buzzIn(harness, 'player-1')
    harness.dispatch({ type: 'LOG_OPTION_ANSWER', optionId: 'a' })
    harness.dispatch({ type: 'RESOLVE_ATTEMPT' })

    harness.advance(gameTiming.correctFeedbackMs + gameTiming.solutionDelayMs - 1)
    expect(harness.state!.phase).toBe('attempt-feedback')
    harness.advance(1)
    expect(harness.state!.phase).toBe('solution')
  })
})

describe('jokers out of the package', () => {
  it('starts an operated game with jokers where the package says nothing', () => {
    const harness = createHarness(sevenNormal())
    startGame(harness)
    expect(harness.state!.jokerByPlayer).toBeDefined()
    expect(harness.operatorView().joker).toBeDefined()
  })

  it('starts a game without a joker supply where the package switches them off', () => {
    const harness = createHarness(sevenNormal(), { rules: { jokers: { enabled: false } } })
    startGame(harness)
    expect(harness.state!.jokerByPlayer).toBeUndefined()

    buzzIn(harness, 'player-1')
    expect(harness.expectReject({ type: 'DRAW_JOKER' }).reason).toBeTruthy()
  })
})
