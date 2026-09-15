/**
 * Pause and logo screen between two questions (spec 6.3).
 *
 * Deliberately free of any question or solution information: in this phase
 * the server has already drawn the next question, but does not send it to
 * the stage screen.
 */
import { textsFor } from '../texts'
import styles from './scenes.module.css'
import type { SceneProps } from './sceneProps'

export function PauseScene({ view }: SceneProps) {
  const t = textsFor(view)
  const logo = view.theme.startVisualUrl ?? view.theme.logoUrl
  return (
    <div className={`${styles.scene} ${styles.pause}`}>
      {/*
        * ONE BOX AROUND BOTH PIECES OF INFORMATION - but only where it
        * belongs.
        *
        * In the kids' world, counter and category sit together on a drawn
        * board; on the adults' stage everything stays as it was. The frame
        * is therefore ALWAYS in the markup and set to `display: contents`
        * there - it disappears from the layout instead of creating a second
        * arrangement (see stylesheet).
        */}
      <div className={styles.pauseCard} data-pause-card="">
        {view.progress.total > 0 && (
          <p className={styles.pauseProgress} data-pause-progress="">
            {t('stage.questionOf', {
              current: Math.min(view.progress.current, view.progress.total),
              total: view.progress.total,
            })}
          </p>
        )}
        {/*
          * The category arrives after the question number. It is the only
          * word of actual content on this screen - question text, options
          * and image stay with the server until the question scene.
          */}
        {view.upcomingCategoryLabel && (
          <p className={styles.pauseCategory} data-pause-category="">
            {view.upcomingCategoryLabel}
          </p>
        )}
      </div>
    </div>
  )
}
