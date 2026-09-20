/**
 * Composition of a question view: media, question board, answer rows.
 *
 * The question and solution scenes show the same parts in the same
 * arrangement; they differ only in what sits between question and answers
 * (the second-chance hint, or the "Richtige Antwort:" label). This spot is
 * therefore a child slot.
 *
 * TWO LAYOUTS, ONE DECISION:
 *
 *   default    image on the left, category and question beside it, answers
 *              below
 *   `person`   the portrait IS the question: large on the left, everything
 *              else on the right
 *
 * Which one applies is stored in the server's question type - read here in
 * exactly one place, so the question and the solution never drift apart.
 */
import type { ReactNode } from 'react'
import type { PublicQuestion } from '@hfroemmel/quiz-core'
import { AnswerList, type AnswerRow } from './AnswerList'
import { Media } from './Media'
import { QuestionHead } from './QuestionHead'
import styles from './QuestionComposition.module.css'
import type { SceneAnswering } from '../scenes/sceneProps'

interface QuestionCompositionProps {
  question: PublicQuestion
  /** Image URL; in the solution it can differ from the question's. */
  imageUrl?: string
  /** Licence line of THAT picture - it travels with the url. */
  imageCredit?: string
  mediaVariant?: 'inline' | 'solution'
  rows: AnswerRow[]
  /** Touch device only: turns the rows into buttons. */
  answering?: SceneAnswering
  /** Sits between question and answers. */
  children?: ReactNode
}

export function QuestionComposition({
  question,
  imageUrl,
  imageCredit,
  mediaVariant = 'inline',
  rows,
  answering,
  children,
}: QuestionCompositionProps) {
  /*
   * The list gets either both or neither: an `onSelect` without stating who
   * is allowed to tap would turn display rows into buttons on the projector.
   */
  const list = answering
    ? { onSelect: answering.onSelect, disabled: answering.disabled, label: answering.label }
    : {}
  /*
   * Without an image there is nothing for the portrait layout to key off of -
   * the image column would stay empty and the question would be cramped
   * beside it. Validation does require an image, but a missing asset must not
   * disfigure the stage in live operation.
   */
  if (question.presentationType === 'person' && imageUrl) {
    return (
      <div className={styles.person}>
        <Media src={imageUrl} {...(imageCredit ? { credit: imageCredit } : {})} variant="portrait" />
        <div className={styles.column}>
          <QuestionHead question={question} />
          {children}
          <AnswerList rows={rows} {...list} />
        </div>
      </div>
    )
  }

  return (
    <>
      <QuestionHead
        question={question}
        imageUrl={imageUrl}
        {...(imageCredit ? { imageCredit } : {})}
        variant={mediaVariant}
      />
      {children}
      <AnswerList rows={rows} {...list} />
    </>
  )
}
