/**
 * Head zone of a question: media and question board - ONE component for both
 * worlds.
 *
 * It looks the same in the question, reveal and solution scenes. That is why
 * it lives here once, instead of being repeated across three scenes.
 *
 * The category is the label of the first category and arrives ready-made
 * from the view model; the client looks nothing up.
 *
 * WHETHER AN IMAGE IS PRESENT is decided by the URL - not by whether an image
 * component was passed in. Otherwise a question with no photo would count as
 * illustrated, and the question board would get a column for nothing.
 */
import type { PublicQuestion } from '@hfroemmel/quiz-core'
import { Media } from './Media'
import { useFittedPrompt } from './useFittedPrompt'
import styles from './QuestionHead.module.css'

interface QuestionHeadProps {
  question: PublicQuestion
  /** Image URL; if missing, the question board runs the full width. */
  imageUrl?: string
  variant?: 'inline' | 'solution'
}

export function QuestionHead({ question, imageUrl, variant = 'inline' }: QuestionHeadProps) {
  // Long questions are shrunk until nothing sticks out of the scene any more.
  const promptRef = useFittedPrompt(question.prompt)

  return (
    <div className={`${styles.head} ${imageUrl ? styles.withMedia : styles.wide}`}>
      {imageUrl && <Media src={imageUrl} variant={variant} />}
      <div className={styles.panel} data-panel="">
        {question.categoryLabel && <p className={styles.category} data-category="">
            {question.categoryLabel}
          </p>}
        <h2 ref={promptRef} className={styles.prompt} data-prompt="">
          {question.prompt}
        </h2>
      </div>
    </div>
  )
}
