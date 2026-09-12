/**
 * Zentrale Timings und Easings der Praesentationsschicht (Spezifikation 22.5).
 *
 * KEINE MAGISCHEN ZAHLEN IN JSX: Jede Dauer, jede Verzoegerung und jedes Easing steht
 * hier oder in einer Uebergangsdefinition unter `transitions/`.
 *
 * Zwei Arten von Werten sind zu unterscheiden:
 *
 *  1. FACHLICH RELEVANT - kommt aus `@quiz/contracts` (`gameTiming`) und wird vom
 *     Server verwendet, um Phasen zu beenden. Diese Werte duerfen hier NICHT
 *     ueberschrieben werden, sonst laufen Anzeige und Spielzustand auseinander.
 *     Betroffen: Feedbackdauer, Loesungsverzoegerung, Enthuellungsdauer, Pausenscreen.
 *
 *  2. REIN VISUELL - nur hier definiert. Aenderungen sind gefahrlos moeglich, weil
 *     kein Zustandswechsel davon abhaengt.
 */
import { gameTiming } from '@hfroemmel/quiz-core'

export const presentationTiming = {
  /* --- fachlich relevant: gespiegelt aus gameTiming, nicht hier aendern --- */
  /** Dauer der Richtig-Animation. Der Server wechselt danach zur Loesung. */
  correctFeedbackMs: gameTiming.correctFeedbackMs,
  /** Dauer der Falsch-Animation. Danach folgt zweite Chance oder Loesung. */
  incorrectFeedbackMs: gameTiming.incorrectFeedbackMs,
  /** Kurze Pause zwischen Feedback und Loesung. */
  solutionDelayMs: gameTiming.solutionDelayMs,
  /** Bestaetigte zehn Sekunden der Bildenthuellung. Bindend. */
  imageRevealDurationMs: gameTiming.imageRevealDurationMs,
  /** Dauer des Pausenscreens zwischen zwei Fragen. */
  pauseScreenMs: gameTiming.pauseScreenMs,

  /* --- rein visuell: hier gefahrlos anpassbar --- */
  /** Ueberblendung beim Szenenwechsel. */
  sceneFadeMs: 400,
  /** Verzoegerung, mit der Antwortoptionen nacheinander einlaufen. */
  optionStaggerMs: 70,
  /** Wie lange Konfetti auf der Ergebnisansicht laeuft. */
  resultConfettiMs: 6_000,
  /** Dauer der Punktestand-Hochzaehlanimation. */
  scoreCountUpMs: 600,
  /**
   * Abgang der Videoflaeche, wenn das Video durchgelaufen ist. Erst danach wird
   * das Element angehalten - das letzte Bild laeuft unter der Blende aus.
   */
  videoExitMs: 700,

  /* --- die Jokerziehung --- */
  /*
   * Die Dauern des Flugs und der Drehung stehen NICHT hier, sondern in
   * `jokerDrawTiming` im Kern: Der Server plant den Aufdeckschritt damit ein,
   * und ein Client, der mitten im Flug dazukommt, rechnet seine Position darin
   * aus. Hier stehen nur die Zeiten, die allein die Darstellung betreffen.
   */
  /** Wie lange eine Antwort braucht, um nach einem 50:50 zurueckzutreten. */
  jokerEliminateMs: 250,
  /** Versatz, mit dem mehrere Antworten nacheinander zuruecktreten. */
  jokerEliminateStaggerMs: 110,
  /** Ueberblendung zwischen Spielernummer und Gruppenzeichen. */
  jokerMarkerFadeMs: 200,
  /** Ausblenden der aufgedeckten Karte, wenn der Operator weitergeht. */
  jokerDismissMs: 200,
} as const

export const easings = {
  /**
   * Der Flug der Jokerkarte: schneller Antritt, langes ruhiges Ausschwingen.
   * Sie soll geworfen aussehen, nicht geschossen.
   */
  jokerFlight: 'cubic-bezier(0.22, 1, 0.36, 1)',
  /** Standard fuer Ein- und Ausblenden. */
  standard: 'cubic-bezier(0.22, 0.61, 0.36, 1)',
  /** Betont den Eintritt, z. B. bei der Richtig-Animation. */
  emphasized: 'cubic-bezier(0.16, 1, 0.3, 1)',
  /** Kurzes, hartes Ausschwingen fuer die Falsch-Animation. */
  sharp: 'cubic-bezier(0.4, 0, 0.6, 1)',
} as const

/*
 * Das Bilderkennen hat hier keinen Wert mehr: Rastergroesse, Reihenfolge und
 * Kachelblende stehen in `revealGrid` (`@quiz/contracts/config`), weil sie
 * bestimmen, WAS ein Spieler wann sieht, und damit zur Fairness gehoeren - nicht
 * zur Ausschmueckung.
 */

/**
 * Reduzierte Bewegung: Nutzer- bzw. Systemeinstellung `prefers-reduced-motion`.
 * Jede Uebergangsdefinition liefert dafuer eine eigene, kuerzere Dauer.
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export type PresentationTiming = typeof presentationTiming
