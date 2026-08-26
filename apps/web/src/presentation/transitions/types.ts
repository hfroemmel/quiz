/**
 * Animationsvertrag (Spezifikation 22.3).
 *
 * Jede Uebergangsdefinition beantwortet an genau einer Stelle:
 *  - welchen Szenenwechsel sie betrifft (`appliesTo`);
 *  - welche Elemente animiert werden (`classNames`);
 *  - wie Dauer, Verzoegerung und Easing geaendert werden (`durationMs`, `easing`);
 *  - welche Soundmarke gekoppelt ist (`soundCueId`);
 *  - welcher Reduced-Motion-Fallback gilt (`reducedMotionDurationMs`);
 *  - welche Teile aus Fairness- oder Synchronitaetsgruenden fest sind (`locked`).
 */
import type { PublicScene } from '@hfroemmel/quiz-core'
import type { SoundCueId } from '../soundCues'

export interface PresentationTransitionDefinition {
  id: string
  description: string
  /** Szenenkante, fuer die dieser Uebergang gilt. `'*'` heisst "jede Vorgaengerszene". */
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
   * Wenn gesetzt: Dieser Uebergang darf in seiner Dauer NICHT frei geaendert werden,
   * weil der Server dieselbe Zeit fuer den fachlichen Phasenwechsel verwendet.
   * Die Begruendung steht im Text.
   */
  locked?: string
}
