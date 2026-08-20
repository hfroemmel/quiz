/**
 * Hinweis auf die zweite Chance.
 *
 * Er steht rechtsbuendig direkt ueber den Antwortzeilen: Der Saal soll auf einen
 * Blick sehen, dass dieser Versuch weniger Punkte bringt.
 */
import styles from './SecondChanceHint.module.css'

export function SecondChanceHint({ points }: { points: number }) {
  return (
    <p className={styles.hint} data-hint="">
      Zweite Chance · {points} Punkte
    </p>
  )
}
