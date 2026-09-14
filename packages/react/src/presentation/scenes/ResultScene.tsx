/**
 * Ergebnisansicht (Spezifikation 14.3).
 *
 * Der hoehere Punktestand gewinnt, bei Gleichstand erscheint "Unentschieden". Es gibt
 * bewusst keine manuelle Gewinnerauswahl und keine automatische Entscheidungsfrage.
 *
 * Im Einzelspiel gibt es weder Gewinner noch Unentschieden. Welche Fassung gilt,
 * entscheidet `result.mode` aus dem Server - nicht die Anzahl der Punktestaende.
 *
 * Konfetti laeuft nur bei einem Gewinner und ist reine Darstellung. Korrigiert der
 * Operator danach Punkte, berechnet der Server das Ergebnis deterministisch neu
 * und diese Ansicht folgt einfach dem neuen Snapshot.
 *
 * Die Ergebniskacheln stehen gespiegelt wie in der Kopfzeile: Spieler aussen,
 * Punkte innen. Sie zaehlen ebenfalls hoch - korrigiert der Operator hier noch
 * Punkte, ist die Aenderung dieselbe Bewegung wie im Spiel.
 */
import type { PublicResult } from '@hfroemmel/quiz-core'
import { Confetti } from '../../components/Confetti'
import { Score } from '../stage/Score'
import { textsFor } from '../texts'
import styles from './scenes.module.css'
import type { SceneProps } from './sceneProps'

export function ResultScene({ view }: SceneProps) {
  const t = textsFor(view)
  const result = view.result
  if (!result) return null

  if (result.mode === 'solo') return <SoloResult result={result} view={view} />

  const winner = result.scores.find((score) => score.playerId === result.winnerPlayerId)
  const [playerOne, playerTwo] = result.scores

  return (
    <div className={`${styles.scene} ${styles.result}`}>
      {!result.isDraw && <Confetti />}

      <p className={styles.resultLabel} data-result-label="">{t(result.isDraw ? 'result.draw' : 'result.winner')}</p>
      <h2 className={styles.resultWinner}>{result.isDraw ? t('result.drawHeadline') : t('result.winnerHeadline', { player: winner?.label ?? '' })}</h2>

      <div className={styles.resultScores}>
        {playerOne && <Score label={playerOne.label} score={playerOne.score} size="result" />}
        {playerTwo && <Score label={playerTwo.label} score={playerTwo.score} size="result" mirrored />}
      </div>
    </div>
  )
}

/**
 * Einzelspiel: kein Gewinner, kein Konfetti, kein Gegner - nur das eigene Ergebnis.
 *
 * Die Trefferzahl kommt aus dem Server; sie wird hier nicht aus den Punkten
 * zurueckgerechnet, weil eine richtige Antwort je nach Versuch verschieden viele
 * Punkte wert ist.
 */
function SoloResult({ result, view }: { result: PublicResult; view: SceneProps['view'] }) {
  const t = textsFor(view)
  const player = result.scores[0]

  return (
    <div className={`${styles.scene} ${styles.result}`}>
      <p className={styles.resultLabel} data-result-label="">
        {t('result.solo')}
      </p>
      {result.solo && (
        <h2 className={styles.resultWinner}>
          {t('result.soloHeadline', { correct: result.solo.correctAnswers, total: result.solo.questionCount })}
        </h2>
      )}

      <div className={styles.resultScores}>
        {player && <Score label={player.label} score={player.score} size="result" />}
      </div>
    </div>
  )
}
