/**
 * Ergebnisansicht (Spezifikation 14.3).
 *
 * Der hoehere Punktestand gewinnt, bei Gleichstand erscheint "Unentschieden". Es gibt
 * bewusst keine manuelle Gewinnerauswahl und keine automatische Entscheidungsfrage.
 *
 * Konfetti laeuft nur bei einem Gewinner - und ist reine Darstellung. Korrigiert der
 * Operator danach Punkte, berechnet der Server das Ergebnis deterministisch neu und
 * diese Ansicht folgt einfach dem neuen Snapshot.
 */
import { Confetti } from '../../components/Confetti.tsx'
import type { SceneProps } from './sceneProps.ts'

export function ResultScene({ view }: SceneProps) {
  const result = view.result
  if (!result) return null

  return (
    <div className="scene scene--result">
      {!result.isDraw && <Confetti />}
      <p className="result__label">{result.isDraw ? 'Unentschieden' : 'Gewinner'}</p>

      {!result.isDraw && (
        <h2 className="result__winner">
          {result.scores.find((score) => score.playerId === result.winnerPlayerId)?.label}
        </h2>
      )}

      <div className="result__scores">
        {result.scores.map((score) => (
          <div
            key={score.playerId}
            className={`result__score ${score.playerId === result.winnerPlayerId ? 'result__score--winner' : ''}`}
          >
            <span className="result__score-label">{score.label}</span>
            <span className="result__score-value">{score.score}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
