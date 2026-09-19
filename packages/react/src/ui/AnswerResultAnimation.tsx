/**
 * The mark that says whether an answer was right or wrong - drawn, not filmed.
 *
 * IT IS A VECTOR AND NOT A VIDEO, and that is the whole point of it. The
 * statement used to be a delivered WebM clip per outcome (`animationClips`),
 * which brought three problems this does not have: the colours were baked into
 * the file, so a stage variant or a world with its own palette got the clip's
 * turquoise and red anyway; it needed a decoder to show a circle and a
 * checkmark; and it carried transparent margin that every place showing it had
 * to compensate for. Here the disc is a `<circle>` and the symbol a `<path>`,
 * both filled from the theme's own tokens - the meaning colour of the active
 * variant, whichever that is.
 *
 * THE MOTION IS IN THE STYLESHEET, in two steps: the disc scales in with a
 * short spring, then the symbol is drawn along its path (`pathLength` makes the
 * dash length independent of the actual path length). Nothing reports back when
 * it is done: how long the room sees this is decided by the server's phase, as
 * it was with the clips (specification 22.1).
 *
 * IT SAYS NOTHING OUT LOUD. The scene around it carries the word - `Richtig!`
 * or `Falsch!`, from the content's texts - so the drawing is decoration for a
 * screen reader and stays `aria-hidden`. A label of its own here would be that
 * word a second time, in a language the package chose rather than the content.
 */
import styles from './AnswerResultAnimation.module.css'

export type AnswerResult = 'correct' | 'wrong'

interface AnswerResultAnimationProps {
  result: AnswerResult
  className?: string
  /** Restarts the animation as soon as the value changes. */
  restartKey?: string | number
}

/*
 * The two symbols, in the disc's own coordinates.
 *
 * They are drawn as ONE stroke each - the checkmark as two segments of a single
 * line, the cross as two subpaths of one path - so a single animation draws the
 * whole symbol and no second timing has to be kept in step with the first.
 */
const symbols: Record<AnswerResult, string> = {
  correct: 'M25 51 L42 68 L76 33',
  wrong: 'M31 31 L69 69 M69 31 L31 69',
}

export function AnswerResultAnimation({ result, className, restartKey }: AnswerResultAnimationProps) {
  return (
    <svg
      /*
       * A NEW KEY IS A NEW ELEMENT, and that is how the animation replays: CSS
       * animations start when the element enters the document, so the next
       * attempt by the same player gets its own disc rather than a finished one.
       */
      key={restartKey}
      className={className ? `${styles.mark} ${className}` : styles.mark}
      viewBox="0 0 100 100"
      /* The disc overshoots its size by six percent - it must not be cut off. */
      overflow="visible"
      aria-hidden="true"
      focusable="false"
      data-answer-result={result}
    >
      <circle className={styles.disc} cx="50" cy="50" r="46" />
      <path className={styles.symbol} pathLength="1" d={symbols[result]} />
    </svg>
  )
}
