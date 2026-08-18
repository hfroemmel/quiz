/**
 * Punkteregeln (Spezifikation 14).
 *
 * DRY-Regel: Scoring existiert ausschliesslich hier. Weder Operator- noch
 * Moderatorclient noch Persistenz berechnen Punkte selbst.
 */
import { scoringRules, type AnswerAttempt, type GameState, type PlayerId } from '@quiz/contracts'

/**
 * Punkte fuer eine richtige Antwort.
 *
 * Beide bestaetigten Faelle folgen derselben Regel und brauchen deshalb keinen
 * Sonderfall pro Fragetyp:
 *  - normale Frage: erste Antwort 100, zweite Chance 50;
 *  - Bilderkennen: ohne vorherigen Fehlversuch 100, sonst 50.
 *
 * Weitere Fehlversuche senken die Punktzahl nicht weiter, falsche Antworten
 * geben nie Abzug.
 */
export function pointsForCorrectAnswer(previousFailedAttempts: number): number {
  return previousFailedAttempts === 0 ? scoringRules.firstAnswerPoints : scoringRules.secondChancePoints
}

/** Anzahl bereits falsch beantworteter Versuche der aktuellen Frage. */
export function countFailedAttemptsForCurrentQuestion(state: GameState): number {
  const questionId = state.currentQuestion?.question.id
  if (!questionId) return 0
  return state.attempts.filter(
    (attempt) =>
      attempt.questionId === questionId &&
      attempt.slotIndex === state.currentSlotIndex &&
      attempt.outcome === 'incorrect',
  ).length
}

/** Alle Versuche der aktuell laufenden Frage, in Reihenfolge ihrer Entstehung. */
export function attemptsForCurrentQuestion(state: GameState): AnswerAttempt[] {
  const questionId = state.currentQuestion?.question.id
  if (!questionId) return []
  return state.attempts.filter(
    (attempt) => attempt.questionId === questionId && attempt.slotIndex === state.currentSlotIndex,
  )
}

/** Der noch nicht ausgewertete Versuch, falls vorhanden. */
export function pendingAttempt(state: GameState): AnswerAttempt | undefined {
  return attemptsForCurrentQuestion(state).find((attempt) => attempt.outcome === undefined)
}

/**
 * Punktestand aendern. Der Stand faellt standardmaessig nicht unter null.
 * Rueckgabe enthaelt den tatsaechlich gebuchten Delta-Wert, damit das Auditlog
 * nicht behauptet, es seien 100 Punkte abgezogen worden, obwohl bei 0 gedeckelt wurde.
 */
export function applyScoreDelta(currentScore: number, delta: number): { score: number; effectiveDelta: number } {
  const raw = currentScore + delta
  const score = Math.max(scoringRules.minimumScore, raw)
  return { score, effectiveDelta: score - currentScore }
}

/** Ergebnis eines abgeschlossenen Spiels. Deterministisch aus den Punktestaenden. */
export function determineResult(state: GameState): { winnerPlayerId: PlayerId | null; isDraw: boolean } {
  const [first, second] = state.players
  if (first.score === second.score) return { winnerPlayerId: null, isDraw: true }
  return { winnerPlayerId: first.score > second.score ? first.id : second.id, isDraw: false }
}
