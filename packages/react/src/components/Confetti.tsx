/**
 * Konfetti der Ergebnisansicht.
 *
 * Es kommt als gelieferte Datei `confetti.svg` (freigegeben). Die Bewegung steckt
 * als CSS-Animation in der Grafik selbst; sie laeuft auch, wenn die Datei als Bild
 * eingebunden ist. Damit gibt es keine zweite, im Code nachgebaute Fassung.
 *
 * Der Effekt beeinflusst keinerlei Spiellogik. Bei reduzierter Bewegung wird er
 * im Stylesheet vollstaendig ausgeblendet.
 */
import { confettiOverlayUrl } from '../presentation/animationAssets'
import styles from './Confetti.module.css'

export function Confetti() {
  return <img className={styles.confetti} data-confetti="" src={confettiOverlayUrl} alt="" aria-hidden="true" />
}
