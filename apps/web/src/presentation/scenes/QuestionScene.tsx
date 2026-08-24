/**
 * Frageszene fuer Text- und bildgestuetztes Multiple Choice.
 *
 * Aufbau nach Entwurf:
 *   mit Bild     Bild links, Rubrik und Frage rechts daneben, Antworten darunter
 *   ohne Bild    Rubrik und Frage ueber die volle Breite
 *   `person`     das Portraet gross links, alles andere rechts daneben
 *
 * Welche Anordnung gilt, entscheidet `QuestionComposition` anhand des Fragetyps -
 * diese Szene kennt den Unterschied nicht.
 *
 * Die Optionsreihenfolge kommt vom Server (pro Spiel gemischt); der Client sortiert
 * nichts um. Sie erscheinen erst, wenn der Server sie mitsendet - also nach
 * "Starten". Der Zustand einer Option kommt ebenfalls vom Server.
 */
import { answerRows } from '../stage/answerState.ts'
import { QuestionComposition } from '../stage/QuestionComposition.tsx'
import { SecondChanceHint } from '../stage/SecondChanceHint.tsx'
import styles from './scenes.module.css'
import type { SceneProps } from './sceneProps.ts'

export function QuestionScene({ view }: SceneProps) {
  const question = view.question
  if (!question) return null

  return (
    <div className={`${styles.scene} ${styles.question}`} data-fit-box="">
      <QuestionComposition
        question={question}
        imageUrl={question.imageUrl}
        rows={answerRows(view.visibleOptions ?? [], view.scene)}
      >
        {view.secondChance && <SecondChanceHint points={view.secondChance.pointsIfCorrect} />}
      </QuestionComposition>
    </div>
  )
}
