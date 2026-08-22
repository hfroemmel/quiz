/**
 * Ergebnisansicht (Spezifikation 14.3).
 *
 * Der hoehere Punktestand gewinnt, bei Gleichstand erscheint "Unentschieden". Es gibt
 * bewusst keine manuelle Gewinnerauswahl und keine automatische Entscheidungsfrage.
 *
 * Im Einzelspiel gibt es weder Gewinner noch Unentschieden. Welche Fassung gilt,
 * entscheidet `result.mode` aus dem Server - nicht die Anzahl der Punktestaende.
 *
 * Pokal und Konfetti laufen nur bei einem Gewinner - beides ist reine Darstellung.
 * Korrigiert der Operator danach Punkte, berechnet der Server das Ergebnis
 * deterministisch neu und diese Ansicht folgt einfach dem neuen Snapshot.
 *
 * Die Ergebniskacheln stehen gespiegelt wie in der Kopfzeile: Spieler aussen,
 * Punkte innen. Sie zaehlen ebenfalls hoch - korrigiert der Operator hier noch
 * Punkte, ist die Aenderung dieselbe Bewegung wie im Spiel.
 */
import type { PublicResult } from '@quiz/contracts'
import { Confetti } from '../ui/Confetti.tsx'
import { AnimationClip } from '../ui/AnimationClip.tsx'
import { ScoreTile } from '../ScoreTile.tsx'
import { Tile } from '../ui/Tile.tsx'
import type { SceneProps } from './sceneProps.ts'

export function ResultScene({ view }: SceneProps) {
  const result = view.result
  if (!result) return null

  if (result.mode === 'solo') return <SoloResult result={result} />

  const winner = result.scores.find((score) => score.playerId === result.winnerPlayerId)
  const [playerOne, playerTwo] = result.scores

  return (
    <div className="scene scene--result">
      {!result.isDraw && <Confetti />}

      {!result.isDraw && (
        <div className="result__trophy">
          <AnimationClip clipId="trophy" restartKey={result.winnerPlayerId ?? 'none'} />
        </div>
      )}

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

/**
 * Einzelspiel: kein Pokal, kein Konfetti, kein Gegner - nur das eigene Ergebnis.
 *
 * Die Trefferzahl kommt aus dem Server; sie wird hier nicht aus den Punkten
 * zurueckgerechnet, weil eine richtige Antwort je nach Versuch verschieden viele
 * Punkte wert ist.
 */
function SoloResult({ result }: { result: PublicResult }) {
  const player = result.scores[0]

  return (
    <div className="scene scene--result scene--result-solo">
      <p className="result__label">Ergebnis</p>
      {result.solo && (
        <h2 className="result__winner">
          {result.solo.correctAnswers} von {result.solo.questionCount} richtig
        </h2>
      )}

      <div className="result__scores">
        {player && (
          <div className="result__group">
            <ScoreTile score={player.score} size="result" />
          </div>
        )}
      </div>
    </div>
  )
}
