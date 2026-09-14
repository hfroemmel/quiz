/**
 * Solution view (spec 13.2).
 *
 * Contains the correct answer, its associated image where applicable, and a
 * clear closing state. The host now has time to speak - the app does NOT
 * move on automatically.
 *
 * Structure: the same composition as the question, with the "Richtige
 * Antwort:" line in between. For multiple-choice questions, all options
 * appear in the server's order, and only the correct one carries colour; for
 * free-text answers there is a single row with no letter.
 *
 * WHERE THE CORRECT ROW SITS is a matter for the design world: the adults'
 * stage moves it up in the stylesheet, the kids' world leaves it in place.
 * The markup is the same in both cases.
 *
 * All the data visible here comes from `visibleSolution` and
 * `visibleOptions`, which the server sends only in this scene.
 */
import { answerRows } from '../stage/answerState'
import { QuestionComposition } from '../stage/QuestionComposition'
import type { AnswerRow } from '../stage/AnswerList'
import styles from './scenes.module.css'
import type { SceneProps } from './sceneProps'

export function SolutionScene({ view }: SceneProps) {
  const solution = view.visibleSolution
  const question = view.question
  if (!solution || !question) return null

  const options = view.visibleOptions ?? []
  const rows: AnswerRow[] =
    options.length > 0
      ? answerRows(options, view.scene)
      : // Free-text answer - as with image guessing: one row, no letter.
        [{ id: 'solution', text: solution.answerText, state: 'correct' }]

  return (
    <div className={`${styles.scene} ${styles.solution}`} data-fit-box="">
      <QuestionComposition
        question={question}
        imageUrl={solution.imageUrl ?? question.imageUrl}
        mediaVariant="solution"
        rows={rows}
      >
      </QuestionComposition>
    </div>
  )
}
