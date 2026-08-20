/**
 * Pausen- und Logoscreen zwischen zwei Fragen (Spezifikation 6.3).
 *
 * Bewusst ohne jede Fragen- oder Loesungsinformation: In dieser Phase hat der Server
 * die naechste Frage zwar bereits gezogen, sendet sie aber nicht an den Buehnenscreen.
 */
import styles from './scenes.module.css'
import type { SceneProps } from './sceneProps.ts'

export function PauseScene({ view }: SceneProps) {
  const logo = view.theme.startVisualUrl ?? view.theme.logoUrl
  return (
    <div className={`${styles.scene} ${styles.pause}`}>
      {logo ? <img className={styles.pauseLogo} src={logo} alt="" /> : <div className={styles.pausePlaceholder}>Quiz</div>}
      {view.progress.total > 0 && (
        <p className={styles.pauseProgress}>
          Frage {Math.min(view.progress.current, view.progress.total)} von {view.progress.total}
        </p>
      )}
      {/*
        * Die Rubrik kommt nach der Fragenummer herein. Sie ist das einzige
        * inhaltliche Wort auf diesem Screen - Fragetext, Optionen und Bild
        * bleiben bis zur Frageszene beim Server.
        */}
      {view.upcomingCategoryLabel && <p className={styles.pauseCategory}>{view.upcomingCategoryLabel}</p>}
    </div>
  )
}
