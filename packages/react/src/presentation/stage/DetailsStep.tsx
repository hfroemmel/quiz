/**
 * The background of a question, as a step between the solution and the next.
 *
 * WHY A STEP AND NOT A HINT AT THE EDGE. The card covers the stage and carries
 * the only way onward, so the round does not move on while somebody is still
 * reading. Where a question brings no background there is no step at all, and
 * the quiz's own way onward stays what it was - an empty in-between screen
 * would be a worse answer than none.
 *
 * IT NAMES THE QUESTION IT BELONGS TO. The card covers the stage, so what it
 * used to leave behind it - the rubric and the question - was gone from the
 * moment it opened, and a background of three sentences read as a text without
 * a subject. Both stand at the top of the card now, in the voice of the board
 * they cover: the rubric small above, the question in the serif of the stage.
 *
 * WHOSE STEP IT IS. In a hall none: there the moderator tells the background,
 * and the projection transmits nothing of it. At a device there is nobody to
 * tell it, so the content says `rules.showDetailsAfterSolution` and the text
 * arrives with the solution (`view.visibleSolution.details`). The component
 * therefore needs no rule of its own - it shows what it is given.
 */
import { useEffect, useId, useRef, useState } from 'react'
import styles from './DetailsStep.module.css'

export interface DetailsStepProps {
  /**
   * The background to read, while there is one.
   *
   * Going from a text to nothing is the way out, not a removal: the step stays
   * mounted until it has finished leaving.
   */
  details?: string | undefined
  /** The rubric of the question - the same line the board above it carries. */
  category?: string | undefined
  /** The question this background belongs to, shown at the top of the card. */
  prompt?: string | undefined
  /** Label of the button - the same word as the footer's way onward. */
  continueLabel: string
  /**
   * Announced name of the card, where the question is not shown in it.
   *
   * With a prompt in the card the heading IS the name (`aria-labelledby`), so
   * nothing is said twice.
   */
  label?: string | undefined
  /** The way onward. It is the round's, not only the card's. */
  onContinue: () => void
}

/**
 * The longest transition on this element, in milliseconds.
 *
 * The stage says how long its small moves take (`--stage-fade-duration`), and
 * under `prefers-reduced-motion` that value is 1 ms. Reading it back from the
 * element is what keeps the way out exactly as long as the fade - the host this
 * step comes from carried its own 220 and a comment asking whoever changes one
 * to remember the other.
 */
function transitionMs(element: HTMLElement): number {
  const style = getComputedStyle(element)
  const durations = style.transitionDuration.split(',')
  const delays = style.transitionDelay.split(',')
  const times = durations.map(
    (duration, index) => cssMs(duration, 0) + cssMs(delays[index] ?? delays[0] ?? '', 0),
  )
  return Math.max(0, ...times)
}

/** A time from the stylesheet, in milliseconds. */
function timeToken(element: HTMLElement, name: string, fallback: number): number {
  return cssMs(getComputedStyle(element).getPropertyValue(name), fallback)
}

/** `s` and `ms` are the only units a CSS time arrives in. */
function cssMs(raw: string, fallback: number): number {
  const text = raw.trim()
  const value = Number.parseFloat(text)
  if (!Number.isFinite(value)) return fallback
  return text.endsWith('ms') ? value : value * 1000
}

/** What stands on the card: the background, and the question it belongs to. */
interface Shown {
  details: string
  category?: string | undefined
  prompt?: string | undefined
}

export function DetailsStep({ details, category, prompt, continueLabel, label, onContinue }: DetailsStepProps) {
  /*
   * What is on screen - which is not always what was handed in. On the way out
   * the step keeps the last card until the fade is over; without it the card
   * would be gone in the instant the round moves on, and nobody would see it
   * go.
   *
   * AND IT KEEPS ALL THREE TOGETHER. The round moves on the moment the button
   * is pressed, so the next question is already in the view model while this
   * card is still fading - a prompt read live would swap to the NEXT question
   * in front of the reader's eyes. What stands there belongs to the background
   * it explains, until the last frame.
   */
  const [shown, setShown] = useState<Shown | undefined>(
    details === undefined ? undefined : { details, category, prompt },
  )
  const [open, setOpen] = useState(false)
  const step = useRef<HTMLDivElement>(null)
  /* The heading is the card's name where there is one - see `label`. */
  const headingId = useId()

  /*
   * A NEW TEXT IS TAKEN OVER WHILE RENDERING, not in an effect afterwards.
   *
   * The times of this step stand in its stylesheet, so the component has to
   * read them off its own element - and in an effect that would be the moment
   * the element is not there yet: the state that mounts it would only have been
   * set in that same effect. React re-renders immediately on a change made
   * here, so the element is in the tree by the time the effects run.
   */
  if (details !== undefined && details !== shown?.details) setShown({ details, category, prompt })

  useEffect(() => {
    const element = step.current
    if (!element) return undefined

    if (details !== undefined) {
      /*
       * Mounted first, open a moment later. The round is already held from the
       * moment the solution stands - see `QuizGame` - so the wait costs nobody
       * a chance to read; it gives the solution the moment it needs alone.
       */
      const timer = setTimeout(() => setOpen(true), timeToken(element, '--stage-details-delay', 2000))
      return () => clearTimeout(timer)
    }

    // Closed first, gone afterwards - the card keeps its place while it fades.
    setOpen(false)
    const timer = setTimeout(() => setShown(undefined), transitionMs(element))
    return () => clearTimeout(timer)
  }, [details])

  if (shown === undefined) return null

  return (
    <div
      ref={step}
      className={styles.step}
      data-quiz-details=""
      data-open={String(open)}
      /*
       * `aria-hidden` while closed, because `visibility` alone would hand a
       * screen reader a card nobody can reach - and on the way out the card is
       * a picture, not a text any more.
       */
      aria-hidden={open ? undefined : true}
    >
      <div
        className={styles.panel}
        role="dialog"
        {...(shown.prompt === undefined
          ? label === undefined
            ? {}
            : { 'aria-label': label }
          : { 'aria-labelledby': headingId })}
      >
        {(shown.category !== undefined || shown.prompt !== undefined) && (
          <header className={styles.asked}>
            {shown.category !== undefined && (
              <p className={styles.category} data-quiz-details-category="">
                {shown.category}
              </p>
            )}
            {shown.prompt !== undefined && (
              <h2 id={headingId} className={styles.prompt} data-quiz-details-prompt="">
                {shown.prompt}
              </h2>
            )}
          </header>
        )}
        <p className={styles.text}>{shown.details}</p>
        <button
          type="button"
          className={`stage-button stage-button--primary ${styles.continue}`}
          data-quiz-details-continue=""
          onClick={onContinue}
        >
          {continueLabel}
        </button>
      </div>
    </div>
  )
}
