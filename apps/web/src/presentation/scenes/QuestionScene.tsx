/**
 * Frageszene fuer Text- und bildgestuetztes Multiple Choice.
 *
 * "Politiker erkennen" ist hier kein Sonderfall: Es ist eine Multiple-Choice-Frage
 * mit verpflichtendem Bild und laeuft durch genau dieselbe Darstellung.
 *
 * Aufbau nach Entwurf:
 *   mit Bild   Bild links, Rubrik und Frage rechts daneben
 *   ohne Bild  Rubrik und Frage ueber die volle Breite
 *   darunter   die Antwortzeilen
 *
 * Die Optionsreihenfolge kommt vom Server (pro Spiel gemischt); der Client sortiert
 * nichts um. Sie erscheinen erst, wenn der Server sie mitsendet - also nach
 * "Starten". Der Zustand einer Option kommt ebenfalls vom Server.
 */
import { AnswerList } from '../stage/AnswerList.tsx'
import { answerState, optionLetter } from '../stage/answerState.ts'
import { QuestionHead } from '../stage/QuestionHead.tsx'
import { SecondChanceHint } from '../stage/SecondChanceHint.tsx'
import styles from './scenes.module.css'
import type { SceneProps } from './sceneProps.ts'

export function QuestionScene({ view }: SceneProps) {
  const question = view.question
  if (!question) return null
  const options = view.visibleOptions ?? []

  return (
    <div className={`${styles.scene} ${styles.question}`}>
      <QuestionHead question={question} imageUrl={question.imageUrl} />

      {view.secondChance && <SecondChanceHint points={view.secondChance.pointsIfCorrect} />}

      <AnswerList
        rows={options.map((option, index) => ({
          id: option.id,
          letter: optionLetter(index),
          text: option.text,
          state: answerState(option, view.scene),
        }))}
      />
    </div>
  )
}
