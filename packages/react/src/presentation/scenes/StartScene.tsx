/**
 * Start screen of the stage as long as no game is running.
 *
 * Shows branding only. Mode and preset selection happen in the operator's
 * window and are none of the room's business.
 *
 * The title comes from the mode (`startTitle`). It is omitted when the start
 * artwork already contains it - as with the kids' quiz.
 */
import styles from './scenes.module.css'
import type { SceneProps } from './sceneProps'

export function StartScene({ view }: SceneProps) {
  const visual = view.theme.startVisualUrl ?? view.theme.logoUrl
  return (
    <div className={`${styles.scene} ${styles.start}`}>
      {visual && <img className={styles.startVisual} src={visual} alt="" />}
      {view.theme.startTitle && <h1 className={styles.startTitle}>{view.theme.startTitle}</h1>}
    </div>
  )
}
