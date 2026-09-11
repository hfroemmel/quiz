/**
 * Lifeline rules, in the engine and in what the engine hands to a client.
 *
 * Every test here runs without a server, a browser or real time. The source of
 * chance is injected, so "which wrong answer survives" is a decision of the
 * test and not of luck.
 */
import { describe, expect, it } from 'vitest'
import {
  createPlayerLifelines,
  enabledLifelineTypes,
  gameTiming,
  lifelineRules,
  lifelinesOf,
  normalizeLifelineConfig,
  roleMayIssue,
  type LifelineType,
  type PlayerId,
  type PlayerState,
} from '../src'
import { pickFiftyFiftyHiddenOptions } from '../src/engine/lifelines'
import { availableCommands } from '../src/engine/allowedCommands'
import { buzzIn, createHarness, makeQuestion, releaseRound, startGame, type Harness } from './helpers'

/** An installation that offers both lifelines, triggered by the operator. */
const bothLifelines = {
  enabled: true,
  types: { fiftyFifty: true, audience: true },
  activationMode: 'operator' as const,
}

const fourAnswers = (id: string) => makeQuestion({ id })
const threeAnswers = (id: string) =>
  makeQuestion({
    id,
    options: [
      { id: 'a', text: 'Antwort A' },
      { id: 'b', text: 'Antwort B' },
      { id: 'c', text: 'Antwort C' },
    ],
  })
const twoAnswers = (id: string) =>
  makeQuestion({
    id,
    options: [
      { id: 'a', text: 'Antwort A' },
      { id: 'b', text: 'Antwort B' },
    ],
  })
/** A free-answer picture question - no options, so no 50:50. */
const pictureQuestion = (id: string) =>
  makeQuestion({
    id,
    questionType: 'image-reveal',
    evaluationMode: 'manual-correct-incorrect',
    options: undefined,
    correctOptionId: undefined,
    acceptedAnswerText: ['Brandenburger Tor'],
    media: { imageAssetId: 'img-1' },
  })

const script = (make: (id: string) => ReturnType<typeof makeQuestion>) =>
  Array.from({ length: 7 }, (_, index) => make(`q${index + 1}`))

/** Always keeps the FIRST wrong answer in `optionOrder`, whatever the count. */
const keepFirstIncorrect = () => 0

function withLifelines(
  questions = script(fourAnswers),
  random: () => number = keepFirstIncorrect,
): Harness {
  return createHarness(questions, { lifelines: bothLifelines, random })
}

function usageOf(harness: Harness, playerId: PlayerId, type: LifelineType): boolean {
  return lifelinesOf(harness.state!.players.find((player) => player.id === playerId)!)[type].used
}

/** The options the room can actually still pick. */
function visibleOptionIds(harness: Harness): string[] {
  return (harness.publicView().visibleOptions ?? []).filter((option) => !option.hidden).map((option) => option.id)
}

/** Plays the current question to its solution so the next one can be reached. */
function answerAndContinue(harness: Harness, playerId: PlayerId = 'player-1'): void {
  buzzIn(harness, playerId)
  harness.dispatch({ type: 'LOG_OPTION_ANSWER', optionId: 'a' })
  harness.dispatch({ type: 'RESOLVE_ATTEMPT' })
  harness.settle()
  harness.dispatch({ type: 'CONTINUE' })
  harness.advance(gameTiming.pauseScreenMs)
}

describe('configuration', () => {
  it('is off by default and stays off when no type is offered', () => {
    expect(normalizeLifelineConfig().enabled).toBe(false)
    // Enabled without a single type is the same as not enabled - normalized once, here.
    expect(normalizeLifelineConfig({ enabled: true }).enabled).toBe(false)
    expect(enabledLifelineTypes(normalizeLifelineConfig(bothLifelines))).toEqual(['fiftyFifty', 'audience'])
  })

  it('leaves the game untouched where it is disabled', () => {
    const harness = createHarness(script(fourAnswers))
    startGame(harness)
    releaseRound(harness)

    // No status anywhere in the view models, so no client renders anything.
    expect(harness.publicView().playerScores[0]?.lifelines).toBeUndefined()
    expect(harness.operatorView().lifelines).toBeUndefined()
    expect(availableCommands(harness.state)).not.toContain('USE_LIFELINE')

    const rejection = harness.expectReject({
      type: 'USE_LIFELINE',
      playerId: 'player-1',
      lifelineType: 'fiftyFifty',
    })
    expect(rejection.reason).toBe('lifelines-disabled')
  })

  it('offers only the types it was given', () => {
    const harness = createHarness(script(fourAnswers), {
      lifelines: { enabled: true, types: { fiftyFifty: true, audience: false } },
    })
    startGame(harness)
    releaseRound(harness)

    expect(harness.publicView().playerScores[0]?.lifelines?.map((entry) => entry.type)).toEqual(['fiftyFifty'])
    expect(
      harness.expectReject({ type: 'USE_LIFELINE', playerId: 'player-1', lifelineType: 'audience' }).reason,
    ).toBe('lifeline-type-disabled')
  })
})

describe('availability per player', () => {
  it('starts every player with both lifelines available', () => {
    const harness = withLifelines()
    startGame(harness)

    for (const playerId of ['player-1', 'player-2'] as const) {
      expect(usageOf(harness, playerId, 'fiftyFifty')).toBe(false)
      expect(usageOf(harness, playerId, 'audience')).toBe(false)
    }
    expect(harness.publicView().playerScores).toHaveLength(2)
    for (const score of harness.publicView().playerScores) {
      expect(score.lifelines).toEqual([
        { type: 'fiftyFifty', used: false },
        { type: 'audience', used: false },
      ])
    }
  })

  it('spends the lifelines of the two players independently', () => {
    const harness = withLifelines()
    startGame(harness)
    releaseRound(harness)

    harness.dispatch({ type: 'USE_LIFELINE', playerId: 'player-1', lifelineType: 'fiftyFifty' })
    harness.dispatch({ type: 'USE_LIFELINE', playerId: 'player-2', lifelineType: 'audience' })

    expect(usageOf(harness, 'player-1', 'fiftyFifty')).toBe(true)
    expect(usageOf(harness, 'player-1', 'audience')).toBe(false)
    expect(usageOf(harness, 'player-2', 'fiftyFifty')).toBe(false)
    expect(usageOf(harness, 'player-2', 'audience')).toBe(true)
  })

  it('spends each lifeline at most once per player', () => {
    const harness = withLifelines()
    startGame(harness)
    releaseRound(harness)
    harness.dispatch({ type: 'USE_LIFELINE', playerId: 'player-1', lifelineType: 'audience' })

    const rejection = harness.expectReject({
      type: 'USE_LIFELINE',
      playerId: 'player-1',
      lifelineType: 'audience',
    })
    expect(rejection.reason).toBe('lifeline-already-used')
  })

  it('refuses a player who is not in this game', () => {
    const harness = createHarness(script(fourAnswers), { lifelines: bothLifelines })
    startGame(harness, { playerCount: 1 })
    releaseRound(harness)

    expect(
      harness.expectReject({ type: 'USE_LIFELINE', playerId: 'player-2', lifelineType: 'audience' }).reason,
    ).toBe('unknown-player')
  })
})

describe('lifetime', () => {
  it('keeps a spent lifeline spent across a question change', () => {
    const harness = withLifelines()
    startGame(harness)
    releaseRound(harness)
    harness.dispatch({ type: 'USE_LIFELINE', playerId: 'player-1', lifelineType: 'fiftyFifty' })

    answerAndContinue(harness)

    expect(harness.state!.currentQuestion?.question.id).toBe('q2')
    expect(usageOf(harness, 'player-1', 'fiftyFifty')).toBe(true)
    expect(
      harness.expectReject({ type: 'USE_LIFELINE', playerId: 'player-1', lifelineType: 'fiftyFifty' }).reason,
    ).toBe('lifeline-already-used')
  })

  it('drops the 50:50 effect with the question, and only the effect', () => {
    const harness = withLifelines()
    startGame(harness)
    releaseRound(harness)
    harness.dispatch({ type: 'USE_LIFELINE', playerId: 'player-1', lifelineType: 'fiftyFifty' })
    expect(harness.state!.activeFiftyFifty).toBeDefined()
    expect(visibleOptionIds(harness)).toHaveLength(2)

    answerAndContinue(harness)

    expect(harness.state!.activeFiftyFifty).toBeUndefined()
    releaseRound(harness)
    // Every answer of the new question is on screen again.
    expect(visibleOptionIds(harness)).toHaveLength(4)
    // ... while the lifeline stays gone.
    expect(usageOf(harness, 'player-1', 'fiftyFifty')).toBe(true)
  })

  it('hands every lifeline back on a new game', () => {
    const harness = withLifelines()
    startGame(harness)
    releaseRound(harness)
    harness.dispatch({ type: 'USE_LIFELINE', playerId: 'player-1', lifelineType: 'fiftyFifty' })
    harness.dispatch({ type: 'USE_LIFELINE', playerId: 'player-2', lifelineType: 'audience' })
    harness.dispatch({ type: 'ABORT_GAME' })

    startGame(harness)
    for (const playerId of ['player-1', 'player-2'] as const) {
      expect(usageOf(harness, playerId, 'fiftyFifty')).toBe(false)
      expect(usageOf(harness, playerId, 'audience')).toBe(false)
    }
    expect(harness.state!.activeFiftyFifty).toBeUndefined()
  })

  it('gives a player with no stored lifelines a fresh, unspent set', () => {
    // A game saved before the feature existed: the field is simply absent.
    const legacy: PlayerState = { id: 'player-1', label: 'Spieler 1', score: 0, lockedForCurrentQuestion: false }
    expect(lifelinesOf(legacy)).toEqual(createPlayerLifelines())
    expect(lifelinesOf(legacy).fiftyFifty.used).toBe(false)
  })
})

describe('the 50:50', () => {
  it('keeps the correct answer and exactly one wrong one', () => {
    const harness = withLifelines()
    startGame(harness)
    releaseRound(harness)
    harness.dispatch({ type: 'USE_LIFELINE', playerId: 'player-1', lifelineType: 'fiftyFifty' })

    const visible = visibleOptionIds(harness)
    expect(visible).toHaveLength(2)
    expect(visible).toContain('a')
    expect(harness.state!.activeFiftyFifty?.hiddenOptionIds).toHaveLength(2)
    // No answer is picked for the player.
    expect(harness.publicView().visibleOptions?.some((option) => option.state === 'chosen')).toBe(false)
  })

  it('removes exactly one wrong answer when there are three', () => {
    const harness = withLifelines(script(threeAnswers))
    startGame(harness)
    releaseRound(harness)
    harness.dispatch({ type: 'USE_LIFELINE', playerId: 'player-1', lifelineType: 'fiftyFifty' })

    expect(harness.state!.activeFiftyFifty?.hiddenOptionIds).toHaveLength(1)
    expect(visibleOptionIds(harness)).toHaveLength(2)
    expect(visibleOptionIds(harness)).toContain('a')
  })

  it('leaves the lifeline unspent on a question with two answers', () => {
    const harness = withLifelines(script(twoAnswers))
    startGame(harness)
    releaseRound(harness)

    const rejection = harness.expectReject({
      type: 'USE_LIFELINE',
      playerId: 'player-1',
      lifelineType: 'fiftyFifty',
    })
    expect(rejection.reason).toBe('lifeline-not-applicable')
    expect(rejection.message).toContain(String(lifelineRules.fiftyFiftyMinOptionCount))
    expect(usageOf(harness, 'player-1', 'fiftyFifty')).toBe(false)
    expect(harness.state!.activeFiftyFifty).toBeUndefined()
  })

  it('leaves the lifeline unspent on a question type it cannot serve', () => {
    const harness = withLifelines(script(pictureQuestion))
    startGame(harness)
    releaseRound(harness)

    expect(
      harness.expectReject({ type: 'USE_LIFELINE', playerId: 'player-1', lifelineType: 'fiftyFifty' }).reason,
    ).toBe('lifeline-not-applicable')
    expect(usageOf(harness, 'player-1', 'fiftyFifty')).toBe(false)
    // The audience lifeline works on such a question - it asks nothing of it.
    harness.dispatch({ type: 'USE_LIFELINE', playerId: 'player-1', lifelineType: 'audience' })
    expect(usageOf(harness, 'player-1', 'audience')).toBe(true)
  })

  it('is refused once an answer is logged, confirmed or resolved', () => {
    const logged = withLifelines()
    startGame(logged)
    buzzIn(logged, 'player-1')
    logged.dispatch({ type: 'LOG_OPTION_ANSWER', optionId: 'b' })
    expect(
      logged.expectReject({ type: 'USE_LIFELINE', playerId: 'player-1', lifelineType: 'fiftyFifty' }).reason,
    ).toBe('answer-not-logged')

    const resolved = withLifelines()
    startGame(resolved)
    buzzIn(resolved, 'player-1')
    resolved.dispatch({ type: 'LOG_OPTION_ANSWER', optionId: 'b' })
    resolved.dispatch({ type: 'RESOLVE_ATTEMPT' })
    // The feedback animation is not a moment for a lifeline at all.
    expect(resolved.state!.phase).toBe('attempt-feedback')
    expect(
      resolved.expectReject({ type: 'USE_LIFELINE', playerId: 'player-1', lifelineType: 'fiftyFifty' }).reason,
    ).toBe('invalid-phase')

    resolved.settle()
    expect(resolved.state!.phase).toBe('second-chance')
    /*
     * The second chance is open for the OTHER player - but not for the 50:50:
     * an answer has been scored, and one wrong answer is already publicly used
     * up. Asking the audience, on the other hand, is exactly what one does here.
     */
    expect(
      resolved.expectReject({ type: 'USE_LIFELINE', playerId: 'player-2', lifelineType: 'fiftyFifty' }).reason,
    ).toBe('attempt-already-resolved')
    resolved.dispatch({ type: 'USE_LIFELINE', playerId: 'player-2', lifelineType: 'audience' })
    expect(usageOf(resolved, 'player-2', 'audience')).toBe(true)
  })

  it('is refused after the solution, and on the result screen', () => {
    const harness = withLifelines()
    startGame(harness)
    buzzIn(harness, 'player-1')
    harness.dispatch({ type: 'LOG_OPTION_ANSWER', optionId: 'a' })
    harness.dispatch({ type: 'RESOLVE_ATTEMPT' })
    harness.settle()

    expect(harness.state!.phase).toBe('solution')
    expect(
      harness.expectReject({ type: 'USE_LIFELINE', playerId: 'player-2', lifelineType: 'fiftyFifty' }).reason,
    ).toBe('invalid-phase')
    // The audience lifeline follows the same phase rule - nothing to ask about.
    expect(
      harness.expectReject({ type: 'USE_LIFELINE', playerId: 'player-2', lifelineType: 'audience' }).reason,
    ).toBe('invalid-phase')
  })

  it('processes two simultaneous activations once', () => {
    const harness = withLifelines()
    startGame(harness)
    releaseRound(harness)

    /*
     * Two operators on the same revision, or one double-click: the first wins,
     * the second is refused, and the hidden answers do not change. The state
     * carries exactly one effect afterwards.
     */
    harness.dispatch({ type: 'USE_LIFELINE', playerId: 'player-1', lifelineType: 'fiftyFifty' })
    const hiddenAfterFirst = [...harness.state!.activeFiftyFifty!.hiddenOptionIds]
    const revisionAfterFirst = harness.state!.revision

    expect(
      harness.expectReject({ type: 'USE_LIFELINE', playerId: 'player-1', lifelineType: 'fiftyFifty' }).reason,
    ).toBe('lifeline-already-used')
    expect(harness.state!.revision).toBe(revisionAfterFirst)
    expect(harness.state!.activeFiftyFifty!.hiddenOptionIds).toEqual(hiddenAfterFirst)

    // And the second player cannot stack a second effect on the same question.
    expect(
      harness.expectReject({ type: 'USE_LIFELINE', playerId: 'player-2', lifelineType: 'fiftyFifty' }).reason,
    ).toBe('lifeline-effect-active')
    expect(usageOf(harness, 'player-2', 'fiftyFifty')).toBe(false)
  })

  it('draws the surviving wrong answer from the injected source of chance', () => {
    const order = ['a', 'b', 'c', 'd']
    // `a` is correct; the wrong ones are b, c, d in that order.
    expect(pickFiftyFiftyHiddenOptions({ correctOptionId: 'a', optionOrder: order, random: () => 0 })).toEqual([
      'c',
      'd',
    ])
    expect(
      pickFiftyFiftyHiddenOptions({ correctOptionId: 'a', optionOrder: order, random: () => 0.99 }),
    ).toEqual(['b', 'c'])
    // Nothing to remove: the shape allows it, the caller must not spend a lifeline.
    expect(
      pickFiftyFiftyHiddenOptions({ correctOptionId: 'a', optionOrder: ['a', 'b'], random: () => 0 }),
    ).toEqual([])
  })

  it('hands the same hidden ids to every client', () => {
    const harness = withLifelines()
    startGame(harness)
    releaseRound(harness)
    harness.dispatch({ type: 'USE_LIFELINE', playerId: 'player-1', lifelineType: 'fiftyFifty' })

    const stage = harness.publicView()
    const operator = harness.operatorView()
    const stored = harness.state!.activeFiftyFifty!.hiddenOptionIds

    expect(stage.activeFiftyFifty?.hiddenOptionIds).toEqual(stored)
    expect(operator.activeFiftyFifty?.hiddenOptionIds).toEqual(stored)
    expect(stage.visibleOptions?.filter((option) => option.hidden).map((option) => option.id)).toEqual(stored)
    expect(operator.visibleOptions?.filter((option) => option.hidden).map((option) => option.id)).toEqual(stored)
    expect(stage.activeFiftyFifty?.playerId).toBe('player-1')
  })
})

describe('restoring', () => {
  it('hands the availability back', () => {
    const harness = withLifelines()
    startGame(harness)
    releaseRound(harness)
    harness.dispatch({ type: 'USE_LIFELINE', playerId: 'player-1', lifelineType: 'audience' })

    harness.dispatch({ type: 'RESTORE_LIFELINE', playerId: 'player-1', lifelineType: 'audience' })
    expect(usageOf(harness, 'player-1', 'audience')).toBe(false)
    // And it can be used again afterwards.
    harness.dispatch({ type: 'USE_LIFELINE', playerId: 'player-1', lifelineType: 'audience' })
    expect(usageOf(harness, 'player-1', 'audience')).toBe(true)
  })

  it('brings the removed answers back while the question still stands', () => {
    const harness = withLifelines()
    startGame(harness)
    releaseRound(harness)
    harness.dispatch({ type: 'USE_LIFELINE', playerId: 'player-1', lifelineType: 'fiftyFifty' })
    expect(visibleOptionIds(harness)).toHaveLength(2)

    harness.dispatch({ type: 'RESTORE_LIFELINE', playerId: 'player-1', lifelineType: 'fiftyFifty' })

    expect(harness.state!.activeFiftyFifty).toBeUndefined()
    expect(visibleOptionIds(harness)).toHaveLength(4)
    expect(usageOf(harness, 'player-1', 'fiftyFifty')).toBe(false)
  })

  it('only restores the availability once the question has moved on', () => {
    const harness = withLifelines()
    startGame(harness)
    releaseRound(harness)
    harness.dispatch({ type: 'USE_LIFELINE', playerId: 'player-1', lifelineType: 'fiftyFifty' })
    answerAndContinue(harness)
    releaseRound(harness)

    harness.dispatch({ type: 'RESTORE_LIFELINE', playerId: 'player-1', lifelineType: 'fiftyFifty' })
    expect(usageOf(harness, 'player-1', 'fiftyFifty')).toBe(false)
    // Nothing was hidden on this question, so nothing comes back.
    expect(visibleOptionIds(harness)).toHaveLength(4)
  })

  it('refuses to restore what was never spent', () => {
    const harness = withLifelines()
    startGame(harness)
    releaseRound(harness)

    expect(
      harness.expectReject({ type: 'RESTORE_LIFELINE', playerId: 'player-1', lifelineType: 'fiftyFifty' }).reason,
    ).toBe('lifeline-not-used')
  })

  it('stays with the operator in every integration', () => {
    expect(roleMayIssue('operator', 'RESTORE_LIFELINE')).toBe(true)
    expect(roleMayIssue('player', 'RESTORE_LIFELINE')).toBe(false)
    expect(roleMayIssue('moderator', 'RESTORE_LIFELINE')).toBe(false)
  })
})

describe('what the operator sees', () => {
  it('names every button, its state and why it is blocked', () => {
    const harness = withLifelines()
    startGame(harness)
    releaseRound(harness)

    const before = harness.operatorView().lifelines!
    expect(before).toHaveLength(4)
    expect(before.map((entry) => `${entry.playerId}:${entry.type}`)).toEqual([
      'player-1:fiftyFifty',
      'player-1:audience',
      'player-2:fiftyFifty',
      'player-2:audience',
    ])
    expect(before.every((entry) => entry.canUse && !entry.used && !entry.canRestore)).toBe(true)
    expect(before.every((entry) => entry.blockedReason === undefined)).toBe(true)
    expect(before[0]?.playerLabel).toBe('Spieler 1')

    harness.dispatch({ type: 'USE_LIFELINE', playerId: 'player-1', lifelineType: 'fiftyFifty' })
    const after = harness.operatorView().lifelines!
    const spent = after.find((entry) => entry.playerId === 'player-1' && entry.type === 'fiftyFifty')!
    expect(spent.used).toBe(true)
    expect(spent.canUse).toBe(false)
    expect(spent.canRestore).toBe(true)
    expect(spent.blockedReason).toContain('schon eingesetzt')

    // The other player's 50:50 is blocked too, but for a different reason.
    const blocked = after.find((entry) => entry.playerId === 'player-2' && entry.type === 'fiftyFifty')!
    expect(blocked.used).toBe(false)
    expect(blocked.canUse).toBe(false)
    expect(blocked.blockedReason).toContain('50:50-Joker aktiv')
  })

  it('offers the commands only while some button is live', () => {
    const harness = withLifelines()
    startGame(harness)
    releaseRound(harness)
    expect(availableCommands(harness.state, { lifelines: bothLifelines })).toContain('USE_LIFELINE')
    expect(availableCommands(harness.state, { lifelines: bothLifelines })).not.toContain('RESTORE_LIFELINE')

    harness.dispatch({ type: 'USE_LIFELINE', playerId: 'player-1', lifelineType: 'audience' })
    expect(availableCommands(harness.state, { lifelines: bothLifelines })).toContain('RESTORE_LIFELINE')
  })
})
