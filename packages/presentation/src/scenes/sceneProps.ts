/** Gemeinsame Eigenschaften aller Buehnenszenen. */
import type { PublicQuizViewModel } from '@quiz/contracts'
import type { RevealDisplay } from '../useRevealClock.ts'

export interface SceneProps {
  view: PublicQuizViewModel
  reveal: RevealDisplay
  /** Serverzeit fuer laufende Medien; niemals lokale Zustandsquelle. */
  serverNow: () => number
  /**
   * Wo diese Flaeche steht.
   *
   * `touch` heisst: Die Antwortoptionen liegen bereits als Schaltflaechen vor den
   * Spielern. Die Buehne zeigt sie dann nicht ein zweites Mal - sie wuerden den
   * Platz nehmen, den Frage und Bild brauchen.
   */
  variant: StageVariant
}

export type StageVariant = 'stage' | 'preview' | 'touch'
