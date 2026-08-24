/** Gemeinsame Eigenschaften aller Buehnenszenen. */
import type { PublicQuizViewModel } from '@quiz/contracts'
import type { RevealDisplay } from '../../client/useRevealClock.ts'

export interface SceneProps {
  view: PublicQuizViewModel
  reveal: RevealDisplay
  /** Serverzeit fuer laufende Medien; niemals lokale Zustandsquelle. */
  serverNow: () => number
  /**
   * Wo die Szene laeuft.
   *
   *   `stage`    der Beamer im Saal
   *   `preview`  die Vorschau im Operatorfenster
   *   `touch`    das Geraet, an dem selbst gespielt wird
   *
   * Der Saal sieht ausschliesslich Spielinhalte. Regiehinweise - etwa das Wort
   * `pausiert` unter dem Bild - gehoeren in die Vorschau und nur dorthin. Das
   * Touchgeraet ist in dieser Hinsicht wie die Buehne: Wer davorsitzt, spielt.
   */
  variant: 'stage' | 'preview' | 'touch'
}

/**
 * Uebernehmen die Antwortleisten der Spieler die Antworten?
 *
 * Am Touchgeraet ja - dort sind sie die Schaltflaechen, auf die getippt wird.
 * Die Szene laesst sie dann weg, statt sie ein zweites Mal zu zeigen.
 */
export function touchAnswers(variant: SceneProps['variant']): boolean {
  return variant === 'touch'
}
