/**
 * Question counter „Frage 3/7" - ONE component for both design worlds.
 *
 * Structured like the score card: small label, large value. It sits at the
 * far right of the header in both worlds; how it is framed is decided by
 * `Counter.module.css`.
 */
import styles from './Counter.module.css'

export function Counter({
  current,
  total,
  label = 'Frage',
}: {
  current: number
  total: number
  /** Label supplied from outside - the stage speaks the game's language. */
  label?: string
}) {
  return (
    <div className={styles.counter} data-counter="">
      <span className={styles.label} data-counter-label="">
        {label}
      </span>
      <span className={styles.value} data-counter-value="">
        {Math.min(current, total)}/{total}
      </span>
    </div>
  )
}
