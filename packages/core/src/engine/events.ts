/**
 * Derivation of game events from two consecutive snapshots.
 *
 * Hosts (kiosk, multi-game shell) want events - "game finished, here is the
 * result" -, but the server deliberately distributes complete snapshots only.
 * This function bridges the gap, DOM-free and without state of its own: the
 * caller holds the previous snapshot, the function compares.
 *
 * Generalises the proven dedup logic of the touch client: a result that is
 * ALREADY there in the first snapshot (restart in front of an old game state)
 * is not an event of this session - without a predecessor there are no events.
 */
import type { AttemptOutcome, PlayerId, PublicQuizViewModel } from '../contracts'

/** Result of a finished game - the payload for the host. */
export interface QuizGameResult {
  playerCount: number
  scores: { playerId: PlayerId; label: string; score: number }[]
  /** `null` on a draw and in a solo game. */
  winnerPlayerId: PlayerId | null
  isDraw: boolean
  /** Set only in a solo game. */
  correctAnswers?: number
  questionCount: number
}

export type QuizEvent =
  | { type: 'game-started' }
  | { type: 'question-presented'; questionNumber: number }
  | { type: 'buzz'; playerId: PlayerId | null }
  | { type: 'answer-logged'; optionId: string }
  | { type: 'attempt-resolved'; outcome: AttemptOutcome; playerId: PlayerId | null }
  | { type: 'game-finished'; result: QuizGameResult }
  | { type: 'game-aborted' }

/** Scenes in which no game is shown. */
const idleScenes: readonly string[] = ['start']

function chosenOptionId(view: PublicQuizViewModel): string | null {
  return view.visibleOptions?.find((option) => option.state === 'chosen')?.id ?? null
}

export function deriveQuizEvents(
  prev: PublicQuizViewModel | null,
  next: PublicQuizViewModel,
): QuizEvent[] {
  // Without a predecessor there is nothing to compare - and nothing to report. A
  // result or a running game in the very first snapshot belongs to an
  // earlier session.
  if (!prev) return []

  const events: QuizEvent[] = []
  const prevInGame = !idleScenes.includes(prev.scene) && prev.scene !== 'result'
  const nextInGame = !idleScenes.includes(next.scene) && next.scene !== 'result'

  if (!prevInGame && nextInGame) events.push({ type: 'game-started' })

  // New question: the progress counter changes while a question is visible
  // - or the same question number becomes visible after the interstitial screen.
  const questionVisible = next.question !== undefined
  const questionAppeared = questionVisible && prev.question === undefined
  const progressChanged = next.progress.current !== prev.progress.current
  if (questionVisible && (questionAppeared || progressChanged)) {
    events.push({ type: 'question-presented', questionNumber: next.progress.current })
  }

  if (next.phase === 'answer-locked' && prev.phase !== 'answer-locked') {
    events.push({ type: 'buzz', playerId: next.currentPlayer ?? null })
  }

  const chosen = chosenOptionId(next)
  if (chosen !== null && chosen !== chosenOptionId(prev)) {
    events.push({ type: 'answer-logged', optionId: chosen })
  }

  if (next.feedback && next.scene === 'feedback' && prev.scene !== 'feedback') {
    events.push({ type: 'attempt-resolved', outcome: next.feedback.outcome, playerId: next.feedback.playerId })
  }

  if (next.scene === 'result' && next.result && prev.scene !== 'result') {
    const { result } = next
    events.push({
      type: 'game-finished',
      result: {
        playerCount: result.scores.length,
        scores: result.scores.map(({ playerId, label, score }) => ({ playerId, label, score })),
        winnerPlayerId: result.winnerPlayerId,
        isDraw: result.isDraw,
        ...(result.solo ? { correctAnswers: result.solo.correctAnswers } : {}),
        questionCount: next.progress.total,
      },
    })
  }

  // Back to the start scene from the middle of a game happens only by aborting.
  if (prevInGame && idleScenes.includes(next.scene)) events.push({ type: 'game-aborted' })

  return events
}
