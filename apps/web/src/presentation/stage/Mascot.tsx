/**
 * Figurenebene der Buehne.
 *
 * Reine Dekoration: ohne Alternativtext, ohne Klickflaeche. Ob dort eine Figur
 * steht, entscheidet allein die Gestaltungswelt im Stylesheet - im Markup steht
 * kein Modusname. In der Buehne der Erwachsenen bleibt die Ebene leer.
 */
import styles from './Mascot.module.css'

export function Mascot() {
  return <div className={styles.mascot} data-mascot="" aria-hidden="true" />
}
