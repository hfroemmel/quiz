/**
 * Correct/incorrect feedback (spec 13.1).
 *
 * IMPORTANT: this scene NEVER shows the solution. After a wrong first
 * answer, the second chance follows, not the reveal - the server does not
 * even send the solution during this phase.
 *
 * The motion comes from the supplied animated graphics `correct` and `wrong`
 * (see `animationAssets.ts`), not from shapes drawn in code. How long the
 * scene stays visible is decided solely by the server via its fallback
 * timer; this component does not report any `animationend` back.
 *
 * The score is deliberately NOT shown here: it counts up in the header's
 * score tile during this animation instead (a later design addition).
 */
import { AnimationClip } from '../../ui/AnimationClip'
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
        <AnimationClip
          clipId={correct ? 'correct' : 'wrong'}
          // A new attempt by the same player restarts the animation.
          restartKey={`${feedback?.playerId ?? 'none'}-${feedback?.outcome ?? 'none'}-${view.revision}`}
        />
      </div>
      <p className={styles.feedbackLabel}>{t(correct ? 'feedback.correct' : 'feedback.incorrect')}</p>
    </div>
  )
}
