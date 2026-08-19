/**
 * Ergebnisansicht (Spezifikation 14.3).
 *
 * Der hoehere Punktestand gewinnt, bei Gleichstand erscheint "Unentschieden". Es gibt
 * bewusst keine manuelle Gewinnerauswahl und keine automatische Entscheidungsfrage.
 *
 * Konfetti laeuft nur bei einem Gewinner und ist reine Darstellung. Korrigiert der
 * Operator danach Punkte, berechnet der Server das Ergebnis deterministisch neu
 * und diese Ansicht folgt einfach dem neuen Snapshot.
 *
 * Die Ergebniskacheln stehen gespiegelt wie in der Kopfzeile: Spieler aussen,
 * Punkte innen. Sie zaehlen ebenfalls hoch - korrigiert der Operator hier noch
 * Punkte, ist die Aenderung dieselbe Bewegung wie im Spiel.
 */
import { Confetti } from '../../components/Confetti.tsx'
import { ScoreTile } from '../ScoreTile.tsx'
import { Tile } from '../../ui/Tile.tsx'
import type { SceneProps } from './sceneProps.ts'

export function ResultScene({ view }: SceneProps) {
  const result = view.result
  if (!result) return null

  const winner = result.scores.find((score) => score.playerId === result.winnerPlayerId)
  const [playerOne, playerTwo] = result.scores

  return (
    <div className="scene scene--result">
      {!result.isDraw && <Confetti />}

      <p className="result__label">{result.isDraw ? 'Unentschieden' : 'Gewinner'}</p>
      <h2 className="result__winner">{result.isDraw ? 'Unentschieden!' : `${winner?.label} hat gewonnen!`}</h2>

      <div className="result__scores">
        {playerOne && (
          <div className="result__group">
            <Tile label="Spieler" value={playerOne.label.replace(/\D+/g, '') || '1'} size="result" />
            <ScoreTile score={playerOne.score} size="result" />
          </div>
        )}
        {playerTwo && (
          <div className="result__group result__group--mirrored">
            <ScoreTile score={playerTwo.score} size="result" />
            <Tile label="Spieler" value={playerTwo.label.replace(/\D+/g, '') || '2'} size="result" />
          </div>
        )}
      </div>
    </div>
  )
}
