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
 * AM TOUCHGERAET STEHEN DIE ANTWORTEN NICHT HIER. Dort sind sie die
 * Antwortleisten der Spieler - einmal je Tischseite und als Schaltflaechen.
 * Zeigte die Szene sie zusaetzlich, staenden dieselben vier Antworten doppelt
 * auf dem Tisch, und getippt werden koennte nur auf einer der beiden Fassungen.
 */
import { answerRows } from '../stage/answerState.ts'
import { touchAnswers } from './sceneProps.ts'
import { QuestionComposition } from '../stage/QuestionComposition.tsx'
import styles from './scenes.module.css'
import type { SceneProps } from './sceneProps.ts'

export function QuestionScene({ view, variant }: SceneProps) {
  const question = view.question
  if (!question) return null

  return (
    <div className={`${styles.scene} ${styles.question}`} data-fit-box="">
      <QuestionComposition
        question={question}
        imageUrl={question.imageUrl}
        rows={touchAnswers(variant) ? [] : answerRows(view.visibleOptions ?? [], view.scene)}
      />
    </div>
  )
}
