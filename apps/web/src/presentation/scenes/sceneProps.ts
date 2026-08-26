/** Gemeinsame Eigenschaften aller Buehnenszenen. */
import type { PublicQuizViewModel } from '@hfroemmel/quiz-core'
import type { RevealDisplay } from '../../client/useRevealClock'

/**
 * Die Antwortzeilen sind Schaltflaechen.
 *
 * Nur am Touchgeraet gesetzt. Dort steht kein Operator daneben: Wer am Zug ist,
 * tippt seine Antwort in derselben Liste an, die im Saal nur anzeigt. Es gibt
 * bewusst keine zweite Liste je Spieler - vier Antworten stehen einmal auf dem
 * Tisch, und der Zuschlag entscheidet, wem sie gerade gehoeren.
 */
export interface SceneAnswering {
  /** Niemand hat den Zuschlag oder der Server nimmt gerade nichts an. */
  disabled: boolean
  /** Vorlesewerkzeuge sollen wissen, wessen Antworten das gerade sind. */
  label: string
  onSelect(optionId: string): void
}

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
   * Der Saal sieht ausschliesslich Spielinhalte; die Vorschau darf zusaetzlich
   * Regiehinweise tragen. Das Touchgeraet ist in dieser Hinsicht wie die
   * Buehne: Wer davorsitzt, spielt.
   */
  variant: 'stage' | 'preview' | 'touch'
  answering?: SceneAnswering
}
