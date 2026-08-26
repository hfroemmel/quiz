/**
 * Ereignisableitung aus Snapshot-Paaren (`deriveQuizEvents`).
 *
 * Die Snapshots kommen aus der echten Projektion eines gespielten Ablaufs -
 * nicht aus handgebauten Attrappen. So belegen die Faelle zugleich, dass die
 * Ableitung auf dem tatsaechlichen View-Modell funktioniert.
 */
import { describe, expect, it } from 'vitest'
import { gameTiming, type PublicQuizViewModel } from '../src'
import { deriveQuizEvents, type QuizEvent } from '../src/engine/events'
import { createHarness, makeQuestion, startGame, type Harness } from './helpers'

const selfService = { flowProfile: 'self-service' } as const

/** Sammelt je Zwischenstand die abgeleiteten Ereignisse ein. */
class Recorder {
  private last: PublicQuizViewModel | null = null
  readonly events: QuizEvent[] = []

  constructor(private readonly harness: Harness) {}

  observe(): void {
    const next = this.harness.publicView()
    this.events.push(...deriveQuizEvents(this.last, next))
    this.last = next
  }
}

describe('deriveQuizEvents', () => {
  it('meldet beim allerersten Snapshot nichts - auch nicht ein altes Ergebnis', () => {
    const harness = createHarness([makeQuestion({ id: 'q1' })])
    startGame(harness, { ...selfService, playerCount: 1 })
    expect(deriveQuizEvents(null, harness.publicView())).toEqual([])
  })

  it('leitet die volle Kette eines Spiels ab', () => {
    const harness = createHarness([makeQuestion({ id: 'q1' })])
    const recorder = new Recorder(harness)
    recorder.observe()

    startGame(harness, selfService)
    recorder.observe()

    harness.dispatch({ type: 'BUZZ', playerId: 'player-1' })
    recorder.observe()

    harness.dispatch({ type: 'LOG_OPTION_ANSWER', optionId: 'b' })
    recorder.observe()

    // Umentscheiden erzeugt ein weiteres answer-logged - genau wie am Pult.
    harness.dispatch({ type: 'LOG_OPTION_ANSWER', optionId: 'a' })
    recorder.observe()

    harness.dispatch({ type: 'RESOLVE_ATTEMPT' })
    recorder.observe()

    harness.advance(gameTiming.correctFeedbackMs + gameTiming.solutionDelayMs)
    recorder.observe()

    harness.dispatch({ type: 'CONTINUE' })
    harness.settle()
    recorder.observe()

    expect(recorder.events).toEqual([
      { type: 'game-started' },
      { type: 'question-presented', questionNumber: 1 },
      { type: 'buzz', playerId: 'player-1' },
      { type: 'answer-logged', optionId: 'b' },
      { type: 'answer-logged', optionId: 'a' },
      { type: 'attempt-resolved', outcome: 'correct', playerId: 'player-1' },
      {
        type: 'game-finished',
        result: {
          playerCount: 2,
          scores: [
            expect.objectContaining({ playerId: 'player-1', score: 100 }),
            expect.objectContaining({ playerId: 'player-2', score: 0 }),
          ],
          winnerPlayerId: 'player-1',
          isDraw: false,
          questionCount: 1,
        },
      },
    ])
  })

  it('meldet einen Abbruch als game-aborted, nicht als Ergebnis', () => {
    const harness = createHarness([makeQuestion({ id: 'q1' }), makeQuestion({ id: 'q2' })])
    const recorder = new Recorder(harness)
    recorder.observe()

    startGame(harness, selfService)
    recorder.observe()
    harness.dispatch({ type: 'ABORT_GAME' })
    recorder.observe()

    expect(recorder.events.map((event) => event.type)).toEqual([
      'game-started',
      'question-presented',
      'game-aborted',
    ])
  })

  it('erkennt jede weitere Frage am Fortschrittszaehler', () => {
    const harness = createHarness([makeQuestion({ id: 'q1' }), makeQuestion({ id: 'q2' })])
    const recorder = new Recorder(harness)
    recorder.observe()
    startGame(harness, selfService)
    recorder.observe()

    harness.dispatch({ type: 'BUZZ', playerId: 'player-1' })
    harness.dispatch({ type: 'LOG_OPTION_ANSWER', optionId: 'a' })
    harness.dispatch({ type: 'RESOLVE_ATTEMPT' })
    harness.advance(gameTiming.correctFeedbackMs + gameTiming.solutionDelayMs)
    harness.dispatch({ type: 'CONTINUE' })
    harness.advance(gameTiming.pauseScreenMs + 10_000)
    recorder.observe()

    expect(recorder.events.filter((event) => event.type === 'question-presented')).toEqual([
      { type: 'question-presented', questionNumber: 1 },
      { type: 'question-presented', questionNumber: 2 },
    ])
  })
})
