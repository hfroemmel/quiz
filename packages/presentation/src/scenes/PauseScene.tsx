/**
 * Pausen- und Logoscreen zwischen zwei Fragen (Spezifikation 6.3).
 *
 * Bewusst ohne jede Fragen- oder Loesungsinformation: In dieser Phase hat der Server
 * die naechste Frage zwar bereits gezogen, sendet sie aber nicht an den Buehnenscreen.
 */
import type { SceneProps } from './sceneProps.ts'

export function PauseScene({ view }: SceneProps) {
  const logo = view.theme.startVisualUrl ?? view.theme.logoUrl
  return (
    <div className="scene scene--pause">
      {logo ? <img className="pause__logo" src={logo} alt="" /> : <div className="pause__placeholder">Quiz</div>}
      {view.progress.total > 0 && (
        <p className="pause__progress">
          Frage {Math.min(view.progress.current, view.progress.total)} von {view.progress.total}
        </p>
      )}
    </div>
  )
}
