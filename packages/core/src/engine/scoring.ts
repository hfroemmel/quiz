/**
 * Punkteregeln (Spezifikation 14).
 *
 * DRY-Regel: Scoring existiert ausschliesslich hier. Weder Operator- noch
 * Moderatorclient noch Persistenz berechnen Punkte selbst.
 */
import { scoringRules, type AnswerAttempt, type GameState, type PlayerId } from '../contracts'

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

export interface GameResult {
  mode: 'duel' | 'solo'
  winnerPlayerId: PlayerId | null
  isDraw: boolean
  solo?: { correctAnswers: number; questionCount: number }
}

/**
 * Ergebnis eines abgeschlossenen Spiels. Deterministisch aus dem Zustand.
 *
 * Im Duell gewinnt der hoehere Punktestand, bei Gleichstand gibt es ein
 * Unentschieden. Im Einzelspiel gibt es beides nicht: dort zaehlt der eigene
 * Punktestand und wie viele Fragen richtig beantwortet wurden.
 */
export function determineResult(state: GameState): GameResult {
  const [first, second] = state.players
  if (!second) {
    return {
      mode: 'solo',
      winnerPlayerId: null,
      isDraw: false,
      solo: { correctAnswers: countCorrectAnswers(state), questionCount: countPlayedQuestions(state) },
    }
  }
  if (!first) return { mode: 'duel', winnerPlayerId: null, isDraw: true }
  if (first.score === second.score) return { mode: 'duel', winnerPlayerId: null, isDraw: true }
  return { mode: 'duel', winnerPlayerId: first.score > second.score ? first.id : second.id, isDraw: false }
}

/**
 * Richtig beantwortete Fragen - nicht richtige Versuche.
 *
 * Der Unterschied ist beim Bilderkennen sichtbar: Dort sind mehrere Versuche je
 * Frage erlaubt, richtig ist eine Frage aber trotzdem nur einmal.
 */
function countCorrectAnswers(state: GameState): number {
  return countSlots(state, (attempt) => attempt.outcome === 'correct')
}

/**
 * Tatsaechlich gestellte Fragen - nicht die Zahl der Fragenplaetze. Beides faellt
 * auseinander, wenn ein Fragenplatz uebersprungen wurde.
 */
function countPlayedQuestions(state: GameState): number {
  return countSlots(state, () => true)
}

/** Anzahl der Fragenplaetze, auf die ein passender Versuch entfaellt. */
function countSlots(state: GameState, matches: (attempt: AnswerAttempt) => boolean): number {
  const slots = new Set<number>()
  for (const attempt of state.attempts) {
    if (matches(attempt)) slots.add(attempt.slotIndex)
  }
  return slots.size
}
