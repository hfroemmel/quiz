/**
 * Question scene for text-based and image-based multiple choice.
 *
 * Layout by design:
 *   with image     image on the left, category and question beside it,
 *                  answers below
 *   without image  category and question span the full width
 *   `person`       the portrait large on the left, everything else beside it
 *
 * Which layout applies is decided by `QuestionComposition` based on the
 * question type - this scene does not know the difference.
 *
 * The option order comes from the server (shuffled per game); the client
 * does not re-sort anything. They only appear once the server sends them -
 * i.e. after "Starten". An option's state likewise comes from the server.
 *
 * ON THE TOUCH DEVICE THE SAME ROWS ARE BUTTONS. They exist exactly once;
 * `answering` says who is allowed to tap them. There used to be a separate
 * list per player - four answers then sat on the table twice, and tapping
 * only worked on one of the two versions.
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
