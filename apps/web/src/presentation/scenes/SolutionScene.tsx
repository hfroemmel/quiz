/**
 * Loesungsansicht (Spezifikation 13.2).
 *
 * Enthaelt die richtige Antwort, gegebenenfalls das zugehoerige Bild, die
 * aktualisierten Punktestaende und einen klaren Abschlusszustand. Der Moderator hat
 * jetzt Zeit zu sprechen - die App wechselt NICHT automatisch weiter.
 *
 * Alle hier sichtbaren Daten kommen aus `visibleSolution` bzw. `visibleOptions`, die
 * der Server ausschliesslich in dieser Szene mitsendet.
 */
import type { SceneProps } from './sceneProps.ts'

export function SolutionScene({ view }: SceneProps) {
  const solution = view.visibleSolution
  if (!solution) return null

  return (
    <div className="scene scene--solution">
      <p className="solution__label">Richtige Antwort</p>
      <h2 className="solution__answer">{solution.answerText}</h2>

      {solution.imageUrl && (
        <div className="solution__media">
          {/* Beim Bilderkennen ist das Bild jetzt vollstaendig scharf. */}
          <img src={solution.imageUrl} alt="" />
        </div>
      )}

      {view.visibleOptions && view.visibleOptions.length > 0 && (
        <ul className="option-grid option-grid--solution">
          {view.visibleOptions.map((option) => (
            <li key={option.id} className={`option-card ${option.state ? `option-card--${option.state}` : ''}`}>
              <span className="option-card__text">{option.text}</span>
            </li>
          ))}
        </ul>
      )}

      {solution.publicNote && <p className="solution__note">{solution.publicNote}</p>}
    </div>
  )
}
