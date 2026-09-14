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
    media: { imageAssetId: 'img-1' },
  })
const videoQuestion = (id: string) =>
  makeQuestion({ id, questionType: 'video-then-question', media: { videoAssetId: 'vid-1' } })

const sevenNormal = () => Array.from({ length: 7 }, (_, index) => normalQuestion(`q${index + 1}`))

describe('Spielstart und Ablauf', () => {
  it('startet mit Pausenscreen und blendet danach die erste Frage ein', () => {
    const harness = createHarness(sevenNormal())
    harness.dispatch({ type: 'START_GAME', audience: 'adults', presetId: 'medium' })

    expect(harness.state!.phase).toBe('pause-screen')
    expect(harness.state!.totalQuestions).toBe(7)
    expect(harness.state!.currentQuestion?.question.id).toBe('q1')

    harness.advance(gameTiming.pauseScreenMs)
    expect(harness.state!.phase).toBe('question-presented')
  })

  it('meldet den Fortschritt als Frage x/y', () => {
    const harness = createHarness(sevenNormal())
    startGame(harness)
    expect(harness.state!.currentSlotIndex).toBe(0)
    expect(harness.state!.totalQuestions).toBe(7)
  })
})

describe('Buzzerregeln', () => {
  it('der erste Buzzer gewinnt, der zweite wird abgewiesen', () => {
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

  it('Key-Repeat erzeugt keinen zweiten Buzz', () => {
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

  it('der Buzzer ist waehrend des Videos gesperrt', () => {
    const harness = createHarness([videoQuestion('v1'), ...sevenNormal().slice(1)])
    startGame(harness)
    expect(harness.state!.phase).toBe('video')

    expect(harness.expectReject({ type: 'BUZZ', playerId: 'player-1' }).reason).toBe('invalid-phase')
    harness.dispatch({ type: 'START_VIDEO', questionId: 'v1' })
    expect(harness.state!.phase).toBe('video')
    expect(harness.state!.buzzer.open).toBe(false)
    expect(harness.expectReject({ type: 'BUZZ', playerId: 'player-2' }).reason).toBe('invalid-phase')

    harness.dispatch({ type: 'SHOW_QUESTION_AFTER_VIDEO' })
    harness.dispatch({ type: 'OPEN_BUZZER' })
    harness.dispatch({ type: 'BUZZ', playerId: 'player-2' })
    expect(harness.state!.buzzer.acceptedPlayerId).toBe('player-2')
  })

  it('manuelle Spielerauswahl durchlaeuft dieselbe Validierung wie der Buzzer', () => {
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

describe('Normale Multiple-Choice-Frage', () => {
  it('erste richtige Antwort gibt exakt 100 Punkte und zeigt danach die Loesung', () => {
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

  it('haelt die Loesung nach falscher erster Antwort verborgen und gibt die zweite Chance', () => {
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

  it('nur der zweite Spieler ist in der zweiten Chance berechtigt', () => {
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

  it('sperrt eine bereits als falsch bewertete Option fuer die zweite Chance', () => {
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

  it('meldet die verbrauchte Option auch im oeffentlichen View-Modell', () => {
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

  it('richtige zweite Chance gibt exakt 50 Punkte', () => {
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

  it('falsche Antworten geben keine Minuspunkte', () => {
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

  it('Passen gibt keine Punkte und fuehrt direkt zur Loesung', () => {
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

  it('erlaubt jederzeit das Aufloesen ohne Buzzer und ohne Antwort', () => {
    const harness = createHarness(sevenNormal())
    startGame(harness)
    // There is no mandatory wait before resolving.
    harness.dispatch({ type: 'RESOLVE_WITHOUT_ANSWER' })
    expect(harness.state!.phase).toBe('solution')
    expect(harness.state!.players[0]!.score).toBe(0)
    expect(harness.state!.players[1]!.score).toBe(0)
    expect(harness.state!.attempts.at(-1)!.outcome).toBe('no-answer')
  })

  it('verlangt vor dem Aufloesen eine eingeloggte Antwort', () => {
    const harness = createHarness(sevenNormal())
    startGame(harness)
    buzzIn(harness, 'player-1')
    expect(harness.expectReject({ type: 'RESOLVE_ATTEMPT' }).reason).toBe('answer-not-logged')
  })

  it('setzt den Buzzer zurueck, ohne die Sperre eines Fehlversuchs aufzuheben', () => {
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

describe('Bilderkennen mit Enthuellung', () => {
  it('wartet auf die Freigabe, bevor die Enthuellung laeuft und der Buzzer oeffnet', () => {
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

  it('zaehlt erst ab der Freigabe - die Vorlesezeit kostet keine Sekunde', () => {
    const harness = createHarness([revealQuestion('r1'), ...sevenNormal().slice(1)])
    startGame(harness)

    harness.advance(6_000)
    harness.dispatch({ type: 'START_IMAGE_REVEAL' })
    harness.advance(2_000)

    expect(harness.state!.reveal!.elapsedBeforeStartMs).toBe(0)
    harness.dispatch({ type: 'PAUSE_IMAGE_REVEAL' })
    expect(harness.state!.reveal!.elapsedBeforeStartMs).toBe(2_000)
  })

  it('pausiert bei gueltigem Buzzer und setzt an derselben Position fort', () => {
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

  it('erlaubt unbegrenzt viele Fehlversuche und beide Spieler duerfen erneut buzzern', () => {
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

  it('gibt 100 Punkte ohne Fehlversuch und 50 Punkte nach einem Fehlversuch', () => {
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

  it('vollstaendige Enthuellung sperrt den Buzzer nicht', () => {
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

  it('trennt "Buzzer zuruecksetzen" klar vom technischen Reset der Enthuellung', () => {
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

  it('zeigt nach richtiger Antwort das vollstaendig scharfe Bild', () => {
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

describe('Weiter, Ergebnis und Abbruch', () => {
  it('"Weiter" bedeutet immer naechste Frage bzw. Ergebnis', () => {
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

  it('lehnt "Weiter" ausserhalb der Loesungsansicht ab', () => {
    const harness = createHarness(sevenNormal())
    startGame(harness)
    expect(harness.expectReject({ type: 'CONTINUE' }).reason).toBe('invalid-phase')
  })

  it('Gleichstand ergibt Unentschieden', () => {
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

  it('ein abgebrochenes Spiel zeigt kein Ergebnis', () => {
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

describe('Manuelle Punktkorrektur', () => {
  it('korrigiert in der konfigurierten Schrittweite, faellt nicht unter null und wird protokolliert', () => {
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

  it('bleibt auf der Ergebnisansicht verfuegbar und berechnet das Ergebnis neu', () => {
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

describe('Doppelte Ereignisse und veraltete Uebergaenge', () => {
  it('ein bereits ausgewerteter Versuch kann nicht erneut Punkte buchen', () => {
    const harness = createHarness(sevenNormal())
    startGame(harness)
    buzzIn(harness, 'player-1')
    harness.dispatch({ type: 'LOG_OPTION_ANSWER', optionId: 'a' })
    harness.dispatch({ type: 'RESOLVE_ATTEMPT' })

    // Second click on "resolve" during the feedback animation.
    expect(harness.expectReject({ type: 'RESOLVE_ATTEMPT' }).reason).toBe('invalid-phase')
    expect(harness.state!.players[0]!.score).toBe(100)
  })

  it('ein doppelt gemeldeter Uebergang loest nicht zweimal aus', () => {
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

describe('Frage ueberspringen', () => {
  it('zieht einen Ersatz und sperrt die uebersprungene Frage fuer dieses Spiel', () => {
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

describe('Einzelspiel', () => {
  it('ohne Angabe entsteht weiterhin ein Duell', () => {
    const harness = createHarness(sevenNormal())
    startGame(harness)
    expect(harness.state!.players).toHaveLength(2)
  })

  it('startet mit genau einem Spieler und uebernimmt dessen Beschriftung', () => {
    const harness = createHarness(sevenNormal())
    startGame(harness, { playerCount: 1, playerLabels: ['Mia'] })

    expect(harness.state!.players).toHaveLength(1)
    expect(harness.state!.players[0]!.id).toBe('player-1')
    expect(harness.state!.players[0]!.label).toBe('Mia')
  })

  it('kennt keinen zweiten Spieler - dessen Buzzer wird abgewiesen', () => {
    const harness = createHarness(sevenNormal())
    startGame(harness, { playerCount: 1 })
    releaseRound(harness)

    expect(harness.expectReject({ type: 'BUZZ', playerId: 'player-2' }).reason).toBe('invalid-payload')
  })

  it('hat keine zweite Chance: nach der falschen Antwort folgt sofort die Loesung', () => {
    const harness = createHarness(sevenNormal())
    startGame(harness, { playerCount: 1 })
    buzzIn(harness, 'player-1')
    harness.dispatch({ type: 'LOG_OPTION_ANSWER', optionId: 'b' })
    harness.dispatch({ type: 'RESOLVE_ATTEMPT' })
    harness.settle()

    expect(harness.state!.phase).toBe('solution')
    expect(harness.state!.players[0]!.score).toBe(scoringRules.noPoints)
  })

  it('im Duell bleibt die zweite Chance unveraendert erhalten', () => {
    const harness = createHarness(sevenNormal())
    startGame(harness)
    buzzIn(harness, 'player-1')
    harness.dispatch({ type: 'LOG_OPTION_ANSWER', optionId: 'b' })
    harness.dispatch({ type: 'RESOLVE_ATTEMPT' })
    harness.settle()

    expect(harness.state!.phase).toBe('second-chance')
  })

  it('liefert ein Solo-Ergebnis: kein Gewinner, kein Unentschieden, Trefferzahl', () => {
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

  it('zaehlt je Frage hoechstens einen Treffer, auch bei mehreren Versuchen', () => {
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

describe('Selbstbedienung', () => {
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

  it('oeffnet die Antwortflaechen ohne Freigabe durch einen Operator', () => {
    const harness = createHarness(sevenNormal())
    startGame(harness, selfService)

    expect(harness.state!.phase).toBe('buzzer-open')
    expect(harness.state!.buzzer.open).toBe(true)
  })

  it('startet die Enthuellung ohne Freigabe, weil niemand vorliest', () => {
    /*
     * Image reveal with answer options: at the device exactly this version is
     * playable - the orally answered one would not be, it is skipped there
     * (separate test below).
     */
    const tappableImage = makeQuestion({
      id: 'bild-mit-optionen',
      questionType: 'image-reveal',
      media: { imageAssetId: 'img-1' },
    })
    const harness = createHarness([tappableImage, ...sevenNormal().slice(1)])
    startGame(harness, selfService)

    expect(harness.state!.phase).toBe('reveal-running')
    expect(harness.state!.buzzer.open).toBe(true)
  })

  it('wertet erst, wenn die eingeloggte Antwort abgegeben wird', () => {
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

  it('laesst den Spieler bis zum Abgeben umentscheiden', () => {
    const harness = createHarness(sevenNormal())
    startGame(harness, selfService)

    harness.dispatch({ type: 'BUZZ', playerId: 'player-1' })
    harness.dispatch({ type: 'LOG_OPTION_ANSWER', optionId: 'b' })
    harness.dispatch({ type: 'LOG_OPTION_ANSWER', optionId: 'a' })
    harness.dispatch({ type: 'RESOLVE_ATTEMPT' })

    // The answer logged last is scored, not the first.
    expect(harness.state!.players[0]!.score).toBe(scoringRules.firstAnswerPoints)
  })

  it('weist das Abgeben ohne eingeloggte Antwort ab', () => {
    const harness = createHarness(sevenNormal())
    startGame(harness, selfService)

    harness.dispatch({ type: 'BUZZ', playerId: 'player-1' })
    expect(harness.expectReject({ type: 'RESOLVE_ATTEMPT' }).reason).toBe('answer-not-logged')
  })

  it('der erste gueltige Buzz sperrt den anderen Spieler', () => {
    const harness = createHarness(sevenNormal())
    startGame(harness, selfService)

    harness.dispatch({ type: 'BUZZ', playerId: 'player-1' })
    const rejection = harness.expectReject({ type: 'BUZZ', playerId: 'player-2' })

    expect(rejection.reason).toBe('buzzer-already-taken')
    expect(harness.state!.buzzer.acceptedPlayerId).toBe('player-1')
    expect(harness.state!.players[1]!.score).toBe(0)
  })

  it('die zweite Chance gehoert dem anderen Spieler, ohne neuen Zuschlag', () => {
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

  it('sperrt die bereits falsch bewertete Option in der zweiten Chance', () => {
    const harness = createHarness(sevenNormal())
    startGame(harness, selfService)

    answerWith(harness, 'player-1', 'b')
    harness.advance(gameTiming.incorrectFeedbackMs)
    expect(harness.state!.phase).toBe('second-chance')

    expect(harness.expectReject({ type: 'LOG_OPTION_ANSWER', optionId: 'b' }).reason).toBe('option-already-answered')
  })

  it('zeigt erst die Frage allein und oeffnet die Antworten nach der Frist', () => {
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

  it('bleibt auf der Loesung stehen, bis ein Spieler weitergeht', () => {
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

  it('erreicht die Ergebnisansicht ohne einen einzigen Operatorbefehl', () => {
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

  it('bietet keine Operatorbefehle an', () => {
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

  it('ueberspringt Fragen, die ein Mensch bewerten muesste, und protokolliert das', () => {
    const harness = createHarness([revealQuestion('muendlich-1')], { spare: [normalQuestion('ersatz-1')] })
    startGame(harness, selfService)

    expect(harness.state!.currentQuestion!.question.id).toBe('ersatz-1')
    expect(harness.events.some((event) => event.message.includes('muendlich-1'))).toBe(true)
  })

  it('ueberspringt einen Fragenplatz, der gar keine beantwortbare Frage enthaelt', () => {
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

  it('endet mit dem Ergebnis, wenn keine beantwortbare Frage mehr folgt', () => {
    const harness = createHarness([normalQuestion('q1'), revealQuestion('nur-muendlich')])
    startGame(harness, { ...selfService, playerCount: 1 })

    answerWith(harness, 'player-1', 'a')
    harness.advance(gameTiming.correctFeedbackMs + gameTiming.solutionDelayMs)
    harness.dispatch({ type: 'CONTINUE' })

    expect(harness.state!.phase).toBe('result')
    expect(determineResult(harness.state!).solo).toEqual({ correctAnswers: 1, questionCount: 1 })
  })

  it('weist den Start ab, wenn keine beantwortbare Frage uebrig bleibt', () => {
    const harness = createHarness([revealQuestion('nur-muendlich')])
    const rejection = harness.expectReject({
      type: 'START_GAME',
      audience: 'adults',
      presetId: 'medium',
      flowProfile: 'self-service',
    })
    expect(rejection.reason).toBe('no-candidate-question')
  })

  it('startet das Video am Geraet von selbst und blendet die Frage nach dem Ende ein', () => {
    /*
     * At the touch device nobody is at the desk. So the server issues the
     * request itself - after a short lead-in, so that the video area comes up
     * first. Only the device sees the end, and it shows the question itself
     * afterwards.
     */
    const harness = createHarness([videoQuestion('video-1')])
    startGame(harness, selfService)
    expect(harness.state!.phase).toBe('video')
    expect(harness.state!.video).toBeUndefined()

    harness.advance(selfServiceTiming.videoLeadInMs)
    // The request stands - the phase has NOT changed.
    expect(harness.state!.phase).toBe('video')
    expect(harness.state!.video).toMatchObject({ questionId: 'video-1' })
    expect(harness.state!.pendingTransition).toBeUndefined()

    // The server waits for nothing: even long after, the question does not stand.
    harness.advance(60_000)
    expect(harness.state!.phase).toBe('video')

    /*
     * And the device may do that: `SHOW_QUESTION_AFTER_VIDEO` is open to the
     * player, because there is no desk there that could take the step.
     */
    expect(roleMayIssue('player', 'SHOW_QUESTION_AFTER_VIDEO')).toBe(true)
    harness.dispatch({ type: 'SHOW_QUESTION_AFTER_VIDEO' })
    expect(harness.state!.phase).toBe('question-presented')
    harness.advance(selfServiceTiming.questionLeadInMs)
    expect(harness.state!.phase).toBe('buzzer-open')
  })

  it('veroeffentlicht auf Befehl einen Auftrag und wartet danach auf nichts', () => {
    const harness = createHarness([videoQuestion('video-1'), ...sevenNormal().slice(1)])
    startGame(harness)
    expect(harness.state!.phase).toBe('video')
    expect(harness.state!.video).toBeUndefined()

    harness.dispatch({ type: 'START_VIDEO', questionId: 'video-1' })

    const task = harness.state!.video!
    expect(task.questionId).toBe('video-1')
    expect(task.requestId).toBeTruthy()
    expect(task.requestedAt).toBeTruthy()
    /*
     * NO SCHEDULED END. The server does not know the duration and does not
     * mirror it - the end of the video is no server-side transition.
     */
    expect(harness.state!.pendingTransition).toBeUndefined()
    expect(harness.state!.phase).toBe('video')

    // Even after any length of time everything stays as it is.
    harness.advance(10 * 60_000)
    expect(harness.state!.phase).toBe('video')
    expect(harness.state!.video).toEqual(task)
  })

  it('erzeugt bei jedem Klick einen neuen Auftrag', () => {
    const harness = createHarness([videoQuestion('video-1'), ...sevenNormal().slice(1)])
    startGame(harness)

    harness.dispatch({ type: 'START_VIDEO', questionId: 'video-1' })
    const firstOne = harness.state!.video!.requestId
    harness.advance(3_000)
    harness.dispatch({ type: 'START_VIDEO', questionId: 'video-1' })

    // A new id is the whole message: the stage plays from the start again.
    expect(harness.state!.video!.requestId).not.toBe(firstOne)
    expect(harness.state!.video!.questionId).toBe('video-1')
  })

  it('weist einen Klick ab, der zu einer anderen Frage gehoert', () => {
    const harness = createHarness([videoQuestion('video-1'), ...sevenNormal().slice(1)])
    startGame(harness)

    const rejectedCount = harness.expectReject({ type: 'START_VIDEO', questionId: 'video-von-gestern' })
    expect(rejectedCount.reason).toBe('video-question-mismatch')
    expect(harness.state!.video).toBeUndefined()
  })

  it('weist einen Klick ab, wenn zu der Frage kein Video hinterlegt ist', () => {
    const withoutFile = { ...videoQuestion('video-1'), media: undefined }
    const harness = createHarness([withoutFile, ...sevenNormal().slice(1)])
    startGame(harness)

    expect(harness.expectReject({ type: 'START_VIDEO', questionId: 'video-1' }).reason).toBe(
      'video-source-missing',
    )
  })

  it('weist einen Klick ausserhalb der Videophase ab', () => {
    const harness = createHarness([videoQuestion('video-1'), ...sevenNormal().slice(1)])
    startGame(harness)
    harness.dispatch({ type: 'SHOW_QUESTION_AFTER_VIDEO' })

    expect(harness.expectReject({ type: 'START_VIDEO', questionId: 'video-1' }).reason).toBe('invalid-phase')
  })

  it('bietet am Pult nur Starten, Einblenden und Ueberspringen an', () => {
    const harness = createHarness([videoQuestion('video-1'), ...sevenNormal().slice(1)])
    startGame(harness)

    const allowed = harness.operatorView().allowedCommands
    expect(allowed).toEqual(expect.arrayContaining(['START_VIDEO', 'SHOW_QUESTION_AFTER_VIDEO', 'SKIP_QUESTION']))
    /*
     * What no longer exists: pausing, restarting and the client's status
     * report. A button for those would be a button for a state nobody tracks
     * any more.
     */
    expect(allowed).not.toContain('PAUSE_VIDEO')
    expect(allowed).not.toContain('RESTART_VIDEO')
    expect(allowed).not.toContain('REPORT_VIDEO_STATUS')

    // And the start button stays for the whole phase, also after a click.
    harness.dispatch({ type: 'START_VIDEO', questionId: 'video-1' })
    expect(harness.operatorView().allowedCommands).toContain('START_VIDEO')
  })

  it('raeumt den Auftrag ab, sobald die Frage eingeblendet ist', () => {
    /*
     * Otherwise every window reloading now would execute it - and the video
     * would start again underneath the question already standing.
     */
    const harness = createHarness([videoQuestion('video-1'), ...sevenNormal().slice(1)])
    startGame(harness)
    harness.dispatch({ type: 'START_VIDEO', questionId: 'video-1' })
    expect(harness.state!.video).toBeDefined()

    harness.dispatch({ type: 'SHOW_QUESTION_AFTER_VIDEO' })
    expect(harness.state!.phase).toBe('question-presented')
    expect(harness.state!.video).toBeUndefined()
  })

  it('traegt den Auftrag unveraendert in den Schnappschuss', () => {
    const harness = createHarness([videoQuestion('video-1'), ...sevenNormal().slice(1)])
    startGame(harness)
    harness.dispatch({ type: 'START_VIDEO', questionId: 'video-1' })

    const task = harness.state!.video!
    for (const view of [harness.publicView(), harness.operatorView()]) {
      // Id and question - and nothing about the playback.
      expect(view.video).toEqual({ questionId: 'video-1', requestId: task.requestId })
    }
  })
})

describe('Rollenrechte', () => {
  /*
   * On the stage evening the moderator stands next to the players and is the
   * first to see who raised a hand; the operator sits at the desk. So they may
   * award the buzz and log the answer - both steps they announce anyway.
   */
  it('laesst den Moderator den Zuschlag setzen und die Antwort einloggen', () => {
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
  it('laesst dem Operator, was ihm gehoert', () => {
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

  it('nimmt dem Spieler weiterhin die manuelle Spielerwahl', () => {
    expect(roleMayIssue('player', 'SELECT_PLAYER_MANUALLY')).toBe(false)
  })
})

function playCorrect(harness: ReturnType<typeof createHarness>, playerId: 'player-1' | 'player-2'): void {
  buzzIn(harness, playerId)
  harness.dispatch({ type: 'LOG_OPTION_ANSWER', optionId: 'a' })
  harness.dispatch({ type: 'RESOLVE_ATTEMPT' })
  harness.settle()
}
