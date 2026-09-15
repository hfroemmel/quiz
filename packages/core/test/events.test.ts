/**
 * Event derivation from snapshot pairs (`deriveQuizEvents`).
 *
 * The snapshots come from the real projection of a played flow - not from
 * hand-built dummies. That way the cases also prove that the derivation works
 * on the actual view model.
 */
import { describe, expect, it } from 'vitest'
import { gameTiming, type PublicQuizViewModel } from '../src'
import { deriveQuizEvents, type QuizEvent } from '../src/engine/events'
import { createHarness, makeQuestion, startGame, type Harness } from './helpers'

const selfService = { flowProfile: 'self-service' } as const

/** Collects the derived events per intermediate state. */
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
  it('reports nothing on the very first snapshot - not even an old result', () => {
    const harness = createHarness([makeQuestion({ id: 'q1' })])
    startGame(harness, { ...selfService, playerCount: 1 })
    expect(deriveQuizEvents(null, harness.publicView())).toEqual([])
  })

  it('derives the full chain of a game', () => {
    const harness = createHarness([makeQuestion({ id: 'q1' })])
    const recorder = new Recorder(harness)
    recorder.observe()

    startGame(harness, selfService)
    recorder.observe()

    harness.dispatch({ type: 'BUZZ', playerId: 'player-1' })
    recorder.observe()

    harness.dispatch({ type: 'LOG_OPTION_ANSWER', optionId: 'b' })
    recorder.observe()

    // Changing one's mind creates another answer-logged - exactly as at the desk.
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

  it('reports an abort as game-aborted, not as a result', () => {
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

  it('recognises every further question by the progress counter', () => {
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
