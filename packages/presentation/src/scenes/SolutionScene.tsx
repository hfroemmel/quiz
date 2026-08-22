/**
 * Loesungsansicht (Spezifikation 13.2).
 *
 * Enthaelt die richtige Antwort, gegebenenfalls das zugehoerige Bild und einen
 * klaren Abschlusszustand. Der Moderator hat jetzt Zeit zu sprechen - die App
 * wechselt NICHT automatisch weiter.
 *
 * Aufbau nach Entwurf: Kopfzone wie in der Frage, darunter die Zeile
 * "Richtige Antwort:" und der Loesungsbalken ueber die volle Breite. Bei
 * Auswahlfragen traegt er den Buchstaben der richtigen Option, bei freien
 * Antworten steht er ohne Chip.
 *
 * Alle hier sichtbaren Daten kommen aus `visibleSolution` bzw. `visibleOptions`, die
 * der Server ausschliesslich in dieser Szene mitsendet.
 */
import { MediaFrame } from '../ui/MediaFrame.tsx'
import { OptionBar, optionLetter } from '../ui/OptionBar.tsx'
import { QuestionHead } from './QuestionHead.tsx'
import type { SceneProps } from './sceneProps.ts'

export function SolutionScene({ view, variant }: SceneProps) {
  const solution = view.visibleSolution
  if (!solution) return null

  const options = view.visibleOptions ?? []
  const correctIndex = options.findIndex((option) => option.state === 'correct')
  // Die richtige Antwort steht auch am Touchgeraet gross auf der Flaeche. Die
  // uebrigen Optionen nicht: Sie liegen dort bereits als Schaltflaechen, dort
  // sogar mit demselben Zustand.
  const remaining = variant === 'touch' ? [] : options.filter((option) => option.state !== 'correct')

  return (
    <div className="scene scene--solution">
      {view.question && (
        <QuestionHead
          question={view.question}
          media={<MediaFrame src={solution.imageUrl ?? view.question.imageUrl} variant="solution" />}
        />
      )}

      <p className="solution__label">Richtige Antwort:</p>
      <div className="solution__answer">
        <OptionBar
          letter={correctIndex >= 0 ? optionLetter(correctIndex) : undefined}
          text={solution.answerText}
          tone="solution"
        />
      </div>

      {remaining.length > 0 && (
        <ul className="option-list option-list--solution">
          {remaining.map((option) => (
            <li key={option.id}>
              {/*
                * Eine falsch gewaehlte Antwort bleibt als solche erkennbar: Der
                * Saal hat sie vorher blau gesehen und soll den Vergleich ziehen
                * koennen. Alle uebrigen Optionen treten zurueck.
                */}
              <OptionBar
                letter={optionLetter(options.indexOf(option))}
                text={option.text}
                tone={option.state === 'chosen-incorrect' ? 'chosen' : 'muted'}
              />
            </li>
          ))}
        </ul>
      )}

      {solution.publicNote && <p className="solution__note">{solution.publicNote}</p>}
    </div>
  )
}
