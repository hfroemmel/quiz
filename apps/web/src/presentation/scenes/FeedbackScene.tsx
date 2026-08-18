/**
 * Richtig-/Falsch-Feedback (Spezifikation 13.1).
 *
 * WICHTIG: Diese Szene zeigt NIE die Loesung. Nach einer falschen ersten Antwort
 * folgt die zweite Chance, nicht die Aufloesung - der Server sendet die Loesung in
 * dieser Phase gar nicht erst mit.
 *
 * Wie lange die Szene sichtbar bleibt, entscheidet der Server ueber seine
 * Fallbackzeit. Diese Komponente meldet kein `animationend` zurueck; der fachliche
 * Wechsel darf davon nicht abhaengen.
 */
import type { SceneProps } from './sceneProps.ts'

export function FeedbackScene({ view }: SceneProps) {
  const feedback = view.feedback
  const correct = feedback?.outcome === 'correct'
  const player = view.playerScores.find((score) => score.playerId === feedback?.playerId)

  return (
    <div className={`scene scene--feedback ${correct ? 'scene--feedback-correct' : 'scene--feedback-incorrect'}`}>
      <div className="feedback__symbol" aria-hidden="true">
        {correct ? '✓' : '✗'}
      </div>
      <p className="feedback__label">{correct ? 'Richtig' : 'Leider falsch'}</p>
      {player && <p className="feedback__player">{player.label}</p>}
      {correct && feedback && feedback.awardedPoints > 0 && (
        <p className="feedback__points">+{feedback.awardedPoints}</p>
      )}
    </div>
  )
}
