/**
 * A player's buzzer on the touch device.
 *
 * Both players stand side by side in front of the same screen; each has
 * their corner at the bottom on their own side, and the four answers sit
 * exactly once in the middle. Whoever presses first gets them.
 *
 * The buzz is decided on the server: the button only sends `BUZZ` with its
 * own player, and the server accepts the first valid buzz - by the same rule
 * as the stage's hardware buzzer. Whoever presses too late is rejected; this
 * client then simply shows the new state.
 *
 * The area carries only one word. On the device, presses are fast and
 * imprecise, and whoever buzzes is looking at the question while doing so,
 * not at their hand; the colour and the score card above it say whose corner
 * it is.
 */
import type { PlayerId } from '@hfroemmel/quiz-core'
import styles from './Game.module.css'

interface BuzzerProps {
  playerId: PlayerId
  label: string
  /** Label on the area - shown in the game's language. */
  buzzText?: string
  side: 'left' | 'right'
  /** Can this player grab the buzz right now? */
  enabled: boolean
  /** They already have it - the answers in the middle belong to them. */
  armed: boolean
  onBuzz(playerId: PlayerId): void
}

export function Buzzer({ playerId, label, side, enabled, armed, onBuzz, buzzText = 'Buzzern' }: BuzzerProps) {
  return (
    <button
      type="button"
      className={`stage-button ${styles.buzzer}`}
      data-buzzer=""
      data-player={playerId}
      data-side={side}
      data-enabled={String(enabled)}
      data-armed={String(armed)}
      disabled={!enabled}
      /*
       * `onPointerDown` instead of `onClick`: when buzzing, the moment of
       * touch is what counts. A click only fires on release and would give
       * the slower player a chance to overtake the faster one.
       */
      onPointerDown={() => onBuzz(playerId)}
      aria-label={`${label} buzzern`}
    >
      {buzzText}
    </button>
  )
}
