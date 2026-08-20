/**
 * Fragenzaehler „Frage 3/7" - EIN Bauteil fuer beide Gestaltungswelten.
 *
 * Aufbau wie bei der Punktekarte: kleine Beschriftung, grosser Wert. Er steht in
 * beiden Welten rechts aussen in der Kopfzeile; wie er gerahmt wird, entscheidet
 * `Counter.module.css`.
 */
import styles from './Counter.module.css'

export function Counter({ current, total }: { current: number; total: number }) {
  return (
    <div className={styles.counter} data-counter="">
      <span className={styles.label} data-counter-label="">
        Frage
      </span>
      <span className={styles.value} data-counter-value="">
        {Math.min(current, total)}/{total}
      </span>
    </div>
  )
}
