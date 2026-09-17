/**
 * Correct/incorrect feedback (spec 13.1).
 *
 * IMPORTANT: this scene NEVER shows the solution. After a wrong first
 * answer, the second chance follows, not the reveal - the server does not
 * even send the solution during this phase.
 *
 * THE MARK IS DRAWN, NOT FILMED (`AnswerResultAnimation`). It used to be a
 * delivered WebM clip per outcome; the drawing takes its colours from the
 * running theme, so the wrong answer is red on the red stage too and the
 * children's world gets its own green without a second file. How long the scene
 * stays visible is still decided solely by the server via its phase timer; this
 * component reports no `animationend` back.
 *
 * The score is deliberately NOT shown here: it counts up in the header's
 * score tile during this animation instead (a later design addition).
 */
import { AnswerResultAnimation } from '../../ui/AnswerResultAnimation'
import { textsFor } from '../texts'
import styles from './scenes.module.css'
import type { SceneProps } from './sceneProps'

export function FeedbackScene({ view }: SceneProps) {
  const t = textsFor(view)
  const feedback = view.feedback
  const correct = feedback?.outcome === 'correct'

  return (
    <div className={`${styles.scene} ${styles.feedback}`} data-outcome={correct ? 'correct' : 'incorrect'}>
      <div className={styles.feedbackSymbol}>
        <AnswerResultAnimation
          result={correct ? 'correct' : 'wrong'}
          // A new attempt by the same player restarts the animation.
          restartKey={`${feedback?.playerId ?? 'none'}-${feedback?.outcome ?? 'none'}-${view.revision}`}
        />
      </div>
      <p className={styles.feedbackLabel}>{t(correct ? 'feedback.correct' : 'feedback.incorrect')}</p>
    </div>
  )
}
