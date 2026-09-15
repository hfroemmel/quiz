/** Properties shared by every stage scene. */
import type { PublicQuizViewModel } from '@hfroemmel/quiz-core'
import type { RevealDisplay } from '../../client/useRevealClock'

/**
 * The answer rows are buttons.
 *
 * Set only on the touch device. There is no operator standing beside it
 * there: whoever's turn it is taps their answer in the same list that the
 * room only displays. There is deliberately no second list per player - four
 * answers sit on the table once, and the assignment decides whom they
 * currently belong to.
 */
export interface SceneAnswering {
  /** Nobody has the assignment, or the server is not currently accepting anything. */
  disabled: boolean
  /** Screen readers should know whose answers these currently are. */
  label: string
  onSelect(optionId: string): void
}

export interface SceneProps {
  view: PublicQuizViewModel
  reveal: RevealDisplay
  /** Server time for running media; never a local source of truth. */
  serverNow: () => number
  /**
   * Where the scene is running.
   *
   *   `stage`    the projector in the room
   *   `preview`  the preview in the operator's window
   *   `touch`    the device someone plays on themselves
   *
   * The room sees only game content; the preview may additionally carry
   * director's notes. The touch device is like the stage in this respect:
   * whoever sits in front of it plays.
   */
  variant: 'stage' | 'preview' | 'touch'
  answering?: SceneAnswering
}
