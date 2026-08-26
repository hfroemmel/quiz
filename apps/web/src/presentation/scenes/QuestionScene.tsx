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
 *
 * AM TOUCHGERAET SIND DIESELBEN ZEILEN SCHALTFLAECHEN. Sie stehen genau einmal
 * da; wer sie antippen darf, sagt `answering`. Eine eigene Liste je Spieler gab
 * es frueher - vier Antworten standen dann doppelt auf dem Tisch, und getippt
 * werden konnte nur auf einer der beiden Fassungen.
 */
import { answerRows } from '../stage/answerState'
import { QuestionComposition } from '../stage/QuestionComposition'
import styles from './scenes.module.css'
import type { SceneProps } from './sceneProps'

export function QuestionScene({ view, answering }: SceneProps) {
  const question = view.question
  if (!question) return null

  return (
    <div className={`${styles.scene} ${styles.question}`} data-fit-box="">
      <QuestionComposition
        question={question}
        imageUrl={question.imageUrl}
        rows={answerRows(view.visibleOptions ?? [], view.scene)}
        {...(answering ? { answering } : {})}
      />
    </div>
  )
}
