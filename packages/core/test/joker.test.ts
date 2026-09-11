/**
 * The shared joker: its rules, its lifetime and what the engine hands a client.
 *
 * Every test here runs without a server, a browser or real time. The source of
 * chance is injected, so "which wrong answer survives" is a decision of the
 * test and not of luck.
 */
import { describe, expect, it } from 'vitest'
import {
  gameTiming,
  jokerOf,
  jokerRules,
  roleMayIssue,
  type PlayerId,
} from '../src'
import { pickFiftyFiftyHiddenOptions } from '../src/engine/joker'
import { availableCommands } from '../src/engine/allowedCommands'
import { buzzIn, createHarness, makeQuestion, releaseRound, startGame, type Harness } from './helpers'

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

function rig(questions = script(fourAnswers), random: () => number = keepFirstIncorrect): Harness {
  return createHarness(questions, { random })
}

/** Has this player spent their joker - and as what? */
function jokerState(harness: Harness, playerId: PlayerId) {
  return jokerOf(harness.state!.jokerByPlayer, playerId)
}

function isUsed(harness: Harness, playerId: PlayerId): boolean {
  return jokerState(harness, playerId).status === 'used'
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

describe('one joker per player', () => {
  it('starts every player of an operated game with their joker', () => {
    const harness = rig()
    startGame(harness)

    for (const playerId of ['player-1', 'player-2'] as const) {
      expect(jokerState(harness, playerId)).toEqual({ status: 'available' })
      expect(harness.publicView().playerScores.find((score) => score.playerId === playerId)?.joker).toEqual({
        used: false,
      })
    }
  })

  it('spends ONE supply, whichever variant it is spent as', () => {
    const fifty = rig()
    startGame(fifty)
    releaseRound(fifty)
    fifty.dispatch({ type: 'USE_JOKER', playerId: 'player-1', jokerType: 'fiftyFifty' })

    /*
     * THE HEART OF THE FEATURE: after the 50:50 the audience joker is gone too,
     * and the refusal names the variant it was spent as so the operator can
     * tell the room.
     */
    const rejection = fifty.expectReject({ type: 'USE_JOKER', playerId: 'player-1', jokerType: 'audience' })
    expect(rejection.reason).toBe('joker-already-used')
    expect(rejection.message).toContain('50:50-Joker')

    const audience = rig()
    startGame(audience)
    releaseRound(audience)
    audience.dispatch({ type: 'USE_JOKER', playerId: 'player-1', jokerType: 'audience' })
    const other = audience.expectReject({ type: 'USE_JOKER', playerId: 'player-1', jokerType: 'fiftyFifty' })
    expect(other.reason).toBe('joker-already-used')
    expect(other.message).toContain('Publikumsjoker')
  })

  it('records which variant it became, and on which question', () => {
    const harness = rig()
    startGame(harness)
    releaseRound(harness)
    const questionId = harness.state!.currentQuestion!.question.id
    harness.dispatch({ type: 'USE_JOKER', playerId: 'player-2', jokerType: 'audience' })

    const spent = jokerState(harness, 'player-2')
    expect(spent).toMatchObject({ status: 'used', type: 'audience', usedAtQuestionId: questionId })
    expect(spent.status === 'used' && Date.parse(spent.usedAt)).toBeGreaterThan(0)
  })

  it('keeps the two players apart', () => {
    const harness = rig()
    startGame(harness)
    releaseRound(harness)

    harness.dispatch({ type: 'USE_JOKER', playerId: 'player-1', jokerType: 'audience' })
    expect(isUsed(harness, 'player-1')).toBe(true)
    expect(isUsed(harness, 'player-2')).toBe(false)
  })

  it('refuses a player who is not in this game', () => {
    const harness = rig()
    startGame(harness, { playerCount: 1 })
    releaseRound(harness)

    expect(harness.expectReject({ type: 'USE_JOKER', playerId: 'player-2', jokerType: 'audience' }).reason).toBe(
      'unknown-player',
    )
  })

  it('helps whoever is answering, and nobody else', () => {
    const harness = rig()
    startGame(harness)
    buzzIn(harness, 'player-1')

    /*
     * Player 1 holds the buzz, so this question is theirs. A hint for player 2
     * would change nothing on screen except their own supply.
     */
    const rejection = harness.expectReject({ type: 'USE_JOKER', playerId: 'player-2', jokerType: 'audience' })
    expect(rejection.reason).toBe('joker-player-not-answering')
    expect(isUsed(harness, 'player-2')).toBe(false)
    harness.dispatch({ type: 'USE_JOKER', playerId: 'player-1', jokerType: 'audience' })
    expect(isUsed(harness, 'player-1')).toBe(true)
  })

  it('stays with the operator in every integration', () => {
    for (const type of ['USE_JOKER', 'RESTORE_JOKER'] as const) {
      expect(roleMayIssue('operator', type)).toBe(true)
      expect(roleMayIssue('player', type)).toBe(false)
      expect(roleMayIssue('moderator', type)).toBe(false)
      expect(roleMayIssue('system', type)).toBe(false)
    }
  })
})

describe('lifetime', () => {
  it('keeps a spent joker spent across a question change', () => {
    const harness = rig()
    startGame(harness)
    releaseRound(harness)
    harness.dispatch({ type: 'USE_JOKER', playerId: 'player-1', jokerType: 'fiftyFifty' })

    answerAndContinue(harness)

    expect(harness.state!.currentQuestion?.question.id).toBe('q2')
    expect(isUsed(harness, 'player-1')).toBe(true)
    releaseRound(harness)
    expect(harness.expectReject({ type: 'USE_JOKER', playerId: 'player-1', jokerType: 'audience' }).reason).toBe(
      'joker-already-used',
    )
  })

  it('drops the 50:50 effect with the question, and only the effect', () => {
    const harness = rig()
    startGame(harness)
    releaseRound(harness)
    harness.dispatch({ type: 'USE_JOKER', playerId: 'player-1', jokerType: 'fiftyFifty' })
    expect(harness.state!.activeFiftyFifty).toBeDefined()
    expect(visibleOptionIds(harness)).toHaveLength(2)

    answerAndContinue(harness)

    expect(harness.state!.activeFiftyFifty).toBeUndefined()
    releaseRound(harness)
    // Every answer of the new question is on screen again.
    expect(visibleOptionIds(harness)).toHaveLength(4)
    // ... while the joker stays gone.
    expect(isUsed(harness, 'player-1')).toBe(true)
  })

  it('hands every joker back on a new game', () => {
    const harness = rig()
    startGame(harness)
    releaseRound(harness)
    harness.dispatch({ type: 'USE_JOKER', playerId: 'player-1', jokerType: 'fiftyFifty' })
    harness.dispatch({ type: 'ABORT_GAME' })

    startGame(harness)
    for (const playerId of ['player-1', 'player-2'] as const) {
      expect(jokerState(harness, playerId)).toEqual({ status: 'available' })
    }
    expect(harness.state!.activeFiftyFifty).toBeUndefined()
  })
})

describe('the 50:50', () => {
  it('keeps the correct answer and exactly one wrong one', () => {
    const harness = rig()
    startGame(harness)
    releaseRound(harness)
    harness.dispatch({ type: 'USE_JOKER', playerId: 'player-1', jokerType: 'fiftyFifty' })

    const visible = visibleOptionIds(harness)
    expect(visible).toHaveLength(2)
    expect(visible).toContain('a')
    expect(harness.state!.activeFiftyFifty?.hiddenOptionIds).toHaveLength(2)
    // No answer is picked for the player.
    expect(harness.publicView().visibleOptions?.some((option) => option.state === 'chosen')).toBe(false)
  })

  it('removes exactly one wrong answer when there are three', () => {
    const harness = rig(script(threeAnswers))
    startGame(harness)
    releaseRound(harness)
    harness.dispatch({ type: 'USE_JOKER', playerId: 'player-1', jokerType: 'fiftyFifty' })

    expect(harness.state!.activeFiftyFifty?.hiddenOptionIds).toHaveLength(1)
    expect(visibleOptionIds(harness)).toEqual(expect.arrayContaining(['a']))
    expect(visibleOptionIds(harness)).toHaveLength(2)
  })

  it('leaves the joker unspent on a question with two answers', () => {
    const harness = rig(script(twoAnswers))
    startGame(harness)
    releaseRound(harness)

    const rejection = harness.expectReject({ type: 'USE_JOKER', playerId: 'player-1', jokerType: 'fiftyFifty' })
    expect(rejection.reason).toBe('joker-not-applicable')
    expect(rejection.message).toContain(String(jokerRules.fiftyFiftyMinOptionCount))
    expect(isUsed(harness, 'player-1')).toBe(false)
    expect(harness.state!.activeFiftyFifty).toBeUndefined()
  })

  it('leaves the joker unspent on a question type it cannot serve', () => {
    const harness = rig(script(pictureQuestion))
    startGame(harness)
    releaseRound(harness)

    expect(harness.expectReject({ type: 'USE_JOKER', playerId: 'player-1', jokerType: 'fiftyFifty' }).reason).toBe(
      'joker-not-applicable',
    )
    expect(isUsed(harness, 'player-1')).toBe(false)
    // The audience joker works on such a question - it asks nothing of it.
    harness.dispatch({ type: 'USE_JOKER', playerId: 'player-1', jokerType: 'audience' })
    expect(isUsed(harness, 'player-1')).toBe(true)
  })

  it('needs answers on screen - a question being read out is too early', () => {
    const harness = rig()
    startGame(harness)

    expect(harness.state!.phase).toBe('question-presented')
    expect(harness.publicView().visibleOptions).toBeUndefined()
    expect(harness.expectReject({ type: 'USE_JOKER', playerId: 'player-1', jokerType: 'fiftyFifty' }).reason).toBe(
      'invalid-phase',
    )
    expect(isUsed(harness, 'player-1')).toBe(false)
  })

  it('is refused once an answer is logged, confirmed or resolved', () => {
    const logged = rig()
    startGame(logged)
    buzzIn(logged, 'player-1')
    logged.dispatch({ type: 'LOG_OPTION_ANSWER', optionId: 'b' })
    expect(logged.expectReject({ type: 'USE_JOKER', playerId: 'player-1', jokerType: 'fiftyFifty' }).reason).toBe(
      'answer-not-logged',
    )
    expect(isUsed(logged, 'player-1')).toBe(false)

    const resolved = rig()
    startGame(resolved)
    buzzIn(resolved, 'player-1')
    resolved.dispatch({ type: 'LOG_OPTION_ANSWER', optionId: 'b' })
    resolved.dispatch({ type: 'RESOLVE_ATTEMPT' })
    // The feedback animation is not a moment for a joker at all.
    expect(resolved.state!.phase).toBe('attempt-feedback')
    expect(resolved.expectReject({ type: 'USE_JOKER', playerId: 'player-1', jokerType: 'audience' }).reason).toBe(
      'invalid-phase',
    )

    resolved.settle()
    expect(resolved.state!.phase).toBe('second-chance')
    /*
     * The second chance belongs to the OTHER player - but not for the 50:50: an
     * answer has been scored, and one wrong answer is already publicly used up.
     * Asking the room, on the other hand, is exactly what one does here.
     */
    expect(resolved.expectReject({ type: 'USE_JOKER', playerId: 'player-2', jokerType: 'fiftyFifty' }).reason).toBe(
      'attempt-already-resolved',
    )
    resolved.dispatch({ type: 'USE_JOKER', playerId: 'player-2', jokerType: 'audience' })
    expect(isUsed(resolved, 'player-2')).toBe(true)
  })

  it('is refused after the solution', () => {
    const harness = rig()
    startGame(harness)
    buzzIn(harness, 'player-1')
    harness.dispatch({ type: 'LOG_OPTION_ANSWER', optionId: 'a' })
    harness.dispatch({ type: 'RESOLVE_ATTEMPT' })
    harness.settle()

    expect(harness.state!.phase).toBe('solution')
    for (const jokerType of ['fiftyFifty', 'audience'] as const) {
      expect(harness.expectReject({ type: 'USE_JOKER', playerId: 'player-2', jokerType }).reason).toBe(
        'invalid-phase',
      )
    }
  })

  it('processes two simultaneous activations once', () => {
    const harness = rig()
    startGame(harness)
    releaseRound(harness)

    /*
     * Two operators on the same revision, or one double-click: the first wins,
     * the second is refused, and the hidden answers do not change. The state
     * carries exactly one effect afterwards.
     */
    harness.dispatch({ type: 'USE_JOKER', playerId: 'player-1', jokerType: 'fiftyFifty' })
    const hiddenAfterFirst = [...harness.state!.activeFiftyFifty!.hiddenOptionIds]
    const revisionAfterFirst = harness.state!.revision

    expect(harness.expectReject({ type: 'USE_JOKER', playerId: 'player-1', jokerType: 'fiftyFifty' }).reason).toBe(
      'joker-already-used',
    )
    expect(harness.state!.revision).toBe(revisionAfterFirst)
    expect(harness.state!.activeFiftyFifty!.hiddenOptionIds).toEqual(hiddenAfterFirst)

    // And the second player cannot stack a second effect on the same question.
    expect(harness.expectReject({ type: 'USE_JOKER', playerId: 'player-2', jokerType: 'fiftyFifty' }).reason).toBe(
      'joker-effect-active',
    )
    expect(isUsed(harness, 'player-2')).toBe(false)
  })

  it('draws the surviving wrong answer from the injected source of chance', () => {
    const order = ['a', 'b', 'c', 'd']
    // `a` is correct; the wrong ones are b, c, d in that order.
    expect(pickFiftyFiftyHiddenOptions({ correctOptionId: 'a', optionOrder: order, random: () => 0 })).toEqual([
      'c',
      'd',
    ])
    expect(pickFiftyFiftyHiddenOptions({ correctOptionId: 'a', optionOrder: order, random: () => 0.99 })).toEqual([
      'b',
      'c',
    ])
    // Seven answers: only two are left standing, whatever the count was.
    const many = ['a', 'b', 'c', 'd', 'e', 'f', 'g']
    expect(pickFiftyFiftyHiddenOptions({ correctOptionId: 'a', optionOrder: many, random: () => 0 })).toHaveLength(5)
    // Nothing to remove: the shape allows it, the caller must not spend a joker.
    expect(pickFiftyFiftyHiddenOptions({ correctOptionId: 'a', optionOrder: ['a', 'b'], random: () => 0 })).toEqual(
      [],
    )
  })

  it('hands the same hidden ids to every client', () => {
    const harness = rig()
    startGame(harness)
    releaseRound(harness)
    harness.dispatch({ type: 'USE_JOKER', playerId: 'player-1', jokerType: 'fiftyFifty' })

    const stage = harness.publicView()
    const operator = harness.operatorView()
    const stored = harness.state!.activeFiftyFifty!.hiddenOptionIds

    expect(stage.activeFiftyFifty?.hiddenOptionIds).toEqual(stored)
    expect(operator.activeFiftyFifty?.hiddenOptionIds).toEqual(stored)
    expect(stage.visibleOptions?.filter((option) => option.hidden).map((option) => option.id)).toEqual(stored)
    expect(operator.visibleOptions?.filter((option) => option.hidden).map((option) => option.id)).toEqual(stored)
    expect(stage.activeFiftyFifty?.playerId).toBe('player-1')
    // The answers keep their place - they are dimmed, not removed from the list.
    expect(stage.visibleOptions).toHaveLength(4)
  })
})

describe('the administrative reset', () => {
  it('hands the supply back', () => {
    const harness = rig()
    startGame(harness)
    releaseRound(harness)
    harness.dispatch({ type: 'USE_JOKER', playerId: 'player-1', jokerType: 'audience' })

    harness.dispatch({ type: 'RESTORE_JOKER', playerId: 'player-1' })
    expect(jokerState(harness, 'player-1')).toEqual({ status: 'available' })
    // And it can be spent again afterwards - as either variant.
    harness.dispatch({ type: 'USE_JOKER', playerId: 'player-1', jokerType: 'fiftyFifty' })
    expect(jokerState(harness, 'player-1')).toMatchObject({ status: 'used', type: 'fiftyFifty' })
  })

  it('touches only the chosen player', () => {
    const harness = rig()
    startGame(harness)
    releaseRound(harness)
    harness.dispatch({ type: 'USE_JOKER', playerId: 'player-1', jokerType: 'audience' })
    harness.dispatch({ type: 'RESTORE_JOKER', playerId: 'player-1' })

    // Player 2 never spent theirs, and the reset did not invent a change there.
    expect(jokerState(harness, 'player-2')).toEqual({ status: 'available' })
    expect(harness.expectReject({ type: 'RESTORE_JOKER', playerId: 'player-2' }).reason).toBe('joker-not-used')
  })

  it('brings the removed answers back while the question still stands', () => {
    const harness = rig()
    startGame(harness)
    releaseRound(harness)
    harness.dispatch({ type: 'USE_JOKER', playerId: 'player-1', jokerType: 'fiftyFifty' })
    expect(visibleOptionIds(harness)).toHaveLength(2)

    harness.dispatch({ type: 'RESTORE_JOKER', playerId: 'player-1' })

    expect(harness.state!.activeFiftyFifty).toBeUndefined()
    expect(visibleOptionIds(harness)).toHaveLength(4)
    expect(jokerState(harness, 'player-1')).toEqual({ status: 'available' })
  })

  it('only restores the supply once the question has moved on', () => {
    const harness = rig()
    startGame(harness)
    releaseRound(harness)
    harness.dispatch({ type: 'USE_JOKER', playerId: 'player-1', jokerType: 'fiftyFifty' })
    answerAndContinue(harness)
    releaseRound(harness)

    harness.dispatch({ type: 'RESTORE_JOKER', playerId: 'player-1' })
    expect(jokerState(harness, 'player-1')).toEqual({ status: 'available' })
    // Nothing was hidden on this question, so nothing comes back.
    expect(visibleOptionIds(harness)).toHaveLength(4)
  })

  it('refuses to restore what was never spent', () => {
    const harness = rig()
    startGame(harness)
    releaseRound(harness)

    expect(harness.expectReject({ type: 'RESTORE_JOKER', playerId: 'player-1' }).reason).toBe('joker-not-used')
  })
})

describe('what the operator sees', () => {
  it('names both actions, the state and why something is blocked', () => {
    const harness = rig()
    startGame(harness)
    releaseRound(harness)

    const before = harness.operatorView().jokers!
    expect(before.map((entry) => entry.playerId)).toEqual(['player-1', 'player-2'])
    expect(before[0]?.playerLabel).toBe('Spieler 1')
    expect(before.every((entry) => entry.canUseFiftyFifty && entry.canUseAudience)).toBe(true)
    expect(before.every((entry) => !entry.used && !entry.canRestore)).toBe(true)
    expect(before.every((entry) => entry.fiftyFiftyBlockedReason === undefined)).toBe(true)

    harness.dispatch({ type: 'USE_JOKER', playerId: 'player-1', jokerType: 'fiftyFifty' })
    const after = harness.operatorView().jokers!
    const spent = after.find((entry) => entry.playerId === 'player-1')!
    expect(spent.used).toBe(true)
    expect(spent.usedType).toBe('fiftyFifty')
    expect(spent.usedAtQuestionId).toBe(harness.state!.currentQuestion!.question.id)
    expect(spent.canUseFiftyFifty).toBe(false)
    expect(spent.canUseAudience).toBe(false)
    expect(spent.canRestore).toBe(true)
    expect(spent.audienceBlockedReason).toContain('schon als 50:50-Joker eingesetzt')

    // The other player's 50:50 is blocked too, but for a different reason - and
    // their audience joker is not blocked at all.
    const other = after.find((entry) => entry.playerId === 'player-2')!
    expect(other.used).toBe(false)
    expect(other.canUseFiftyFifty).toBe(false)
    expect(other.fiftyFiftyBlockedReason).toContain('50:50-Joker aktiv')
    expect(other.canUseAudience).toBe(true)
  })

  it('states the reason a 50:50 does not fit this question', () => {
    const harness = rig(script(pictureQuestion))
    startGame(harness)
    releaseRound(harness)

    const entry = harness.operatorView().jokers!.find((row) => row.playerId === 'player-1')!
    expect(entry.canUseFiftyFifty).toBe(false)
    expect(entry.fiftyFiftyBlockedReason).toContain('Auswahlfragen')
    expect(entry.canUseAudience).toBe(true)
  })

  it('offers the commands only while some button is live', () => {
    const harness = rig()
    startGame(harness)
    releaseRound(harness)
    expect(availableCommands(harness.state)).toContain('USE_JOKER')
    expect(availableCommands(harness.state)).not.toContain('RESTORE_JOKER')

    harness.dispatch({ type: 'USE_JOKER', playerId: 'player-1', jokerType: 'audience' })
    expect(availableCommands(harness.state)).toContain('RESTORE_JOKER')
  })
})

/**
 * The delimitation, as a test.
 *
 * A self-service game - the kiosk, the standalone build, the touch device - has
 * no jokers at all: no supply in the state, nothing in any view model, no
 * command in the list. This is the one place where that is checked in the core;
 * the packages' own suites check that nothing is rendered either.
 */
describe('a game without jokers', () => {
  it('mentions them nowhere and refuses the commands', () => {
    const harness = rig()
    startGame(harness, { flowProfile: 'self-service' })

    expect(harness.state!.jokerByPlayer).toBeUndefined()
    expect(harness.publicView().playerScores[0]?.joker).toBeUndefined()
    expect(harness.operatorView().jokers).toBeUndefined()
    expect(availableCommands(harness.state)).not.toContain('USE_JOKER')
    expect(availableCommands(harness.state)).not.toContain('RESTORE_JOKER')

    for (const jokerType of ['fiftyFifty', 'audience'] as const) {
      expect(harness.expectReject({ type: 'USE_JOKER', playerId: 'player-1', jokerType }).reason).toBe(
        'joker-not-applicable',
      )
    }
    expect(harness.expectReject({ type: 'RESTORE_JOKER', playerId: 'player-1' }).reason).toBe(
      'joker-not-applicable',
    )
  })
})
