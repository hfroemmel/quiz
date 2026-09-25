/**
 * Mandatory cases of the domain unit tests (specification 31.1).
 *
 * All tests run without Electron, React or real system time.
 */
import { describe, expect, it } from 'vitest'
import { gameTiming, roleMayIssue, scoringRules, selfServiceTiming } from '../src'
import { buzzIn, createHarness, makeQuestion, releaseRound, startGame, type Harness } from './helpers'
import { determineResult, pendingAttempt } from '../src/engine/scoring'
import { availableCommands } from '../src/engine/allowedCommands'

const normalQuestion = (id: string) => makeQuestion({ id })
const revealQuestion = (id: string) =>
  makeQuestion({
    id,
    questionType: 'image-reveal',
    evaluationMode: 'manual-correct-incorrect',
    options: undefined,
    correctOptionId: undefined,
    acceptedAnswerText: ['Brandenburger Tor'],
    image: { filename: 'questions/img-1.jpg' },
  })
const sevenNormal = () => Array.from({ length: 7 }, (_, index) => normalQuestion(`q${index + 1}`))

describe('Game start and flow', () => {
  it('starts with the pause screen and then fades in the first question', () => {
    const harness = createHarness(sevenNormal())
    harness.dispatch({ type: 'START_GAME', audience: 'adults', presetId: 'medium' })

    expect(harness.state!.phase).toBe('pause-screen')
    expect(harness.state!.totalQuestions).toBe(7)
    expect(harness.state!.currentQuestion?.question.id).toBe('q1')

    harness.advance(gameTiming.pauseScreenMs)
    expect(harness.state!.phase).toBe('question-presented')
  })

  it('reports the progress as question x/y', () => {
    const harness = createHarness(sevenNormal())
    startGame(harness)
    expect(harness.state!.currentSlotIndex).toBe(0)
    expect(harness.state!.totalQuestions).toBe(7)
  })
})

describe('Buzzer rules', () => {
  it('the first buzz wins, the second is rejected', () => {
    const harness = createHarness(sevenNormal())
    startGame(harness)
    harness.dispatch({ type: 'OPEN_BUZZER' })

    harness.dispatch({ type: 'BUZZ', playerId: 'player-2' })
    expect(harness.state!.buzzer.acceptedPlayerId).toBe('player-2')
    expect(harness.state!.phase).toBe('answer-locked')

    const rejection = harness.expectReject({ type: 'BUZZ', playerId: 'player-1' })
    expect(rejection.reason).toBe('buzzer-already-taken')
    expect(harness.state!.buzzer.acceptedPlayerId).toBe('player-2')
  })

  it('key repeat does not produce a second buzz', () => {
    const harness = createHarness(sevenNormal())
    startGame(harness)
    harness.dispatch({ type: 'OPEN_BUZZER' })
    harness.dispatch({ type: 'BUZZ', playerId: 'player-1' })
    const revisionAfterFirst = harness.state!.revision

    // Auto-repeat sends the same buzz again - the state must not change.
    harness.expectReject({ type: 'BUZZ', playerId: 'player-1' })
    harness.expectReject({ type: 'BUZZ', playerId: 'player-1' })
    expect(harness.state!.revision).toBe(revisionAfterFirst)
    expect(harness.state!.attempts).toHaveLength(1)
  })

  it('manual player selection passes the same validation as the buzzer', () => {
    const harness = createHarness(sevenNormal())
    startGame(harness)
    // Without the buzzer being opened, the manual selection is not possible either.
    expect(harness.expectReject({ type: 'SELECT_PLAYER_MANUALLY', playerId: 'player-1' }).reason).toBe('invalid-phase')

    harness.dispatch({ type: 'OPEN_BUZZER' })
    harness.dispatch({ type: 'SELECT_PLAYER_MANUALLY', playerId: 'player-1' })
    expect(harness.state!.buzzer.acceptedVia).toBe('manual')
    expect(harness.state!.phase).toBe('answer-locked')
  })
})

describe('Normal multiple-choice question', () => {
  it('first correct answer gives exactly 100 points and then shows the solution', () => {
    const harness = createHarness(sevenNormal())
    startGame(harness)
    buzzIn(harness, 'player-1')

    harness.dispatch({ type: 'LOG_OPTION_ANSWER', optionId: 'a' })
    harness.dispatch({ type: 'RESOLVE_ATTEMPT' })
    expect(harness.state!.phase).toBe('attempt-feedback')
    expect(harness.state!.players[0]!.score).toBe(scoringRules.firstAnswerPoints)

    harness.settle()
    expect(harness.state!.phase).toBe('solution')
    expect(harness.scoreTransactions).toEqual([
      expect.objectContaining({ playerId: 'player-1', delta: 100, reason: 'richtige Antwort' }),
    ])
  })

  it('keeps the solution hidden after a wrong first answer and gives the second chance', () => {
    const harness = createHarness(sevenNormal())
    startGame(harness)
    buzzIn(harness, 'player-1')

    harness.dispatch({ type: 'LOG_OPTION_ANSWER', optionId: 'b' })
    harness.dispatch({ type: 'RESOLVE_ATTEMPT' })
    expect(harness.state!.phase).toBe('attempt-feedback')

    harness.settle()
    // The solution deliberately does not appear yet.
    expect(harness.state!.phase).toBe('second-chance')
    expect(harness.state!.players[0]!.lockedForCurrentQuestion).toBe(true)
    expect(harness.state!.players[1]!.lockedForCurrentQuestion).toBe(false)
    expect(harness.state!.players[0]!.score).toBe(0)
  })

  it('only the second player is eligible in the second chance', () => {
    const harness = createHarness(sevenNormal())
    startGame(harness)
    buzzIn(harness, 'player-1')
    harness.dispatch({ type: 'MARK_MANUAL_ANSWER', verdict: 'incorrect' })
    harness.dispatch({ type: 'RESOLVE_ATTEMPT' })
    harness.settle()

    const attempt = harness.state!.attempts.at(-1)!
    expect(attempt.playerId).toBe('player-2')
    expect(attempt.outcome).toBeUndefined()
    // Buzzing again is neither required nor possible for the second chance.
    expect(harness.expectReject({ type: 'BUZZ', playerId: 'player-2' }).reason).toBe('invalid-phase')
  })

  it('locks an option already judged wrong for the second chance', () => {
    const harness = createHarness(sevenNormal())
    startGame(harness)
    buzzIn(harness, 'player-1')
    harness.dispatch({ type: 'LOG_OPTION_ANSWER', optionId: 'c' })
    harness.dispatch({ type: 'RESOLVE_ATTEMPT' })
    harness.settle()

    // The same option again could only lead to a second "wrong".
    expect(harness.expectReject({ type: 'LOG_OPTION_ANSWER', optionId: 'c' }).reason).toBe('option-already-answered')
    // Every other option of course stays selectable.
    harness.dispatch({ type: 'LOG_OPTION_ANSWER', optionId: 'b' })
    expect(harness.state!.attempts.at(-1)!.loggedOptionId).toBe('b')
  })

  it('reports the used option in the public view model too', () => {
    const harness = createHarness(sevenNormal())
    startGame(harness)
    buzzIn(harness, 'player-1')
    harness.dispatch({ type: 'LOG_OPTION_ANSWER', optionId: 'c' })
    harness.dispatch({ type: 'RESOLVE_ATTEMPT' })
    harness.settle()

    const options = harness.publicView().visibleOptions ?? []
    expect(options.find((option) => option.id === 'c')?.state).toBe('chosen-incorrect')
    // The correct answer stays hidden until the solution scene.
    expect(options.some((option) => option.state === 'correct')).toBe(false)
  })

  it('logs the answer out again when the same option is pressed twice', () => {
    const harness = createHarness(sevenNormal())
    startGame(harness)
    buzzIn(harness, 'player-1')

    harness.dispatch({ type: 'LOG_OPTION_ANSWER', optionId: 'c' })
    expect(pendingAttempt(harness.state!)!.loggedOptionId).toBe('c')
    expect(harness.operatorView().answering?.loggedOptionId).toBe('c')

    /*
     * THE SAME KEY TAKES IT BACK OUT. Logging in is a note, not a decision -
     * a mis-hit at the desk had no way back before, and the operator had to
     * resolve something they never meant to log.
     */
    harness.dispatch({ type: 'LOG_OPTION_ANSWER', optionId: 'c' })
    expect(pendingAttempt(harness.state!)!.loggedOptionId).toBeUndefined()
    expect(harness.operatorView().answering?.loggedOptionId).toBeUndefined()
    // Nothing is marked on the stage either.
    expect((harness.publicView().visibleOptions ?? []).some((option) => option.state === 'chosen')).toBe(false)
    // And there is nothing to evaluate - the same sentence as before any answer.
    expect(harness.expectReject({ type: 'RESOLVE_ATTEMPT' }).reason).toBe('answer-not-logged')

    // It is a switch and not a lock: the same option goes back in.
    harness.dispatch({ type: 'LOG_OPTION_ANSWER', optionId: 'c' })
    expect(pendingAttempt(harness.state!)!.loggedOptionId).toBe('c')
  })

  it('moves the note to another option instead of clearing it', () => {
    const harness = createHarness(sevenNormal())
    startGame(harness)
    buzzIn(harness, 'player-1')

    harness.dispatch({ type: 'LOG_OPTION_ANSWER', optionId: 'c' })
    harness.dispatch({ type: 'LOG_OPTION_ANSWER', optionId: 'b' })
    expect(pendingAttempt(harness.state!)!.loggedOptionId).toBe('b')
  })

  it('takes a manual verdict back the same way', () => {
    /*
     * The two verdict buttons are the same note in another form - a question
     * whose answer is spoken. What the letter keys can do, they can do too.
     */
    const harness = createHarness([revealQuestion('q1'), ...sevenNormal().slice(1)])
    startGame(harness)
    releaseRound(harness)
    buzzIn(harness, 'player-1')

    harness.dispatch({ type: 'MARK_MANUAL_ANSWER', verdict: 'correct' })
    expect(pendingAttempt(harness.state!)!.loggedManualVerdict).toBe('correct')

    harness.dispatch({ type: 'MARK_MANUAL_ANSWER', verdict: 'correct' })
    expect(pendingAttempt(harness.state!)!.loggedManualVerdict).toBeUndefined()
    expect(harness.expectReject({ type: 'RESOLVE_ATTEMPT' }).reason).toBe('answer-not-logged')

    // The other verdict replaces it, as an answer key replaces an answer key.
    harness.dispatch({ type: 'MARK_MANUAL_ANSWER', verdict: 'correct' })
    harness.dispatch({ type: 'MARK_MANUAL_ANSWER', verdict: 'incorrect' })
    expect(pendingAttempt(harness.state!)!.loggedManualVerdict).toBe('incorrect')
  })

  it('correct second chance gives exactly 50 points', () => {
    const harness = createHarness(sevenNormal())
    startGame(harness)
    buzzIn(harness, 'player-1')
    harness.dispatch({ type: 'LOG_OPTION_ANSWER', optionId: 'c' })
    harness.dispatch({ type: 'RESOLVE_ATTEMPT' })
    harness.settle()

    harness.dispatch({ type: 'LOG_OPTION_ANSWER', optionId: 'a' })
    harness.dispatch({ type: 'RESOLVE_ATTEMPT' })
    harness.settle()

    expect(harness.state!.players[1]!.score).toBe(scoringRules.secondChancePoints)
    expect(harness.state!.phase).toBe('solution')
  })

  it('wrong answers give no minus points', () => {
    const harness = createHarness(sevenNormal())
    startGame(harness)
    buzzIn(harness, 'player-1')
    harness.dispatch({ type: 'LOG_OPTION_ANSWER', optionId: 'b' })
    harness.dispatch({ type: 'RESOLVE_ATTEMPT' })
    harness.settle()

    harness.dispatch({ type: 'LOG_OPTION_ANSWER', optionId: 'd' })
    harness.dispatch({ type: 'RESOLVE_ATTEMPT' })
    harness.settle()

    expect(harness.state!.players[0]!.score).toBe(0)
    expect(harness.state!.players[1]!.score).toBe(0)
    expect(harness.state!.phase).toBe('solution')
  })

  it('passing gives no points and leads straight to the solution', () => {
    const harness = createHarness(sevenNormal())
    startGame(harness)
    buzzIn(harness, 'player-1')
    harness.dispatch({ type: 'MARK_MANUAL_ANSWER', verdict: 'incorrect' })
    harness.dispatch({ type: 'RESOLVE_ATTEMPT' })
    harness.settle()

    harness.dispatch({ type: 'PASS_SECOND_CHANCE' })
    expect(harness.state!.phase).toBe('solution')
    expect(harness.state!.players[1]!.score).toBe(0)
  })

  it('allows resolving at any time without buzz and without answer', () => {
    const harness = createHarness(sevenNormal())
    startGame(harness)
    // There is no mandatory wait before resolving.
    harness.dispatch({ type: 'RESOLVE_WITHOUT_ANSWER' })
    expect(harness.state!.phase).toBe('solution')
    expect(harness.state!.players[0]!.score).toBe(0)
    expect(harness.state!.players[1]!.score).toBe(0)
    expect(harness.state!.attempts.at(-1)!.outcome).toBe('no-answer')
  })

  it('requires a logged answer before resolving', () => {
    const harness = createHarness(sevenNormal())
    startGame(harness)
    buzzIn(harness, 'player-1')
    expect(harness.expectReject({ type: 'RESOLVE_ATTEMPT' }).reason).toBe('answer-not-logged')
  })

  it('resets the buzzer without lifting the lock of a failed attempt', () => {
    const harness = createHarness(sevenNormal())
    startGame(harness)
    buzzIn(harness, 'player-1')
    harness.dispatch({ type: 'RESET_BUZZER' })

    expect(harness.state!.phase).toBe('buzzer-open')
    expect(harness.state!.buzzer.acceptedPlayerId).toBeUndefined()
    expect(harness.state!.attempts).toHaveLength(0)

    harness.dispatch({ type: 'BUZZ', playerId: 'player-2' })
    expect(harness.state!.buzzer.acceptedPlayerId).toBe('player-2')
  })
})

describe('Image recognition with reveal', () => {
  it('waits for the release before the reveal runs and the buzzer opens', () => {
    const harness = createHarness([revealQuestion('r1'), ...sevenNormal().slice(1)])
    startGame(harness)

    // The picture stands blurred so that the moderator can read the question aloud.
    expect(harness.state!.phase).toBe('reveal-ready')
    expect(harness.state!.reveal?.status).toBe('idle')
    expect(harness.state!.reveal?.durationMs).toBe(gameTiming.imageRevealDurationMs)
    expect(harness.state!.buzzer.open).toBe(false)

    // Before the buzzer is opened, buzzing has no effect.
    expect(harness.expectReject({ type: 'BUZZ', playerId: 'player-1' }).reason).toBe('invalid-phase')

    harness.dispatch({ type: 'START_IMAGE_REVEAL' })
    expect(harness.state!.phase).toBe('reveal-running')
    expect(harness.state!.reveal?.status).toBe('running')
    expect(harness.state!.buzzer.open).toBe(true)
  })

  it('counts only from the release - the read-aloud time costs no second', () => {
    const harness = createHarness([revealQuestion('r1'), ...sevenNormal().slice(1)])
    startGame(harness)

    harness.advance(6_000)
    harness.dispatch({ type: 'START_IMAGE_REVEAL' })
    harness.advance(2_000)

    expect(harness.state!.reveal!.elapsedBeforeStartMs).toBe(0)
    harness.dispatch({ type: 'PAUSE_IMAGE_REVEAL' })
    expect(harness.state!.reveal!.elapsedBeforeStartMs).toBe(2_000)
  })

  it('pauses on a valid buzz and resumes at the same position', () => {
    const harness = createHarness([revealQuestion('r1'), ...sevenNormal().slice(1)])
    startGame(harness)
    releaseRound(harness)

    harness.advance(4_000)
    harness.dispatch({ type: 'BUZZ', playerId: 'player-1' })
    const frozen = harness.state!.reveal!
    expect(frozen.status).toBe('paused')
    expect(frozen.elapsedBeforeStartMs).toBe(4_000)

    // While the answer is being processed, the state does not change.
    harness.advance(3_000)
    expect(harness.state!.reveal!.elapsedBeforeStartMs).toBe(4_000)

    harness.dispatch({ type: 'MARK_MANUAL_ANSWER', verdict: 'incorrect' })
    harness.dispatch({ type: 'RESOLVE_ATTEMPT' })
    harness.settle()

    expect(harness.state!.phase).toBe('reveal-running')
    expect(harness.state!.reveal!.status).toBe('running')
    expect(harness.state!.reveal!.elapsedBeforeStartMs).toBe(4_000)
  })

  it('allows unlimited failed attempts and both players may buzz again', () => {
    const harness = createHarness([revealQuestion('r1'), ...sevenNormal().slice(1)])
    startGame(harness)
    releaseRound(harness)

    for (let round = 0; round < 5; round += 1) {
      const playerId = round % 2 === 0 ? 'player-1' : 'player-2'
      harness.dispatch({ type: 'BUZZ', playerId })
      harness.dispatch({ type: 'MARK_MANUAL_ANSWER', verdict: 'incorrect' })
      harness.dispatch({ type: 'RESOLVE_ATTEMPT' })
      harness.settle()
      // On the image reveal nobody is locked.
      expect(harness.state!.players.every((player) => !player.lockedForCurrentQuestion)).toBe(true)
      expect(harness.state!.phase).toBe('reveal-running')
    }
    expect(harness.state!.attempts.filter((attempt) => attempt.outcome === 'incorrect')).toHaveLength(5)
    expect(harness.state!.players[0]!.score).toBe(0)
    expect(harness.state!.players[1]!.score).toBe(0)
  })

  it('gives 100 points without a failed attempt and 50 points after one', () => {
    const clean = createHarness([revealQuestion('r1'), ...sevenNormal().slice(1)])
    startGame(clean)
    releaseRound(clean)
    clean.dispatch({ type: 'BUZZ', playerId: 'player-1' })
    clean.dispatch({ type: 'MARK_MANUAL_ANSWER', verdict: 'correct' })
    clean.dispatch({ type: 'RESOLVE_ATTEMPT' })
    expect(clean.state!.players[0]!.score).toBe(100)

    const afterMiss = createHarness([revealQuestion('r1'), ...sevenNormal().slice(1)])
    startGame(afterMiss)
    releaseRound(afterMiss)
    afterMiss.dispatch({ type: 'BUZZ', playerId: 'player-1' })
    afterMiss.dispatch({ type: 'MARK_MANUAL_ANSWER', verdict: 'incorrect' })
    afterMiss.dispatch({ type: 'RESOLVE_ATTEMPT' })
    afterMiss.settle()
    afterMiss.dispatch({ type: 'BUZZ', playerId: 'player-2' })
    afterMiss.dispatch({ type: 'MARK_MANUAL_ANSWER', verdict: 'correct' })
    afterMiss.dispatch({ type: 'RESOLVE_ATTEMPT' })
    expect(afterMiss.state!.players[1]!.score).toBe(50)
  })

  it('a complete reveal does not lock the buzzer', () => {
    const harness = createHarness([revealQuestion('r1'), ...sevenNormal().slice(1)])
    startGame(harness)
    releaseRound(harness)

    harness.advance(gameTiming.imageRevealDurationMs + 2_000)
    expect(harness.state!.buzzer.open).toBe(true)
    harness.dispatch({ type: 'BUZZ', playerId: 'player-2' })
    expect(harness.state!.buzzer.acceptedPlayerId).toBe('player-2')

    const explicit = createHarness([revealQuestion('r1'), ...sevenNormal().slice(1)])
    startGame(explicit)
    releaseRound(explicit)
    explicit.dispatch({ type: 'REVEAL_IMAGE_COMPLETELY' })
    expect(explicit.state!.reveal!.status).toBe('completed')
    expect(explicit.state!.buzzer.open).toBe(true)
  })

  it('separates "reset buzzer" clearly from the technical reset of the reveal', () => {
    const harness = createHarness([revealQuestion('r1'), ...sevenNormal().slice(1)])
    startGame(harness)
    releaseRound(harness)
    harness.advance(6_000)
    harness.dispatch({ type: 'BUZZ', playerId: 'player-1' })

    harness.dispatch({ type: 'RESET_BUZZER' })
    // Resetting the buzzer leaves the reveal state unchanged.
    expect(harness.state!.reveal!.elapsedBeforeStartMs).toBe(6_000)
    expect(harness.state!.phase).toBe('reveal-paused')

    harness.dispatch({ type: 'RESET_IMAGE_REVEAL' })
    expect(harness.state!.reveal!.elapsedBeforeStartMs).toBe(0)
    expect(harness.state!.reveal!.status).toBe('running')
  })

  it('shows the fully sharp image after a correct answer', () => {
    const harness = createHarness([revealQuestion('r1'), ...sevenNormal().slice(1)])
    startGame(harness)
    releaseRound(harness)
    harness.advance(2_000)
    harness.dispatch({ type: 'BUZZ', playerId: 'player-1' })
    harness.dispatch({ type: 'MARK_MANUAL_ANSWER', verdict: 'correct' })
    harness.dispatch({ type: 'RESOLVE_ATTEMPT' })
    harness.settle()

    expect(harness.state!.phase).toBe('solution')
    expect(harness.state!.reveal!.status).toBe('completed')
  })
})

describe('Next, result and abort', () => {
  it('"next" always means next question or result', () => {
    const harness = createHarness(sevenNormal())
    startGame(harness)

    for (let index = 0; index < 7; index += 1) {
      expect(harness.state!.currentSlotIndex).toBe(index)
      harness.dispatch({ type: 'RESOLVE_WITHOUT_ANSWER' })
      expect(harness.state!.phase).toBe('solution')
      harness.dispatch({ type: 'CONTINUE' })
      harness.settle()
    }
    expect(harness.state!.phase).toBe('result')
    expect(harness.state!.status).toBe('completed')
  })

  /*
   * THE RESULT GOES, THE GAME STAYS.
   *
   * Between two rounds the desk takes the result off the screen: the room gets
   * its offer overview back, and the finished game keeps everything that makes
   * it finished. What is measured here is exactly that difference to an abort -
   * and that the step exists once, where it makes sense.
   */
  describe('Putting the start screen back up', () => {
    /** Plays the running game to its end - the seven questions, unanswered. */
    const playToResult = (harness: Harness) => {
      for (let index = 0; index < 7; index += 1) {
        harness.dispatch({ type: 'RESOLVE_WITHOUT_ANSWER' })
        harness.dispatch({ type: 'CONTINUE' })
        harness.settle()
      }
      expect(harness.state!.phase).toBe('result')
    }

    it('shows the offer overview again without ending the game', () => {
      const harness = createHarness(sevenNormal())
      startGame(harness)
      playToResult(harness)
      expect(harness.publicView().scene).toBe('result')

      harness.dispatch({ type: 'SHOW_START_SCREEN' })

      const view = harness.publicView()
      expect(view.scene).toBe('start')
      expect(view.quizOffers.length).toBeGreaterThan(0)
      // The game is finished, not aborted - the difference the log lives on.
      expect(harness.state!.status).toBe('completed')
      expect(harness.state!.phase).toBe('result')
      expect(harness.events.some((entry) => entry.message.includes('abgebrochen'))).toBe(false)
    })

    it('is offered on the result view and nowhere else', () => {
      const harness = createHarness(sevenNormal())
      startGame(harness)
      expect(availableCommands(harness.state)).not.toContain('SHOW_START_SCREEN')
      // While a game runs there is a result nobody has seen yet.
      expect(harness.expectReject({ type: 'SHOW_START_SCREEN' }).reason).toBe('invalid-phase')

      playToResult(harness)
      expect(availableCommands(harness.state)).toContain('SHOW_START_SCREEN')

      harness.dispatch({ type: 'SHOW_START_SCREEN' })
      // Once the overview stands there is nothing left to put away.
      expect(availableCommands(harness.state)).not.toContain('SHOW_START_SCREEN')
      expect(harness.expectReject({ type: 'SHOW_START_SCREEN' }).reason).toBe('invalid-phase')
    })

    it('leaves the scores alone - they are the evening, not the screen', () => {
      const harness = createHarness(sevenNormal())
      startGame(harness)
      playCorrect(harness, 'player-1')
      harness.dispatch({ type: 'CONTINUE' })
      harness.settle()
      for (let index = 0; index < 6; index += 1) {
        harness.dispatch({ type: 'RESOLVE_WITHOUT_ANSWER' })
        harness.dispatch({ type: 'CONTINUE' })
        harness.settle()
      }
      const before = harness.state!.players.map((player) => player.score)

      harness.dispatch({ type: 'SHOW_START_SCREEN' })
      expect(harness.state!.players.map((player) => player.score)).toEqual(before)
    })
  })

  it('rejects "next" outside the solution view', () => {
    const harness = createHarness(sevenNormal())
    startGame(harness)
    expect(harness.expectReject({ type: 'CONTINUE' }).reason).toBe('invalid-phase')
  })

  it('a tie yields a draw', () => {
    const harness = createHarness(sevenNormal())
    startGame(harness)
    // Both players get 100 points each.
    playCorrect(harness, 'player-1')
    harness.dispatch({ type: 'CONTINUE' })
    harness.settle()
    playCorrect(harness, 'player-2')

    expect(harness.state!.players[0]!.score).toBe(100)
    expect(harness.state!.players[1]!.score).toBe(100)
    expect(determineResult(harness.state!)).toEqual({ mode: 'duel', winnerPlayerId: null, isDraw: true })
  })

  it('an aborted game shows no result', () => {
    const harness = createHarness(sevenNormal())
    startGame(harness)
    playCorrect(harness, 'player-1')
    harness.dispatch({ type: 'ABORT_GAME' })

    expect(harness.state!.status).toBe('aborted')
    expect(harness.state!.phase).toBe('aborted')
    expect(availableCommands(harness.state)).not.toContain('CONTINUE')
    expect(harness.expectReject({ type: 'CONTINUE' }).reason).toBe('no-active-game')
  })
})

describe('Manual score correction', () => {
  it('corrects in the configured step, does not drop below zero and is logged', () => {
    const harness = createHarness(sevenNormal())
    startGame(harness)
    const step = scoringRules.manualAdjustmentStep

    harness.dispatch({ type: 'ADJUST_SCORE', playerId: 'player-2', direction: 'increase' })
    expect(harness.state!.players[1]!.score).toBe(step)

    harness.dispatch({ type: 'ADJUST_SCORE', playerId: 'player-2', direction: 'decrease' })
    expect(harness.state!.players[1]!.score).toBe(0)

    // No correction below zero; the command is refused understandably.
    expect(harness.expectReject({ type: 'ADJUST_SCORE', playerId: 'player-2', direction: 'decrease' }).reason).toBe(
      'invalid-payload',
    )

    expect(harness.scoreTransactions).toEqual([
      expect.objectContaining({ playerId: 'player-2', delta: step }),
      expect.objectContaining({ playerId: 'player-2', delta: -step }),
    ])
    const scoreLog = harness.events.filter((event) => event.category === 'score')
    expect(scoreLog.at(-1)!.message).toContain(`-${step}`)
  })

  it('stays available on the result view and recomputes the result', () => {
    const harness = createHarness([normalQuestion('q1')])
    startGame(harness)
    playCorrect(harness, 'player-1')
    harness.dispatch({ type: 'CONTINUE' })
    expect(harness.state!.phase).toBe('result')
    expect(determineResult(harness.state!).winnerPlayerId).toBe('player-1')

    // As many correction steps as the first correct answer was worth.
    const steps = scoringRules.firstAnswerPoints / scoringRules.manualAdjustmentStep
    for (let index = 0; index < steps; index += 1) {
      harness.dispatch({ type: 'ADJUST_SCORE', playerId: 'player-2', direction: 'increase' })
    }
    expect(determineResult(harness.state!)).toEqual({ mode: 'duel', winnerPlayerId: null, isDraw: true })
    expect(availableCommands(harness.state)).toContain('ADJUST_SCORE')
  })
})

describe('Duplicate events and stale transitions', () => {
  it('an attempt already judged cannot book points again', () => {
    const harness = createHarness(sevenNormal())
    startGame(harness)
    buzzIn(harness, 'player-1')
    harness.dispatch({ type: 'LOG_OPTION_ANSWER', optionId: 'a' })
    harness.dispatch({ type: 'RESOLVE_ATTEMPT' })

    // Second click on "resolve" during the feedback animation.
    expect(harness.expectReject({ type: 'RESOLVE_ATTEMPT' }).reason).toBe('invalid-phase')
    expect(harness.state!.players[0]!.score).toBe(100)
  })

  it('a transition reported twice does not fire twice', () => {
    const harness = createHarness(sevenNormal())
    startGame(harness)
    buzzIn(harness, 'player-1')
    harness.dispatch({ type: 'LOG_OPTION_ANSWER', optionId: 'a' })
    harness.dispatch({ type: 'RESOLVE_ATTEMPT' })

    const transitionId = harness.state!.pendingTransition!.transitionId
    harness.dispatch({ type: 'ADVANCE_TIMED_PHASE', transitionId })
    expect(harness.state!.phase).toBe('solution')

    const rejection = harness.expectReject({ type: 'ADVANCE_TIMED_PHASE', transitionId })
    expect(rejection.reason).toBe('invalid-phase')
    expect(harness.state!.phase).toBe('solution')
  })
})

describe('Skipping a question', () => {
  it('draws a replacement and locks the skipped question for this game', () => {
    const harness = createHarness(sevenNormal(), { spare: [normalQuestion('ersatz-1')] })
    startGame(harness)
    expect(harness.state!.currentQuestion!.question.id).toBe('q1')

    harness.dispatch({ type: 'SKIP_QUESTION', reason: 'Bild fehlerhaft' })
    harness.settle()

    expect(harness.state!.currentQuestion!.question.id).toBe('ersatz-1')
    expect(harness.state!.selectedQuestionIds).toContain('q1')
    expect(harness.state!.currentSlotIndex).toBe(0)
  })
})

describe('Solo game', () => {
  it('without the setting a duel is still created', () => {
    const harness = createHarness(sevenNormal())
    startGame(harness)
    expect(harness.state!.players).toHaveLength(2)
  })

  it('starts with exactly one player and takes over its label', () => {
    const harness = createHarness(sevenNormal())
    startGame(harness, { playerCount: 1, playerLabels: ['Mia'] })

    expect(harness.state!.players).toHaveLength(1)
    expect(harness.state!.players[0]!.id).toBe('player-1')
    expect(harness.state!.players[0]!.label).toBe('Mia')
  })

  it('knows no second player - its buzz is rejected', () => {
    const harness = createHarness(sevenNormal())
    startGame(harness, { playerCount: 1 })
    releaseRound(harness)

    expect(harness.expectReject({ type: 'BUZZ', playerId: 'player-2' }).reason).toBe('invalid-payload')
  })

  it('has no second chance: after the wrong answer the solution follows at once', () => {
    const harness = createHarness(sevenNormal())
    startGame(harness, { playerCount: 1 })
    buzzIn(harness, 'player-1')
    harness.dispatch({ type: 'LOG_OPTION_ANSWER', optionId: 'b' })
    harness.dispatch({ type: 'RESOLVE_ATTEMPT' })
    harness.settle()

    expect(harness.state!.phase).toBe('solution')
    expect(harness.state!.players[0]!.score).toBe(scoringRules.noPoints)
  })

  it('in the duel the second chance stays unchanged', () => {
    const harness = createHarness(sevenNormal())
    startGame(harness)
    buzzIn(harness, 'player-1')
    harness.dispatch({ type: 'LOG_OPTION_ANSWER', optionId: 'b' })
    harness.dispatch({ type: 'RESOLVE_ATTEMPT' })
    harness.settle()

    expect(harness.state!.phase).toBe('second-chance')
  })

  it('delivers a solo result: no winner, no draw, hit count', () => {
    const harness = createHarness([normalQuestion('q1'), normalQuestion('q2')])
    startGame(harness, { playerCount: 1 })

    playCorrect(harness, 'player-1')
    harness.dispatch({ type: 'CONTINUE' })
    harness.settle()
    buzzIn(harness, 'player-1')
    harness.dispatch({ type: 'LOG_OPTION_ANSWER', optionId: 'b' })
    harness.dispatch({ type: 'RESOLVE_ATTEMPT' })
    harness.settle()
    harness.dispatch({ type: 'CONTINUE' })
    harness.settle()

    expect(harness.state!.phase).toBe('result')
    expect(determineResult(harness.state!)).toEqual({
      mode: 'solo',
      winnerPlayerId: null,
      isDraw: false,
      solo: { correctAnswers: 1, questionCount: 2 },
    })
  })

  it('counts at most one hit per question, even with several attempts', () => {
    const harness = createHarness([revealQuestion('r1')])
    startGame(harness, { playerCount: 1 })

    buzzIn(harness, 'player-1')
    harness.dispatch({ type: 'MARK_MANUAL_ANSWER', verdict: 'incorrect' })
    harness.dispatch({ type: 'RESOLVE_ATTEMPT' })
    harness.settle()
    harness.dispatch({ type: 'BUZZ', playerId: 'player-1' })
    harness.dispatch({ type: 'MARK_MANUAL_ANSWER', verdict: 'correct' })
    harness.dispatch({ type: 'RESOLVE_ATTEMPT' })
    harness.settle()
    harness.dispatch({ type: 'CONTINUE' })
    harness.settle()

    expect(determineResult(harness.state!).solo).toEqual({ correctAnswers: 1, questionCount: 1 })
  })
})

describe('Self-service', () => {
  const selfService = { flowProfile: 'self-service' } as const

  /**
   * The full sequence of an answered tap at the device: take the buzz, log
   * the answer, submit the answer. It is the same command sequence as at the
   * operator's desk - that is exactly the point of the rebuild.
   */
  const answerWith = (harness: Harness, playerId: 'player-1' | 'player-2', optionId: string) => {
    harness.dispatch({ type: 'BUZZ', playerId })
    harness.dispatch({ type: 'LOG_OPTION_ANSWER', optionId })
    harness.dispatch({ type: 'RESOLVE_ATTEMPT' })
  }

  it('opens the answer areas without release by an operator', () => {
    const harness = createHarness(sevenNormal())
    startGame(harness, selfService)

    expect(harness.state!.phase).toBe('buzzer-open')
    expect(harness.state!.buzzer.open).toBe(true)
  })

  it('starts the reveal without release because nobody reads aloud', () => {
    /*
     * Image reveal with answer options: at the device exactly this version is
     * playable - the orally answered one would not be, it is skipped there
     * (separate test below).
     */
    const tappableImage = makeQuestion({
      id: 'bild-mit-optionen',
      questionType: 'image-reveal',
      image: { filename: 'questions/img-1.jpg' },
    })
    const harness = createHarness([tappableImage, ...sevenNormal().slice(1)])
    startGame(harness, selfService)

    expect(harness.state!.phase).toBe('reveal-running')
    expect(harness.state!.buzzer.open).toBe(true)
  })

  it('judges only when the logged answer is submitted', () => {
    const harness = createHarness(sevenNormal())
    startGame(harness, selfService)

    harness.dispatch({ type: 'BUZZ', playerId: 'player-1' })
    expect(harness.state!.phase).toBe('answer-locked')
    expect(harness.state!.buzzer.acceptedPlayerId).toBe('player-1')

    harness.dispatch({ type: 'LOG_OPTION_ANSWER', optionId: 'a' })
    // Logged is only marked - scoring happens only on submit.
    expect(harness.state!.phase).toBe('answer-locked')
    expect(harness.state!.players[0]!.score).toBe(0)

    harness.dispatch({ type: 'RESOLVE_ATTEMPT' })
    expect(harness.state!.phase).toBe('attempt-feedback')
    expect(harness.state!.players[0]!.score).toBe(scoringRules.firstAnswerPoints)
  })

  it('lets the player change their mind until submitting', () => {
    const harness = createHarness(sevenNormal())
    startGame(harness, selfService)

    harness.dispatch({ type: 'BUZZ', playerId: 'player-1' })
    harness.dispatch({ type: 'LOG_OPTION_ANSWER', optionId: 'b' })
    harness.dispatch({ type: 'LOG_OPTION_ANSWER', optionId: 'a' })
    harness.dispatch({ type: 'RESOLVE_ATTEMPT' })

    // The answer logged last is scored, not the first.
    expect(harness.state!.players[0]!.score).toBe(scoringRules.firstAnswerPoints)
  })

  it('rejects submitting without a logged answer', () => {
    const harness = createHarness(sevenNormal())
    startGame(harness, selfService)

    harness.dispatch({ type: 'BUZZ', playerId: 'player-1' })
    expect(harness.expectReject({ type: 'RESOLVE_ATTEMPT' }).reason).toBe('answer-not-logged')
  })

  it('the first valid buzz locks the other player', () => {
    const harness = createHarness(sevenNormal())
    startGame(harness, selfService)

    harness.dispatch({ type: 'BUZZ', playerId: 'player-1' })
    const rejection = harness.expectReject({ type: 'BUZZ', playerId: 'player-2' })

    expect(rejection.reason).toBe('buzzer-already-taken')
    expect(harness.state!.buzzer.acceptedPlayerId).toBe('player-1')
    expect(harness.state!.players[1]!.score).toBe(0)
  })

  it('the second chance belongs to the other player, without a new buzz-in', () => {
    const harness = createHarness(sevenNormal())
    startGame(harness, selfService)

    answerWith(harness, 'player-1', 'b')
    harness.advance(gameTiming.incorrectFeedbackMs)
    expect(harness.state!.phase).toBe('second-chance')

    // The buzz is not played for again: the open attempt already belongs
    // to the other player; a buzz has nothing to gain here.
    expect(pendingAttempt(harness.state!)!.playerId).toBe('player-2')
    expect(harness.expectReject({ type: 'BUZZ', playerId: 'player-1' }).reason).toBe('invalid-phase')

    harness.dispatch({ type: 'LOG_OPTION_ANSWER', optionId: 'a' })
    harness.dispatch({ type: 'RESOLVE_ATTEMPT' })
    expect(harness.state!.players[1]!.score).toBe(scoringRules.secondChancePoints)
  })

  it('locks the option already judged wrong in the second chance', () => {
    const harness = createHarness(sevenNormal())
    startGame(harness, selfService)

    answerWith(harness, 'player-1', 'b')
    harness.advance(gameTiming.incorrectFeedbackMs)
    expect(harness.state!.phase).toBe('second-chance')

    expect(harness.expectReject({ type: 'LOG_OPTION_ANSWER', optionId: 'b' }).reason).toBe('option-already-answered')
  })

  it('shows the question alone first and opens the answers after the delay', () => {
    const harness = createHarness(sevenNormal())
    harness.dispatch({ type: 'START_GAME', audience: 'adults', presetId: 'medium', ...selfService })
    harness.advance(gameTiming.pauseScreenMs)

    // The question stands, the buzzer is closed, and the options are not even sent.
    expect(harness.state!.phase).toBe('question-presented')
    expect(harness.state!.buzzer.open).toBe(false)
    expect(availableCommands(harness.state)).not.toContain('BUZZ')
    expect(harness.publicView().visibleOptions).toBeUndefined()

    harness.advance(selfServiceTiming.questionLeadInMs)
    expect(harness.state!.phase).toBe('buzzer-open')
    expect(availableCommands(harness.state)).toContain('BUZZ')
    expect(harness.publicView().visibleOptions).toHaveLength(4)
  })

  it('stays on the solution until a player moves on', () => {
    const harness = createHarness(sevenNormal())
    startGame(harness, selfService)
    answerWith(harness, 'player-1', 'a')
    harness.advance(gameTiming.correctFeedbackMs + gameTiming.solutionDelayMs)
    expect(harness.state!.phase).toBe('solution')
    expect(harness.state!.currentSlotIndex).toBe(0)

    /*
     * Waiting any length of time changes nothing - that is the point: whoever
     * reads why their answer was wrong does not lose the picture under their
     * eyes.
     */
    harness.advance(60_000)
    expect(harness.state!.phase).toBe('solution')
    expect(harness.state!.currentSlotIndex).toBe(0)

    expect(availableCommands(harness.state)).toContain('CONTINUE')
    expect(roleMayIssue('player', 'CONTINUE')).toBe(true)
    harness.dispatch({ type: 'CONTINUE' })
    expect(harness.state!.currentSlotIndex).toBe(1)

    harness.advance(gameTiming.pauseScreenMs)
    expect(harness.state!.phase).toBe('question-presented')
  })

  it('reaches the result view without a single operator command', () => {
    const harness = createHarness([normalQuestion('q1'), normalQuestion('q2')])
    startGame(harness, selfService)

    for (let question = 0; question < 2; question += 1) {
      answerWith(harness, 'player-1', 'a')
      harness.advance(gameTiming.correctFeedbackMs + gameTiming.solutionDelayMs)
      // `Weiter` comes from the player, not from the operator.
      harness.dispatch({ type: 'CONTINUE' })
      harness.advance(gameTiming.pauseScreenMs + selfServiceTiming.questionLeadInMs)
    }

    expect(harness.state!.phase).toBe('result')
    expect(harness.state!.status).toBe('completed')
    expect(harness.state!.players[0]!.score).toBe(2 * scoringRules.firstAnswerPoints)
  })

  it('offers no operator commands', () => {
    const harness = createHarness(sevenNormal())
    startGame(harness, selfService)

    const open = availableCommands(harness.state)
    expect(open).toContain('BUZZ')
    // Logging and submitting exist only once an attempt is open.
    expect(open).not.toContain('LOG_OPTION_ANSWER')
    expect(open).not.toContain('RESOLVE_ATTEMPT')
    expect(open).not.toContain('OPEN_BUZZER')
    expect(open).not.toContain('SELECT_PLAYER_MANUALLY')
    expect(open).not.toContain('ADJUST_SCORE')
    // `CONTINUE` does not exist here either - it belongs to the solution alone.
    expect(open).not.toContain('CONTINUE')

    harness.dispatch({ type: 'BUZZ', playerId: 'player-1' })
    const blocked = availableCommands(harness.state)
    expect(blocked).toContain('LOG_OPTION_ANSWER')
    expect(blocked).toContain('RESOLVE_ATTEMPT')
    expect(blocked).not.toContain('BUZZ')
    expect(blocked).not.toContain('RESET_BUZZER')
    expect(blocked).not.toContain('SKIP_QUESTION')
  })

  it('skips questions a human would have to judge, and logs that', () => {
    const harness = createHarness([revealQuestion('muendlich-1')], { spare: [normalQuestion('ersatz-1')] })
    startGame(harness, selfService)

    expect(harness.state!.currentQuestion!.question.id).toBe('ersatz-1')
    expect(harness.events.some((event) => event.message.includes('muendlich-1'))).toBe(true)
  })

  it('skips a question slot that contains no answerable question at all', () => {
    // Exactly the case of the shipped presets: a pure image-reveal slot.
    const harness = createHarness([normalQuestion('q1'), revealQuestion('nur-muendlich'), normalQuestion('q3')])
    startGame(harness, selfService)

    answerWith(harness, 'player-1', 'a')
    harness.advance(gameTiming.correctFeedbackMs + gameTiming.solutionDelayMs)
    harness.dispatch({ type: 'CONTINUE' })
    harness.advance(gameTiming.pauseScreenMs)

    expect(harness.state!.currentQuestion!.question.id).toBe('q3')
    expect(harness.events.some((event) => event.message.includes('Fragenplatz 2'))).toBe(true)
  })

  it('ends with the result when no answerable question follows', () => {
    const harness = createHarness([normalQuestion('q1'), revealQuestion('nur-muendlich')])
    startGame(harness, { ...selfService, playerCount: 1 })

    answerWith(harness, 'player-1', 'a')
    harness.advance(gameTiming.correctFeedbackMs + gameTiming.solutionDelayMs)
    harness.dispatch({ type: 'CONTINUE' })

    expect(harness.state!.phase).toBe('result')
    expect(determineResult(harness.state!).solo).toEqual({ correctAnswers: 1, questionCount: 1 })
  })

  it('rejects the start when no answerable question remains', () => {
    const harness = createHarness([revealQuestion('nur-muendlich')])
    const rejection = harness.expectReject({
      type: 'START_GAME',
      audience: 'adults',
      presetId: 'medium',
      flowProfile: 'self-service',
    })
    expect(rejection.reason).toBe('no-candidate-question')
  })

})

describe('Role permissions', () => {
  /*
   * On the stage evening the moderator stands next to the players and is the
   * first to see who raised a hand; the operator sits at the desk. So they may
   * award the buzz and log the answer - both steps they announce anyway.
   */
  it('lets the moderator set the buzz-in and log the answer', () => {
    expect(roleMayIssue('moderator', 'SELECT_PLAYER_MANUALLY')).toBe(true)
    expect(roleMayIssue('moderator', 'LOG_OPTION_ANSWER')).toBe(true)
    // Resolving and advancing were open to them already.
    expect(roleMayIssue('moderator', 'RESOLVE_ATTEMPT')).toBe(true)
    expect(roleMayIssue('moderator', 'CONTINUE')).toBe(true)
  })

  /*
   * What has NOT been added belongs to the contract just as much: points,
   * aborting, content and technical matters stay with the operator. Without
   * these lines an accidental extension of the table would go unnoticed.
   */
  it('leaves the operator what belongs to them', () => {
    for (const command of [
      'ADJUST_SCORE',
      'ABORT_GAME',
      'SKIP_QUESTION',
      'APPLY_QUESTION_PATCH',
      'RESET_BUZZER',
      'START_GAME',
    ] as const) {
      expect(roleMayIssue('moderator', command), command).toBe(false)
    }
  })

  it('still takes manual player selection away from the player', () => {
    expect(roleMayIssue('player', 'SELECT_PLAYER_MANUALLY')).toBe(false)
  })
})

function playCorrect(harness: ReturnType<typeof createHarness>, playerId: 'player-1' | 'player-2'): void {
  buzzIn(harness, playerId)
  harness.dispatch({ type: 'LOG_OPTION_ANSWER', optionId: 'a' })
  harness.dispatch({ type: 'RESOLVE_ATTEMPT' })
  harness.settle()
}
