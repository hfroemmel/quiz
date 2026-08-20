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
import { Score } from '../stage/Score.tsx'
import styles from './scenes.module.css'
import type { SceneProps } from './sceneProps.ts'

export function ResultScene({ view }: SceneProps) {
  const result = view.result
  if (!result) return null

  const winner = result.scores.find((score) => score.playerId === result.winnerPlayerId)
  const [playerOne, playerTwo] = result.scores

  return (
    <div className={`${styles.scene} ${styles.result}`}>
      {!result.isDraw && <Confetti />}

      <p className={styles.resultLabel} data-result-label="">{result.isDraw ? 'Unentschieden' : 'Gewinner'}</p>
      <h2 className={styles.resultWinner}>{result.isDraw ? 'Unentschieden!' : `${winner?.label} hat gewonnen!`}</h2>

      <div className={styles.resultScores}>
        {playerOne && <Score label={playerOne.label} score={playerOne.score} size="result" />}
        {playerTwo && <Score label={playerTwo.label} score={playerTwo.score} size="result" mirrored />}
      </div>
    </div>
  )
}
