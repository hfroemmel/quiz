/** Gemeinsame Eigenschaften aller Buehnenszenen. */
import type { PublicQuizViewModel } from '@quiz/contracts'
import type { RevealDisplay } from '../useRevealClock.ts'

export interface SceneProps {
  view: PublicQuizViewModel
  reveal: RevealDisplay
  /** Serverzeit fuer laufende Medien; niemals lokale Zustandsquelle. */
  serverNow: () => number
}
