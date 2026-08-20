/**
 * Loesungsansicht (Spezifikation 13.2).
 *
 * Enthaelt die richtige Antwort, gegebenenfalls das zugehoerige Bild und einen
 * klaren Abschlusszustand. Der Moderator hat jetzt Zeit zu sprechen - die App
 * wechselt NICHT automatisch weiter.
 *
 * Aufbau: Kopfzone wie in der Frage, darunter die Zeile "Richtige Antwort:" und
 * die Antwortzeilen. Bei Auswahlfragen stehen alle Optionen in der Reihenfolge
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
import { AnswerList, type AnswerRow } from '../stage/AnswerList.tsx'
import { answerState, optionLetter } from '../stage/answerState.ts'
import { QuestionHead } from '../stage/QuestionHead.tsx'
import styles from './scenes.module.css'
import type { SceneProps } from './sceneProps.ts'

export function SolutionScene({ view }: SceneProps) {
  const solution = view.visibleSolution
  if (!solution) return null

  const options = view.visibleOptions ?? []
  const rows: AnswerRow[] =
    options.length > 0
      ? options.map((option, index) => ({
          id: option.id,
          letter: optionLetter(index),
          text: option.text,
          state: answerState(option, view.scene),
        }))
      : // Freie Antwort - etwa beim Bilderkennen: eine Zeile, kein Buchstabe.
        [{ id: 'solution', text: solution.answerText, state: 'correct' }]

  return (
    <div className={`${styles.scene} ${styles.solution}`}>
      {view.question && (
        <QuestionHead
          question={view.question}
          imageUrl={solution.imageUrl ?? view.question.imageUrl}
          variant="solution"
        />
      )}

      <p className={styles.solutionLabel} data-solution-label="">
        Richtige Antwort:
      </p>
      <AnswerList rows={rows} />
    </div>
  )
}
