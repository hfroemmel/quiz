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
import { gameTiming, jokerRevealAtMs } from '../src'
import { activeJokerSequence } from '../src/contracts/joker'
import { buzzIn, createHarness, makeQuestion, startGame, type Harness } from './helpers'

const sevenNormal = () =>
  Array.from({ length: 7 }, (_, index) =>
    makeQuestion({ id: `q${index + 1}`, questionType: 'text-choice', evaluationMode: 'option-comparison' }),
  )

/** Seven questions with two answers each - too short for a 50:50 to work on. */
const sevenShort = () =>
  Array.from({ length: 7 }, (_, index) =>
    makeQuestion({
      id: `q${index + 1}`,
      options: [
        { id: 'a', text: 'Antwort A' },
        { id: 'b', text: 'Antwort B' },
      ],
    }),
  )

/** The whole draw, up to the effect being applied - the server turns the card. */
function drawJoker(harness: Harness): void {
  harness.dispatch({ type: 'DRAW_JOKER' })
  harness.advance(jokerRevealAtMs)
  const active = activeJokerSequence(harness.state!.jokerSequence)!
  harness.dispatch({ type: 'CONTINUE_JOKER', sequenceId: active.sequenceId })
}

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

  /*
   * A NARROWED POOL IS NOT A SWITCHED-OFF JOKER. The game still has a supply,
   * the desk still has its button - what changes is only what can come out of
   * the draw, and the room is told that before the card turns.
   */
  it('draws only what the package offers, however the coin falls', () => {
    const harness = createHarness(sevenNormal(), {
      rules: { jokers: { types: ['audience'] } },
      /* Zero would be the first entry of the full pool - the 50:50. */
      random: () => 0,
    })
    startGame(harness)
    buzzIn(harness, 'player-1')
    drawJoker(harness)

    expect(harness.state!.jokerByPlayer!['player-1']).toMatchObject({ status: 'used', type: 'audience' })
    /* And nothing was removed from the question - that is the other joker's effect. */
    expect(harness.publicView().visibleOptions?.every((option) => !option.eliminated)).toBe(true)
  })

  it('tells the desk in advance what the draw will be', () => {
    const harness = createHarness(sevenNormal(), { rules: { jokers: { types: ['audience'] } } })
    startGame(harness)
    buzzIn(harness, 'player-1')

    expect(harness.operatorView().joker?.canDraw).toBe(true)
    expect(harness.operatorView().joker?.onlyType).toBe('audience')
  })

  /*
   * THE POOL BELONGS TO THE GAME, like the supply beside it: it is written once
   * at the start, so a package edited between two rounds cannot change what the
   * joker in the running round may become.
   */
  it('pins the pool onto the game it was started with', () => {
    const harness = createHarness(sevenNormal(), { rules: { jokers: { types: ['audience'] } } })
    startGame(harness)
    expect(harness.state!.jokerTypes).toEqual(['audience'])
  })

  it('leaves both variants in the pool where the package says nothing', () => {
    const harness = createHarness(sevenNormal())
    startGame(harness)
    expect(harness.state!.jokerTypes).toEqual(['fiftyFifty', 'audience'])
  })

  /*
   * A SHORT QUESTION IS ONLY UNSUITABLE WHILE THERE ARE TWO VARIANTS.
   *
   * With both on offer the draw stays shut on a two-answer question: the coin
   * could hand the player the audience joker merely because their question was
   * short, and that is luck deciding how much help somebody gets. Where the
   * house offers one variant there is no coin and no lesser help - the joker is
   * what it always is, and refusing it would take it away for a reason that no
   * longer exists.
   */
  it('still draws on a short question where only the audience joker is offered', () => {
    const full = createHarness(sevenShort())
    startGame(full)
    buzzIn(full, 'player-1')
    expect(full.expectReject({ type: 'DRAW_JOKER' }).reason).toBeTruthy()

    const narrowed = createHarness(sevenShort(), { rules: { jokers: { types: ['audience'] } } })
    startGame(narrowed)
    buzzIn(narrowed, 'player-1')
    expect(narrowed.operatorView().joker?.canDraw).toBe(true)
    drawJoker(narrowed)
    expect(narrowed.state!.jokerByPlayer!['player-1']).toMatchObject({ status: 'used', type: 'audience' })
  })
})

describe('the second chance out of the package', () => {
  it('hands a wrong answer to the opponent where the package says nothing', () => {
    const harness = createHarness(sevenNormal())
    startGame(harness)
    buzzIn(harness, 'player-1')

    harness.dispatch({ type: 'LOG_OPTION_ANSWER', optionId: 'b' })
    harness.dispatch({ type: 'RESOLVE_ATTEMPT' })
    harness.settle()
    expect(harness.state!.phase).toBe('second-chance')
  })

  /*
   * THE QUESTION BELONGS TO WHOEVER BUZZED FIRST. A wrong answer ends it, and
   * what follows is the solution - the opponent is never asked, so there is
   * nothing for them to answer either.
   */
  it('goes straight to the solution where the package switches it off', () => {
    const harness = createHarness(sevenNormal(), { rules: { secondChance: false } })
    startGame(harness)
    buzzIn(harness, 'player-1')

    harness.dispatch({ type: 'LOG_OPTION_ANSWER', optionId: 'b' })
    harness.dispatch({ type: 'RESOLVE_ATTEMPT' })
    harness.settle()

    expect(harness.state!.phase).toBe('solution')
    expect(harness.state!.players[1]!.score).toBe(0)
    /* And the opponent has nothing to answer with - the question is over. */
    expect(harness.expectReject({ type: 'LOG_OPTION_ANSWER', optionId: 'a' }).reason).toBeTruthy()
  })

  /*
   * THE PICTURE QUESTION KEEPS ITS OWN RULE. There both players buzz again
   * until the image stands - that is the question's rule, not the house's, and
   * this setting does not reach into it.
   */
  it('leaves the image reveal to its own rule', () => {
    const pictures = Array.from({ length: 7 }, (_, index) =>
      makeQuestion({
        id: `q${index + 1}`,
        questionType: 'image-reveal',
        evaluationMode: 'manual-correct-incorrect',
        options: undefined,
        correctOptionId: undefined,
        acceptedAnswerText: ['Brandenburger Tor'],
        image: { filename: 'questions/img-1.jpg' },
      }),
    )
    const harness = createHarness(pictures, { rules: { secondChance: false } })
    startGame(harness)
    buzzIn(harness, 'player-1')

    harness.dispatch({ type: 'MARK_MANUAL_ANSWER', verdict: 'incorrect' })
    harness.dispatch({ type: 'RESOLVE_ATTEMPT' })
    harness.settle()

    expect(harness.state!.phase).toBe('reveal-running')
  })
})
