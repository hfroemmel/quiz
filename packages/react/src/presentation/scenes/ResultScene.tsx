/**
 * Result view (spec 14.3).
 *
 * The higher score wins; on a tie, "Unentschieden" appears. There is
 * deliberately no manual winner selection and no automatic tie-breaker
 * question.
 *
 * In single-player games there is neither a winner nor a tie. Which version
 * applies is decided by `result.mode` from the server - not by the number of
 * scores.
 *
 * Confetti only runs for a winner and is purely decorative. If the operator
 * corrects scores afterward, the server deterministically recomputes the
 * result and this view simply follows the new snapshot.
 *
 * The result tiles are mirrored like in the header: player on the outside,
 * score on the inside. They also count up - if the operator still corrects
 * scores here, the change is the same motion as in the game.
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
 * Single-player game: no winner, no confetti, no opponent - just one's own
 * result.
 *
 * The number of correct answers comes from the server; it is not
 * back-computed here from the score, because a correct answer is worth a
 * different number of points depending on the attempt.
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
