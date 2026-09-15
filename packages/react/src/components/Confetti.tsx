/**
 * Confetti for the result view.
 *
 * It comes as a delivered file `confetti.svg` (cleared). The motion sits as
 * a CSS animation in the graphic itself; it still runs when the file is
 * embedded as an image. That means there is no second version rebuilt in
 * code.
 *
 * The effect has no influence whatsoever on game logic. Under reduced
 * motion it is hidden completely in the stylesheet.
 */
import { confettiOverlayUrl } from '../presentation/animationAssets'
import styles from './Confetti.module.css'

export function Confetti() {
  return <img className={styles.confetti} data-confetti="" src={confettiOverlayUrl} alt="" aria-hidden="true" />
}
