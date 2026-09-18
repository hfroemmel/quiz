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
 * TWO LOOKS, ONE BUTTON. At a live event the corner carries one word on a
 * coloured area: presses are fast and imprecise there, and whoever buzzes is
 * looking at the question while doing so, so the colour and the score card
 * above it say whose corner it is. The kiosk layout shows the drawn buzzer
 * instead - a device standing unattended in a foyer is operated by people who
 * have never seen this quiz before, and a red push-button says "press me"
 * without a word of explanation.
 *
 * WHAT THE LOOK DOES NOT CHANGE: this is a button in both. Full area, touch,
 * keyboard, an accessible name and the four states below - the drawing is what
 * is inside it, not what it is.
 */
import type { PlayerId } from '@hfroemmel/quiz-core'
import buzzerGraphic from '../assets/buzzer.svg'
import styles from './Game.module.css'

/**
 * What the corner says right now.
 *
 *   waiting  the question is still being read - nobody may buzz yet
 *   ready    the answers are up, this player may take them
 *   armed    this player holds the buzz; the answers belong to them
 *   locked   somebody else holds the buzz, or this player has used up their
 *            attempt on this question
 *
 * `ready` is the only state in which the button is operable. The other three
 * are what the room sees, not what it may do - and they are told apart
 * visibly, because "not now" and "not you" are two different messages.
 */
export type BuzzerState = 'waiting' | 'ready' | 'armed' | 'locked'

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
  /**
   * Locked out: somebody else holds the buzz, or this player has used up
   * their attempt on this question.
   *
   * It cannot be read off the two flags above - a buzzer that is not enabled
   * is either waiting for the release or locked out, and those are two
   * different messages. Only the foot around it sees both corners at once, so
   * it is the foot that says which one this is.
   */
  locked?: boolean
  /** The word on an area, or the drawn push-button of the kiosk layout. */
  look?: 'label' | 'graphic'
  onBuzz(playerId: PlayerId): void
}

function stateOf(enabled: boolean, armed: boolean, locked: boolean): BuzzerState {
  if (armed) return 'armed'
  if (locked) return 'locked'
  return enabled ? 'ready' : 'waiting'
}

export function Buzzer({
  playerId,
  label,
  side,
  enabled,
  armed,
  onBuzz,
  locked = false,
  look = 'label',
  buzzText = 'Buzzern',
}: BuzzerProps) {
  const state = stateOf(enabled, armed, locked)
  return (
    <button
      type="button"
      className={`${look === 'graphic' ? styles.buzzerGraphic : `stage-button ${styles.buzzer}`}`}
      data-buzzer=""
      data-player={playerId}
      data-side={side}
      data-enabled={String(enabled)}
      data-armed={String(armed)}
      data-buzzer-state={state}
      disabled={!enabled}
      /*
       * `onPointerDown` instead of `onClick`: when buzzing, the moment of
       * touch is what counts. A click only fires on release and would give
       * the slower player a chance to overtake the faster one.
       */
      onPointerDown={() => onBuzz(playerId)}
      /*
       * AND THE KEYBOARD, which `onPointerDown` cannot hear: a press of Enter
       * or Space fires a click with no pointer behind it (`detail === 0`), and
       * only that case is taken here - a mouse click has already buzzed on the
       * way down and must not buzz twice.
       *
       * Only the drawn buzzer listens. The live device's corner is what it has
       * always been, down to which events reach it; whoever changes that
       * changes an evening's game, not a layout.
       */
      {...(look === 'graphic'
        ? {
            onClick: (event: { detail: number }) => {
              if (event.detail === 0) onBuzz(playerId)
            },
          }
        : {})}
      aria-label={look === 'graphic' ? `${label} ${buzzText}` : `${label} buzzern`}
    >
      {look === 'graphic' ? (
        /*
         * The drawing carries no words, and it needs none: the accessible name
         * of the button above says whose corner this is, and a second reading
         * of the same fact would be noise in a screen reader.
         */
        <img className={styles.buzzerImage} src={buzzerGraphic} alt="" aria-hidden="true" />
      ) : (
        buzzText
      )}
    </button>
  )
}
