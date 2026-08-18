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
import { gameTiming } from '@quiz/contracts'

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
} as const

export const easings = {
  /** Standard fuer Ein- und Ausblenden. */
  standard: 'cubic-bezier(0.22, 0.61, 0.36, 1)',
  /** Betont den Eintritt, z. B. bei der Richtig-Animation. */
  emphasized: 'cubic-bezier(0.16, 1, 0.3, 1)',
  /** Kurzes, hartes Ausschwingen fuer die Falsch-Animation. */
  sharp: 'cubic-bezier(0.4, 0, 0.6, 1)',
} as const

/**
 * Maximale Unschaerfe des Bilderkennens in Pixeln bei Fortschritt 0.
 *
 * ACHTUNG - FAIRNESS: Dieser Wert darf gestalterisch angepasst werden, die
 * BERECHNUNG aber nicht. Sie muss weiterhin aus demselben Reveal-Fortschritt
 * stammen wie der Countdown (siehe `@quiz/domain/reveal`), sonst entsteht ein
 * Informationsvorteil fuer einen Spieler.
 */
export const revealMaxBlurPx = 44

/**
 * Reduzierte Bewegung: Nutzer- bzw. Systemeinstellung `prefers-reduced-motion`.
 * Jede Uebergangsdefinition liefert dafuer eine eigene, kuerzere Dauer.
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export type PresentationTiming = typeof presentationTiming
