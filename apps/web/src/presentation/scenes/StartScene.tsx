/**
 * Startbild des Buehnenscreens, solange kein Spiel laeuft.
 *
 * Zeigt ausschliesslich Branding. Modus- und Presetauswahl finden im Operatorfenster
 * statt und gehen den Saal nichts an.
 */
import type { SceneProps } from './sceneProps.ts'

export function StartScene({ view }: SceneProps) {
  const visual = view.theme.startVisualUrl ?? view.theme.logoUrl
  return (
    <div className="scene scene--start">
      {visual ? <img className="start__visual" src={visual} alt="" /> : <h1 className="start__title">Live-Quiz</h1>}
    </div>
  )
}
