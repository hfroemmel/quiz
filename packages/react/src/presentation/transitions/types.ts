/**
 * Animation contract (specification 22.3).
 *
 * Every transition definition answers, in exactly one place:
 *  - which scene change it concerns (`appliesTo`);
 *  - which elements are animated (`classNames`);
 *  - how duration, delay and easing are set (`durationMs`, `easing`);
 *  - which sound cue is coupled to it (`soundCueId`);
 *  - which reduced-motion fallback applies (`reducedMotionDurationMs`);
 *  - which parts are fixed for fairness or synchronisation reasons (`locked`).
 */
import type { PublicScene } from '@hfroemmel/quiz-core'
import type { SoundCueId } from '../soundCues'

export interface PresentationTransitionDefinition {
  id: string
  description: string
  /** Scene edge this transition applies to. `'*'` means "any preceding scene". */
  appliesTo: { from: PublicScene | '*'; to: PublicScene }
  durationMs: number
  delayMs?: number
  easing: string
  reducedMotionDurationMs: number
  soundCueId?: SoundCueId
  classNames?: {
    from?: string
    active?: string
    to?: string
  }
  /**
   * When set: this transition's duration must NOT be changed freely, because
   * the server uses the same time for the domain phase change. The
   * justification is in the text.
   */
  locked?: string
}
