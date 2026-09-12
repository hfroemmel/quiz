/**
 * The joker draw: its rules, its lifetime and what the engine hands a client.
 *
 * Every test here runs without a server, a browser or real time. The coin and
 * the surviving wrong answer come from an INJECTED source of chance, so "which
 * variant comes out" is a decision of the test and not of luck - that is the
 * only way a draw can be tested at all.
 */
import { describe, expect, it } from 'vitest'
import {
  activeJokerSequence,
  gameTiming,
  jokerOf,
  jokerRevealAtMs,
  jokerRules,
  roleMayIssue,
  type PlayerId,
} from '../src'
import { drawJokerType, pickEliminatedOptions } from '../src/engine/joker'
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
const sevenAnswers = (id: string) =>
  makeQuestion({
    id,
    options: ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((letter) => ({
      id: letter,
      text: `Antwort ${letter.toUpperCase()}`,
    })),
  })
/** A free-answer picture question - no options, so no 50:50, so no draw. */
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

/**
 * Two dice in one function.
 *
 * The engine asks the same source twice per draw: first for the coin, then -
 * for a 50:50 - for the wrong answer that survives. A fixed number would answer
 * both the same way, so the tests hand in a sequence and say what each value is
 * for.
 */
function chance(...values: number[]): () => number {
  let index = 0
  return () => values[Math.min(index++, values.length - 1)]!
}

/** Draws the 50:50 and keeps the FIRST wrong answer standing. */
const drawsFiftyFifty = () => chance(0, 0)
/** Draws the audience joker - the second half of the coin. */
const drawsAudience = () => chance(0.9)

function rig(questions = script(fourAnswers), random: () => number = drawsFiftyFifty()): Harness {
  return createHarness(questions, { random })
}

function jokerState(harness: Harness, playerId: PlayerId) {
  return jokerOf(harness.state!.jokerByPlayer, playerId)
}

function isUsed(harness: Harness, playerId: PlayerId): boolean {
  return jokerState(harness, playerId).status === 'used'
}

function sequence(harness: Harness) {
  return harness.state!.jokerSequence
}

/** The running draw - every test that asks for it expects one to run. */
function running(harness: Harness) {
  const active = activeJokerSequence(harness.state!.jokerSequence)
  if (!active) throw new Error('Es laeuft keine Ziehung.')
  return active
}

/** Lets the reveal run out - the server turns the card, not the client. */
function awaitReveal(harness: Harness): void {
  harness.advance(jokerRevealAtMs)
}

/** The whole draw, up to the effect being applied. */
function drawJoker(harness: Harness): void {
  harness.dispatch({ type: 'DRAW_JOKER' })
  awaitReveal(harness)
  const active = running(harness)
  expect(active.phase).toBe('revealed')
  harness.dispatch({ type: 'CONTINUE_JOKER', sequenceId: active.sequenceId })
}

/** The options the room can actually still pick. */
function remainingOptionIds(harness: Harness): string[] {
  return (harness.publicView().visibleOptions ?? [])
    .filter((option) => !option.eliminated)
    .map((option) => option.id)
}

/**
 * Plays the current question to its solution so the next one can be reached.
 *
 * Without a buzz of its own: every test that uses it has one player on the
 * buzzer already - that is where a draw comes from.
 */
function answerAndContinue(harness: Harness): void {
  harness.dispatch({ type: 'LOG_OPTION_ANSWER', optionId: 'a' })
  harness.dispatch({ type: 'RESOLVE_ATTEMPT' })
  harness.settle()
  harness.dispatch({ type: 'CONTINUE' })
  harness.advance(gameTiming.pauseScreenMs)
}

describe('one joker per player', () => {
  it('gives both players exactly one available joker', () => {
    const harness = rig()
    startGame(harness)

    for (const playerId of ['player-1', 'player-2'] as const) {
      expect(jokerState(harness, playerId)).toEqual({ status: 'available' })
      expect(harness.publicView().playerScores.find((score) => score.playerId === playerId)?.joker).toEqual({
        used: false,
      })
    }
    expect(sequence(harness)).toEqual({ phase: 'idle' })
  })

  it('cannot be drawn before a valid buzz', () => {
    const harness = rig()
    startGame(harness)
    releaseRound(harness)

    /*
     * The answers are up and everything about the question is fine - but the
     * joker belongs to whoever is answering, and so far nobody is.
     */
    const rejection = harness.expectReject({ type: 'DRAW_JOKER' })
    expect(rejection.reason).toBe('joker-no-answering-player')
    expect(isUsed(harness, 'player-1')).toBe(false)
    expect(availableCommands(harness.state)).not.toContain('DRAW_JOKER')
  })

  it('belongs to the player who buzzed, and is spent at once', () => {
    const harness = rig()
    startGame(harness)
    buzzIn(harness, 'player-2')

    harness.dispatch({ type: 'DRAW_JOKER' })

    /*
     * THE STATUS FLIPS WITH THE FIRST MOMENT OF THE DRAW, not when it is
     * applied: a draw cannot be taken back, so a joker in the air is spent.
     */
    const active = running(harness)
    expect(active.phase).toBe('drawing')
    expect(active.playerId).toBe('player-2')
    expect(jokerState(harness, 'player-2')).toMatchObject({
      status: 'used',
      usedAtQuestionId: harness.state!.currentQuestion!.question.id,
    })
    // The other player never enters into it.
    expect(jokerState(harness, 'player-1')).toEqual({ status: 'available' })
  })

  it('cannot be drawn twice by the same player', () => {
    const harness = rig()
    startGame(harness)
    buzzIn(harness, 'player-1')
    drawJoker(harness)

    answerAndContinue(harness)
    buzzIn(harness, 'player-1')

    const rejection = harness.expectReject({ type: 'DRAW_JOKER' })
    expect(rejection.reason).toBe('joker-already-used')
    expect(rejection.message).toContain('Spieler 1')
  })

  it('lets the two players draw independently', () => {
    const harness = rig()
    startGame(harness)
    buzzIn(harness, 'player-1')
    drawJoker(harness)

    answerAndContinue(harness)
    buzzIn(harness, 'player-2')
    drawJoker(harness)

    expect(isUsed(harness, 'player-1')).toBe(true)
    expect(isUsed(harness, 'player-2')).toBe(true)
  })

  it('spends the joker once even when two draws arrive together', () => {
    const harness = rig()
    startGame(harness)
    buzzIn(harness, 'player-1')

    harness.dispatch({ type: 'DRAW_JOKER' })
    const first = sequence(harness)!
    const revisionAfterFirst = harness.state!.revision

    /*
     * A double click, or two operator windows on the same revision: the second
     * command finds a draw already running and is refused. Nothing about the
     * first one changes - same sequence, same revision.
     */
    expect(harness.expectReject({ type: 'DRAW_JOKER' }).reason).toBe('joker-sequence-active')
    expect(sequence(harness)).toEqual(first)
    expect(harness.state!.revision).toBe(revisionAfterFirst)
  })

  it('is refused for every role but the operator', () => {
    for (const type of ['DRAW_JOKER', 'CONTINUE_JOKER'] as const) {
      expect(roleMayIssue('operator', type)).toBe(true)
      expect(roleMayIssue('player', type)).toBe(false)
      expect(roleMayIssue('moderator', type)).toBe(false)
      expect(roleMayIssue('system', type)).toBe(false)
    }
  })
})

describe('the coin is the server', () => {
  it('produces both outcomes from the injected source of chance', () => {
    // The boundary is exactly 0.5 - below it the 50:50, above it the audience.
    expect(drawJokerType(() => 0)).toBe('fiftyFifty')
    expect(drawJokerType(() => 0.49)).toBe('fiftyFifty')
    expect(drawJokerType(() => 0.5)).toBe('audience')
    expect(drawJokerType(() => 0.99)).toBe('audience')
  })

  it('draws a 50:50 with its eliminated answers in one go', () => {
    const harness = rig(script(fourAnswers), drawsFiftyFifty())
    startGame(harness)
    buzzIn(harness, 'player-1')
    harness.dispatch({ type: 'DRAW_JOKER' })

    const active = running(harness)
    expect(active.type).toBe('fiftyFifty')
    // Decided at the draw, long before anybody may see them.
    expect(active.eliminatedOptionIds).toHaveLength(2)
  })

  it('draws an audience joker without touching the answers', () => {
    const harness = rig(script(fourAnswers), drawsAudience())
    startGame(harness)
    buzzIn(harness, 'player-1')
    drawJoker(harness)

    expect(running(harness).type).toBe('audience')
    expect(running(harness).eliminatedOptionIds).toBeUndefined()
    expect(remainingOptionIds(harness)).toHaveLength(4)
  })

  it('hides the variant until the card has turned', () => {
    const harness = rig(script(fourAnswers), drawsFiftyFifty())
    startGame(harness)
    buzzIn(harness, 'player-1')
    harness.dispatch({ type: 'DRAW_JOKER' })

    /*
     * DURING THE FLIGHT THE RESULT IS NOT ON THE WIRE. The stage learns that a
     * draw is running, whose it is and when it started - not what it will be.
     * A client that knew could give it away before the reveal.
     */
    const flying = harness.publicView().jokerDraw!
    expect(flying.phase).toBe('drawing')
    expect(flying.type).toBeUndefined()
    expect(flying.playerId).toBe('player-1')
    expect(flying.revealAtMs).toBe(jokerRevealAtMs)
    expect(harness.publicView().visibleOptions?.some((option) => option.eliminated)).toBe(false)

    awaitReveal(harness)

    const revealed = harness.publicView().jokerDraw!
    expect(revealed.phase).toBe('revealed')
    expect(revealed.type).toBe('fiftyFifty')
    // Still not applied: the answers stand until the operator continues.
    expect(harness.publicView().visibleOptions?.some((option) => option.eliminated)).toBe(false)
  })

  it('turns the card on its own, without a client saying so', () => {
    const harness = rig()
    startGame(harness)
    buzzIn(harness, 'player-1')
    harness.dispatch({ type: 'DRAW_JOKER' })

    expect(running(harness).phase).toBe('drawing')
    // One millisecond short of the reveal it is still turning.
    harness.advance(jokerRevealAtMs - 1)
    expect(running(harness).phase).toBe('drawing')
    harness.advance(1)
    expect(running(harness).phase).toBe('revealed')
  })

  it('holds the question while the card is in the air', () => {
    const harness = rig()
    startGame(harness)
    buzzIn(harness, 'player-1')
    harness.dispatch({ type: 'DRAW_JOKER' })

    /*
     * Logging or resolving underneath a card that covers the screen would
     * decide the question behind it. The engine refuses, and the operator's
     * preview does not even offer it.
     */
    expect(harness.expectReject({ type: 'LOG_OPTION_ANSWER', optionId: 'a' }).reason).toBe(
      'joker-sequence-active',
    )
    expect(harness.expectReject({ type: 'RESOLVE_ATTEMPT' }).reason).toBe('joker-sequence-active')
    const offered = availableCommands(harness.state)
    expect(offered).not.toContain('LOG_OPTION_ANSWER')
    expect(offered).not.toContain('RESOLVE_ATTEMPT')
    // Nor a second draw - one screen, one card.
    expect(offered).not.toContain('DRAW_JOKER')

    // Once the card is applied, the question goes on as before.
    awaitReveal(harness)
    harness.dispatch({ type: 'CONTINUE_JOKER', sequenceId: running(harness).sequenceId })
    expect(availableCommands(harness.state)).toContain('LOG_OPTION_ANSWER')
  })
})

describe('continuing', () => {
  it('applies the effect and does not load a new question', () => {
    const harness = rig()
    startGame(harness)
    const questionId = harness.state!.currentQuestion!.question.id
    buzzIn(harness, 'player-1')
    harness.dispatch({ type: 'DRAW_JOKER' })
    awaitReveal(harness)
    const slotBefore = harness.state!.currentSlotIndex

    harness.dispatch({ type: 'CONTINUE_JOKER', sequenceId: running(harness).sequenceId })

    expect(sequence(harness)!.phase).toBe('applied')
    // The SAME question, the same slot - `CONTINUE_JOKER` is not "next".
    expect(harness.state!.currentQuestion!.question.id).toBe(questionId)
    expect(harness.state!.currentSlotIndex).toBe(slotBefore)
    expect(harness.publicView().visibleOptions?.filter((option) => option.eliminated)).toHaveLength(2)
  })

  it('refuses a stale or unknown sequence id', () => {
    const harness = rig()
    startGame(harness)
    buzzIn(harness, 'player-1')
    harness.dispatch({ type: 'DRAW_JOKER' })
    awaitReveal(harness)

    /*
     * A click from a view that had repainted late carries the id of another
     * draw. It must not advance the one that is running now.
     */
    expect(harness.expectReject({ type: 'CONTINUE_JOKER', sequenceId: 'joker-von-gestern' }).reason).toBe(
      'joker-sequence-stale',
    )
    expect(running(harness).phase).toBe('revealed')

    const id = running(harness).sequenceId
    harness.dispatch({ type: 'CONTINUE_JOKER', sequenceId: id })
    // And a repeat of the very same click changes nothing either.
    expect(harness.expectReject({ type: 'CONTINUE_JOKER', sequenceId: id }).reason).toBe('joker-sequence-stale')
  })

  it('cannot skip the turn of the card', () => {
    const harness = rig()
    startGame(harness)
    buzzIn(harness, 'player-1')
    harness.dispatch({ type: 'DRAW_JOKER' })

    const rejection = harness.expectReject({
      type: 'CONTINUE_JOKER',
      sequenceId: running(harness).sequenceId,
    })
    expect(rejection.reason).toBe('joker-sequence-stale')
    expect(rejection.message).toContain('aufgedeckt')
  })

  it('refuses to continue when nothing is running', () => {
    const harness = rig()
    startGame(harness)
    buzzIn(harness, 'player-1')

    expect(harness.expectReject({ type: 'CONTINUE_JOKER', sequenceId: 'egal' }).reason).toBe(
      'joker-no-sequence',
    )
  })
})

describe('the 50:50', () => {
  it('never eliminates the correct answer', () => {
    const harness = rig(script(fourAnswers), drawsFiftyFifty())
    startGame(harness)
    buzzIn(harness, 'player-1')
    drawJoker(harness)

    const remaining = remainingOptionIds(harness)
    expect(remaining).toHaveLength(2)
    expect(remaining).toContain('a')
    expect(running(harness).eliminatedOptionIds).not.toContain('a')
  })

  it('eliminates two of four, one of three, and leaves two of seven', () => {
    const four = rig(script(fourAnswers), drawsFiftyFifty())
    startGame(four)
    buzzIn(four, 'player-1')
    drawJoker(four)
    expect(running(four).eliminatedOptionIds).toHaveLength(2)
    expect(remainingOptionIds(four)).toHaveLength(2)

    const three = rig(script(threeAnswers), drawsFiftyFifty())
    startGame(three)
    buzzIn(three, 'player-1')
    drawJoker(three)
    expect(running(three).eliminatedOptionIds).toHaveLength(1)
    expect(remainingOptionIds(three)).toHaveLength(2)

    const seven = rig(script(sevenAnswers), drawsFiftyFifty())
    startGame(seven)
    buzzIn(seven, 'player-1')
    drawJoker(seven)
    expect(running(seven).eliminatedOptionIds).toHaveLength(5)
    expect(remainingOptionIds(seven)).toHaveLength(2)
  })

  it('draws the surviving wrong answer from the injected source of chance', () => {
    const order = ['a', 'b', 'c', 'd']
    // `a` is correct; the wrong ones are b, c, d in that order.
    expect(pickEliminatedOptions({ correctOptionId: 'a', drawableOptionIds: order, random: () => 0 })).toEqual([
      'c',
      'd',
    ])
    expect(
      pickEliminatedOptions({ correctOptionId: 'a', drawableOptionIds: order, random: () => 0.99 }),
    ).toEqual(['b', 'c'])
    // Nothing to remove: the shape allows it, and then nothing is removed.
    expect(
      pickEliminatedOptions({ correctOptionId: 'a', drawableOptionIds: ['a', 'b'], random: () => 0 }),
    ).toEqual([])
  })

  it('keeps the eliminated answers in place and out of play', () => {
    const harness = rig()
    startGame(harness)
    buzzIn(harness, 'player-1')
    drawJoker(harness)

    const options = harness.publicView().visibleOptions!
    // Four rows before, four rows after - the list does not shrink.
    expect(options).toHaveLength(4)
    const eliminated = options.filter((option) => option.eliminated)
    expect(eliminated).toHaveLength(2)
    // And no answer was chosen on the player's behalf.
    expect(options.some((option) => option.state === 'chosen')).toBe(false)
  })

  it('refuses the draw on a question that cannot carry a 50:50', () => {
    for (const [name, questions] of [
      ['two answers', script(twoAnswers)],
      ['no choice at all', script(pictureQuestion)],
    ] as const) {
      const harness = rig(questions, drawsAudience())
      startGame(harness)
      buzzIn(harness, 'player-1')

      /*
       * THE UNSUITABILITY IS FOUND BEFORE THE COIN, not after. Even a draw
       * whose chance would have come out `audience` is refused - anything else
       * would make the question's suitability part of the lottery.
       */
      const rejection = harness.expectReject({ type: 'DRAW_JOKER' })
      expect(rejection.reason, name).toBe('joker-not-applicable')
      expect(isUsed(harness, 'player-1'), name).toBe(false)
      expect(sequence(harness)).toEqual({ phase: 'idle' })
      expect(availableCommands(harness.state), name).not.toContain('DRAW_JOKER')
    }
  })

  it('states the number of answers it needs', () => {
    const harness = rig(script(twoAnswers))
    startGame(harness)
    buzzIn(harness, 'player-1')

    expect(harness.expectReject({ type: 'DRAW_JOKER' }).message).toContain(
      String(jokerRules.fiftyFiftyMinOptionCount),
    )
  })

  it('counts only the answers still open in the second chance', () => {
    /*
     * Three answers, one of them already logged as wrong: two are left, and
     * removing one of those would leave the correct answer alone on screen.
     * The draw is therefore refused - a 50:50 must not become the solution.
     */
    const harness = rig(script(threeAnswers))
    startGame(harness)
    buzzIn(harness, 'player-1')
    harness.dispatch({ type: 'LOG_OPTION_ANSWER', optionId: 'b' })
    harness.dispatch({ type: 'RESOLVE_ATTEMPT' })
    harness.settle()

    expect(harness.state!.phase).toBe('second-chance')
    expect(harness.expectReject({ type: 'DRAW_JOKER' }).reason).toBe('joker-not-applicable')
    expect(isUsed(harness, 'player-2')).toBe(false)
  })

  it('is refused once an answer is logged', () => {
    const harness = rig()
    startGame(harness)
    buzzIn(harness, 'player-1')
    harness.dispatch({ type: 'LOG_OPTION_ANSWER', optionId: 'b' })

    expect(harness.expectReject({ type: 'DRAW_JOKER' }).reason).toBe('answer-not-logged')
    expect(isUsed(harness, 'player-1')).toBe(false)
  })
})

describe('the audience joker', () => {
  it('marks the answering player without changing who answers', () => {
    const harness = rig(script(fourAnswers), drawsAudience())
    startGame(harness)
    buzzIn(harness, 'player-1')
    drawJoker(harness)

    const view = harness.publicView()
    expect(view.jokerDraw).toMatchObject({ phase: 'applied', type: 'audience', playerId: 'player-1' })
    /*
     * THE ANSWER STAYS WITH THE PLAYER WHO BUZZED. The mark is a mark; the
     * attempt, the lock and later the points belong to player 1 as before.
     */
    expect(view.currentPlayer).toBe('player-1')
    expect(harness.state!.buzzer.acceptedPlayerId).toBe('player-1')
    // Every answer is still on screen and still choosable.
    expect(remainingOptionIds(harness)).toHaveLength(4)
    // And the scoreboards keep their numbers and their scores.
    expect(view.playerScores.map((score) => score.score)).toEqual([0, 0])
  })

  it('books the points to the player who buzzed', () => {
    const harness = rig(script(fourAnswers), drawsAudience())
    startGame(harness)
    buzzIn(harness, 'player-2')
    drawJoker(harness)

    harness.dispatch({ type: 'LOG_OPTION_ANSWER', optionId: 'a' })
    harness.dispatch({ type: 'RESOLVE_ATTEMPT' })

    const player = harness.state!.players.find((entry) => entry.id === 'player-2')!
    expect(player.score).toBeGreaterThan(0)
    expect(harness.state!.players.find((entry) => entry.id === 'player-1')!.score).toBe(0)
  })

  it('drops the mark when the attempt is resolved', () => {
    const harness = rig(script(fourAnswers), drawsAudience())
    startGame(harness)
    buzzIn(harness, 'player-1')
    drawJoker(harness)
    expect(harness.publicView().jokerDraw?.phase).toBe('applied')

    harness.dispatch({ type: 'LOG_OPTION_ANSWER', optionId: 'a' })
    harness.dispatch({ type: 'RESOLVE_ATTEMPT' })
    harness.settle()

    /*
     * The question is decided - the room is no longer being asked, so the mark
     * goes. The spent joker does not come back.
     */
    expect(harness.publicView().jokerDraw).toBeUndefined()
    expect(isUsed(harness, 'player-1')).toBe(true)
  })
})

describe('lifetime', () => {
  it('clears the draw with the question but keeps the joker spent', () => {
    const harness = rig()
    startGame(harness)
    buzzIn(harness, 'player-1')
    drawJoker(harness)
    expect(remainingOptionIds(harness)).toHaveLength(2)

    answerAndContinue(harness)

    expect(sequence(harness)).toEqual({ phase: 'idle' })
    releaseRound(harness)
    // Every answer of the new question is on screen again.
    expect(remainingOptionIds(harness)).toHaveLength(4)
    expect(harness.publicView().jokerDraw).toBeUndefined()
    // ... while the joker stays gone.
    expect(isUsed(harness, 'player-1')).toBe(true)
  })

  it('hands both jokers back on a new game', () => {
    const harness = rig()
    startGame(harness)
    buzzIn(harness, 'player-1')
    drawJoker(harness)
    harness.dispatch({ type: 'ABORT_GAME' })

    startGame(harness)
    for (const playerId of ['player-1', 'player-2'] as const) {
      expect(jokerState(harness, playerId)).toEqual({ status: 'available' })
    }
    expect(sequence(harness)).toEqual({ phase: 'idle' })
  })
})

describe('what the operator sees', () => {
  it('offers one button and names the player it belongs to', () => {
    const harness = rig()
    startGame(harness)
    buzzIn(harness, 'player-2')

    const joker = harness.operatorView().joker!
    expect(joker.canDraw).toBe(true)
    expect(joker.used).toBe(false)
    expect(joker.playerId).toBe('player-2')
    expect(joker.playerLabel).toBe('Spieler 2')
    expect(joker.blockedReason).toBeUndefined()
    expect(joker.sequence).toBeUndefined()
  })

  it('reports the running draw phase by phase', () => {
    const harness = rig()
    startGame(harness)
    buzzIn(harness, 'player-1')
    harness.dispatch({ type: 'DRAW_JOKER' })

    const drawing = harness.operatorView().joker!
    expect(drawing.canDraw).toBe(false)
    expect(drawing.used).toBe(true)
    expect(drawing.sequence).toMatchObject({ phase: 'drawing' })
    // Not even the desk learns the variant early - it reads it off the card.
    expect(drawing.sequence?.type).toBeUndefined()

    awaitReveal(harness)
    const revealed = harness.operatorView().joker!
    expect(revealed.sequence).toMatchObject({ phase: 'revealed', type: 'fiftyFifty' })
    expect(harness.operatorView().allowedCommands).toContain('CONTINUE_JOKER')

    harness.dispatch({ type: 'CONTINUE_JOKER', sequenceId: revealed.sequence!.sequenceId })
    expect(harness.operatorView().joker!.sequence).toMatchObject({ phase: 'applied' })
    expect(harness.operatorView().allowedCommands).not.toContain('CONTINUE_JOKER')
  })

  it('explains a question that is unsuitable before anything is drawn', () => {
    const harness = rig(script(twoAnswers))
    startGame(harness)
    buzzIn(harness, 'player-1')

    const joker = harness.operatorView().joker!
    expect(joker.canDraw).toBe(false)
    expect(joker.used).toBe(false)
    expect(joker.blockedReason).toContain('nicht geeignet')
  })

  it('says so once the joker is spent', () => {
    const harness = rig()
    startGame(harness)
    buzzIn(harness, 'player-1')
    drawJoker(harness)
    answerAndContinue(harness)
    buzzIn(harness, 'player-1')

    const joker = harness.operatorView().joker!
    expect(joker.used).toBe(true)
    expect(joker.canDraw).toBe(false)
    expect(joker.blockedReason).toContain('schon eingesetzt')
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
    expect(harness.state!.jokerSequence).toBeUndefined()
    expect(harness.publicView().playerScores[0]?.joker).toBeUndefined()
    expect(harness.publicView().jokerDraw).toBeUndefined()
    expect(harness.operatorView().joker).toBeUndefined()
    expect(availableCommands(harness.state)).not.toContain('DRAW_JOKER')

    expect(harness.expectReject({ type: 'DRAW_JOKER' }).reason).toBe('joker-not-applicable')
  })
})
