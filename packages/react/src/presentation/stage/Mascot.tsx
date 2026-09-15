/**
 * The stage's mascot layer.
 *
 * Purely decorative: no alt text, no click target. Whether a mascot appears
 * there is decided solely by the design world in the stylesheet - the markup
 * carries no mode name. On the adults' stage the layer stays empty.
 */
import styles from './Mascot.module.css'

export function Mascot() {
  return <div className={styles.mascot} data-mascot="" aria-hidden="true" />
}
