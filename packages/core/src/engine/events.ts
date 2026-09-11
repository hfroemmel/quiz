/**
 * Ableitung von Spielereignissen aus zwei aufeinanderfolgenden Snapshots.
 *
 * Gastgeber (Kiosk, Multigame-Shell) wollen Ereignisse - "Spiel fertig, hier ist
 * das Ergebnis" -, der Server verteilt aber bewusst nur vollstaendige Snapshots.
 * Diese Funktion schlaegt die Bruecke, DOM-frei und ohne eigenen Zustand: Der
 * Aufrufer haelt den vorigen Snapshot, die Funktion vergleicht.
 *
 * Verallgemeinert die bewaehrte Dedup-Logik des Touchclients: Ein Ergebnis, das
 * beim ersten Snapshot BEREITS dasteht (Neustart vor einem alten Spielstand),
 * ist kein Ereignis dieser Sitzung - ohne Vorgaenger gibt es keine Ereignisse.
 */
import { lifelineTypes, type AttemptOutcome, type LifelineType, type PlayerId, type PublicQuizViewModel } from '../contracts'

/** Ergebnis eines beendeten Spiels - die Nutzlast fuer den Gastgeber. */
export interface QuizGameResult {
  playerCount: number
  scores: { playerId: PlayerId; label: string; score: number }[]
  /** `null` bei Unentschieden und im Einzelspiel. */
  winnerPlayerId: PlayerId | null
  isDraw: boolean
  /** Nur im Einzelspiel gesetzt. */
  correctAnswers?: number
  questionCount: number
}

export type QuizEvent =
  | { type: 'game-started' }
  | { type: 'question-presented'; questionNumber: number }
  | { type: 'buzz'; playerId: PlayerId | null }
  | { type: 'answer-logged'; optionId: string }
  | { type: 'attempt-resolved'; outcome: AttemptOutcome; playerId: PlayerId | null }
  /**
   * A lifeline changed hands. Derived from the snapshot like every other event
   * here, so a host learns about it without listening to the transport - and
   * so a client that reconnects mid-game does not replay it.
   */
  | { type: 'lifelineUsed'; playerId: PlayerId; lifelineType: LifelineType }
  | { type: 'lifelineRestored'; playerId: PlayerId; lifelineType: LifelineType }
  | { type: 'game-finished'; result: QuizGameResult }
  | { type: 'game-aborted' }

/** Szenen, in denen kein Spiel dargestellt wird. */
const idleScenes: readonly string[] = ['start']

function chosenOptionId(view: PublicQuizViewModel): string | null {
  return view.visibleOptions?.find((option) => option.state === 'chosen')?.id ?? null
}

/** `player-1:fiftyFifty` -> used, for a cheap diff of two snapshots. */
function lifelineUsage(view: PublicQuizViewModel): Map<string, boolean> {
  const usage = new Map<string, boolean>()
  for (const score of view.playerScores) {
    for (const entry of score.lifelines ?? []) usage.set(`${score.playerId}:${entry.type}`, entry.used)
  }
  return usage
}

export function deriveQuizEvents(
  prev: PublicQuizViewModel | null,
  next: PublicQuizViewModel,
): QuizEvent[] {
  // Ohne Vorgaenger gibt es nichts zu vergleichen - und nichts zu melden. Ein
  // Ergebnis oder laufendes Spiel im allerersten Snapshot gehoert einer
  // frueheren Sitzung.
  if (!prev) return []

  const events: QuizEvent[] = []
  const prevInGame = !idleScenes.includes(prev.scene) && prev.scene !== 'result'
  const nextInGame = !idleScenes.includes(next.scene) && next.scene !== 'result'

  if (!prevInGame && nextInGame) events.push({ type: 'game-started' })

  // Neue Frage: Der Fortschrittszaehler wechselt, waehrend eine Frage sichtbar
  // ist - oder dieselbe Fragennummer wird nach dem Zwischenscreen sichtbar.
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

  /*
   * Lifelines: compared per player and type. A game that ends and a new one
   * that starts reset every entry to unused - which would look like a whole
   * row of restores. Hence the guard: only while the SAME game runs.
   */
  if (prevInGame && nextInGame && next.progress.total === prev.progress.total) {
    const before = lifelineUsage(prev)
    const after = lifelineUsage(next)
    for (const score of next.playerScores) {
      for (const type of lifelineTypes) {
        const key = `${score.playerId}:${type}`
        if (!after.has(key) || !before.has(key)) continue
        if (after.get(key) === before.get(key)) continue
        events.push({
          type: after.get(key) ? 'lifelineUsed' : 'lifelineRestored',
          playerId: score.playerId,
          lifelineType: type,
        })
      }
    }
  }

  // Zurueck zur Startszene mitten aus dem Spiel gibt es nur durch Abbruch.
  if (prevInGame && idleScenes.includes(next.scene)) events.push({ type: 'game-aborted' })

  return events
}
