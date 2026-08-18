/**
 * Frageszene fuer Text- und bildgestuetztes Multiple Choice.
 *
 * "Politiker erkennen" ist hier kein Sonderfall: Es ist eine Multiple-Choice-Frage
 * mit verpflichtendem Bild und laeuft durch genau dieselbe Darstellung.
 *
 * Die Optionsreihenfolge kommt vom Server (pro Spiel gemischt); der Client sortiert
 * nichts um. Der Zustand einer Option (richtig / falsch genannt) wird erst in der
 * Loesungsszene mitgeliefert.
 */
import { presentationTiming } from '../animationPresets.ts'
import { PlayerBadge } from '../../components/PlayerBadge.tsx'
import type { SceneProps } from './sceneProps.ts'

export function QuestionScene({ view }: SceneProps) {
  const question = view.question
  if (!question) return null
  const hasImage = Boolean(question.imageUrl)

  return (
    <div className={`scene scene--question ${hasImage ? 'scene--question-with-image' : ''}`}>
      <h2 className="question-prompt">{question.prompt}</h2>

      {hasImage && (
        <div className="question__media">
          <img src={question.imageUrl} alt="" />
        </div>
      )}

      {view.visibleOptions && view.visibleOptions.length > 0 && (
        <ul className="option-grid">
          {view.visibleOptions.map((option, index) => (
            <li
              key={option.id}
              className={`option-card ${option.state ? `option-card--${option.state}` : ''}`}
              // Versatz der Einlaufanimation - zentral konfiguriert, keine Zahl im JSX.
              style={{ animationDelay: `${index * presentationTiming.optionStaggerMs}ms` }}
            >
              <span className="option-card__marker">{String.fromCharCode(65 + index)}</span>
              <span className="option-card__text">{option.text}</span>
            </li>
          ))}
        </ul>
      )}

      {view.currentPlayer && (
        <div className="question__active-player">
          <PlayerBadge scores={view.playerScores} playerId={view.currentPlayer} />
          <span>{view.phase === 'second-chance' ? 'hat die zweite Chance' : 'ist am Zug'}</span>
        </div>
      )}
    </div>
  )
}
