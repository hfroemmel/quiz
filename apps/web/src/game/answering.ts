/**
 * Wer darf gerade was am Touchgeraet?
 *
 * Die Grundfrage - welcher Schritt der Befehlssequenz gerade moeglich ist -
 * beantwortet der Server ueber `allowedCommands`. Was dort nicht steht, ist die
 * Zuordnung zu EINEM Spieler, weil die Liste fuer das Spiel gilt und nicht je
 * Flaeche. Diese Zuordnung wird hier aus dem View-Modell abgelesen, nicht aus
 * Spielregeln abgeleitet:
 *
 *   `currentPlayer`  ist der Spieler, dem der offene Versuch gehoert - nach dem
 *                    Zuschlag genauso wie in der zweiten Chance;
 *   `locked`         hat der Server gesetzt, nachdem der Versuch verbraucht war.
 *
 * Verbindlich bleibt der Server: Ein trotzdem gesendeter Fingertipp wird dort
 * abgewiesen. Diese Funktionen entscheiden nur, welche Flaeche stumpf aussieht.
 */
import type { PlayerId, PlayerQuizViewModel } from '@hfroemmel/quiz-core'

/**
 * Wem gehoert der laufende Versuch?
 *
 * Der Server bestimmt ihn: nach einem angenommenen Buzz genauso wie in der
 * zweiten Chance. Im Einzelspiel gibt es niemanden, gegen den man sich melden
 * koennte - dort gehoert jede Frage dem einen Spieler, sobald der Server
 * Antworten annimmt.
 */
export function assignedPlayer(view: PlayerQuizViewModel): PlayerId | null {
  if (view.currentPlayer) return view.currentPlayer
  if (view.playerScores.length === 1) return view.playerScores[0]?.playerId ?? null
  return null
}

/** Darf dieser Spieler jetzt den Zuschlag holen? */
export function canBuzz(view: PlayerQuizViewModel, playerId: PlayerId): boolean {
  if (!view.allowedCommands.includes('BUZZ')) return false
  const score = view.playerScores.find((entry) => entry.playerId === playerId)
  return Boolean(score && !score.locked)
}

/** Darf dieser Spieler jetzt eine Antwort antippen? */
export function canAnswer(view: PlayerQuizViewModel, playerId: PlayerId): boolean {
  const score = view.playerScores.find((entry) => entry.playerId === playerId)
  if (!score || score.locked) return false

  // Ein offener Versuch nimmt Antworten an - aber nur von seinem Besitzer.
  if (view.allowedCommands.includes('LOG_OPTION_ANSWER')) return view.currentPlayer === playerId

  // Einzelspiel: Zuschlag und Einloggen fallen im selben Fingertipp.
  return view.playerScores.length === 1 && view.allowedCommands.includes('BUZZ')
}
