/**
 * Loesungsansicht (Spezifikation 13.2).
 *
 * Enthaelt die richtige Antwort, gegebenenfalls das zugehoerige Bild und einen
 * klaren Abschlusszustand. Der Moderator hat jetzt Zeit zu sprechen - die App
 * wechselt NICHT automatisch weiter.
 *
 * Aufbau: dieselbe Komposition wie die Frage, dazwischen die Zeile
 * "Richtige Antwort:". Bei Auswahlfragen stehen alle Optionen in der Reihenfolge
 * des Servers, und nur die richtige traegt Farbe; bei freien Antworten steht
 * eine einzelne Zeile ohne Buchstaben.
 *
 * WO DIE RICHTIGE ZEILE STEHT, ist Sache der Gestaltungswelt: Die Buehne der
 * Erwachsenen zieht sie im Stylesheet nach oben, die Kinderwelt laesst sie an
 * ihrem Platz. Das Markup ist in beiden Faellen dasselbe.
 *
 * Alle hier sichtbaren Daten kommen aus `visibleSolution` bzw. `visibleOptions`, die
 * der Server ausschliesslich in dieser Szene mitsendet.
 */
import { answerRows } from '../stage/answerState.ts'
import { QuestionComposition } from '../stage/QuestionComposition.tsx'
import type { AnswerRow } from '../stage/AnswerList.tsx'
import styles from './scenes.module.css'
import type { SceneProps } from './sceneProps.ts'

export function SolutionScene({ view }: SceneProps) {
  const solution = view.visibleSolution
  const question = view.question
  if (!solution || !question) return null

  const options = view.visibleOptions ?? []
  const rows: AnswerRow[] =
    options.length > 0
      ? answerRows(options, view.scene)
      : // Freie Antwort - etwa beim Bilderkennen: eine Zeile, kein Buchstabe.
        [{ id: 'solution', text: solution.answerText, state: 'correct' }]

  return (
    <div className={`${styles.scene} ${styles.solution}`} data-fit-box="">
      <QuestionComposition
        question={question}
        imageUrl={solution.imageUrl ?? question.imageUrl}
        mediaVariant="solution"
        rows={rows}
      >
        <p className={styles.solutionLabel} data-solution-label="">
          Richtige Antwort:
        </p>
      </QuestionComposition>
    </div>
  )
}
