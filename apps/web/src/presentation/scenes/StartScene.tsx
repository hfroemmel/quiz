/**
 * Startbild des Buehnenscreens, solange kein Spiel laeuft.
 *
 * Zeigt ausschliesslich Branding. Modus- und Presetauswahl finden im Operatorfenster
 * statt und gehen den Saal nichts an.
 *
 * Der Titel kommt aus dem Modus (`startTitle`). Er entfaellt, wenn die
 * Startgrafik ihn bereits enthaelt - so wie beim Kinderquiz.
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
