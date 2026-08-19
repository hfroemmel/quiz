/** Gemeinsame Eigenschaften aller Buehnenszenen. */
import type { PublicQuizViewModel } from '@quiz/contracts'
import type { RevealDisplay } from '../../client/useRevealClock.ts'

export interface SceneProps {
  view: PublicQuizViewModel
  reveal: RevealDisplay
  /** Serverzeit fuer laufende Medien; niemals lokale Zustandsquelle. */
  serverNow: () => number
  /**
   * Wo die Szene laeuft: auf der Buehne oder in der Vorschau des Operators.
   *
   * Der Saal sieht ausschliesslich Spielinhalte. Regiehinweise - etwa der
   * eingefrorene Countdown - gehoeren in die Vorschau und nur dorthin.
   */
  variant: 'stage' | 'preview'
}
