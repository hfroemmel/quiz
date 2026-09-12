/**
 * Pausen- und Logoscreen zwischen zwei Fragen (Spezifikation 6.3).
 *
 * Bewusst ohne jede Fragen- oder Loesungsinformation: In dieser Phase hat der Server
 * die naechste Frage zwar bereits gezogen, sendet sie aber nicht an den Buehnenscreen.
 */
import { texteFuer } from '../texts'
import styles from './scenes.module.css'
import type { SceneProps } from './sceneProps'

export function PauseScene({ view }: SceneProps) {
  const t = texteFuer(view)
  const logo = view.theme.startVisualUrl ?? view.theme.logoUrl
  return (
    <div className={`${styles.scene} ${styles.pause}`}>
      {/*
        * EIN KASTEN UM BEIDE ANGABEN - aber nur dort, wo er hingehoert.
        *
        * In der Kinderwelt stehen Zaehler und Rubrik gemeinsam auf einer
        * gezeichneten Tafel; in der Buehne der Erwachsenen bleibt alles, wie es
        * war. Der Rahmen steht deshalb IMMER im Markup und ist dort auf
        * `display: contents` gesetzt - er verschwindet aus dem Layout, statt
        * eine zweite Anordnung zu erzeugen (siehe Stylesheet).
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
          * Die Rubrik kommt nach der Fragenummer herein. Sie ist das einzige
          * inhaltliche Wort auf diesem Screen - Fragetext, Optionen und Bild
          * bleiben bis zur Frageszene beim Server.
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
