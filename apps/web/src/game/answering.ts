/**
 * Wer darf gerade antworten?
 *
 * Die Grundfrage - ist Antworten ueberhaupt moeglich - beantwortet der Server ueber
 * `allowedCommands`. Was dort nicht steht, ist die Zuordnung zu EINEM Spieler, weil
 * die Liste fuer das Spiel gilt und nicht je Flaeche. Diese Zuordnung wird hier aus
 * dem View-Modell abgelesen, nicht aus Spielregeln abgeleitet:
 *
 *   `locked`         hat der Server gesetzt, nachdem der Versuch verbraucht war;
 *   `currentPlayer`  ist in der zweiten Chance der Spieler, dem sie gehoert.
 *
 * Verbindlich bleibt der Server: Ein trotzdem gesendeter Fingertipp wird dort
 * abgewiesen. Diese Funktion entscheidet nur, welche Flaeche stumpf aussieht.
 */
import type { PlayerId, PlayerQuizViewModel } from '@quiz/contracts'

export function canAnswer(view: PlayerQuizViewModel, playerId: PlayerId): boolean {
  if (!view.allowedCommands.includes('ANSWER_BY_PLAYER')) return false

  const score = view.playerScores.find((entry) => entry.playerId === playerId)
  if (!score || score.locked) return false

  // Die zweite Chance gehoert genau einem Spieler; der andere wartet.
  if (view.phase === 'second-chance') return view.currentPlayer === playerId

  return true
}
