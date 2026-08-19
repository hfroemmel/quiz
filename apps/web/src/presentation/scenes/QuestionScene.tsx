/**
 * Frageszene fuer Text- und bildgestuetztes Multiple Choice.
 *
 * "Politiker erkennen" ist hier kein Sonderfall: Es ist eine Multiple-Choice-Frage
 * mit verpflichtendem Bild und laeuft durch genau dieselbe Darstellung.
 *
 * Aufbau nach Entwurf:
 *   mit Bild   Bild links, Rubrik und Frage rechts daneben
 *   ohne Bild  Rubrik und Frage ueber die volle Breite
 *   darunter   die Antwortleisten, jeweils ueber die volle Breite
 *
 * Die Optionsreihenfolge kommt vom Server (pro Spiel gemischt); der Client sortiert
 * nichts um. Sie erscheinen erst, wenn der Server sie mitsendet - also nach
 * "Starten". Der Zustand einer Option kommt ebenfalls vom Server.
 */
import { presentationTiming } from '../animationPresets.ts'
import { MediaFrame } from '../../ui/MediaFrame.tsx'
import { OptionBar, optionLetter } from '../../ui/OptionBar.tsx'
import { QuestionHead } from './QuestionHead.tsx'
import type { SceneProps } from './sceneProps.ts'

export function QuestionScene({ view }: SceneProps) {
  const question = view.question
  if (!question) return null
  const options = view.visibleOptions ?? []

  return (
    <div className={`scene scene--question ${question.imageUrl ? 'scene--question-with-image' : ''}`}>
      <QuestionHead question={question} media={<MediaFrame src={question.imageUrl} />} />

      {view.secondChance && (
        <p className="scene__hint">Zweite Chance · {view.secondChance.pointsIfCorrect} Punkte</p>
      )}

      {options.length > 0 && (
        <ul className="option-list">
          {options.map((option, index) => (
            <li key={option.id}>
              <OptionBar
                letter={optionLetter(index)}
                text={option.text}
                tone={
                  option.state === 'correct'
                    ? 'solution'
                    : option.state === 'chosen' || option.state === 'chosen-incorrect'
                      ? 'chosen'
                      : 'neutral'
                }
                delayMs={index * presentationTiming.optionStaggerMs}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
