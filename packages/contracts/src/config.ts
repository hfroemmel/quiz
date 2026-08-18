/**
 * Zentrale, typisierte Konfiguration von Spielregeln und fachlich relevanten Timings.
 *
 * "Fachlich relevant" heisst: Der Server braucht diese Werte, um deterministisch und
 * testbar zu entscheiden, wann eine Phase endet. Rein visuelle Werte (Easing,
 * Szenen-Fade, Konfettidauer) liegen dagegen in der Praesentationsschicht
 * (`apps/web/src/presentation/animationPresets.ts`) und importieren von hier,
 * damit es keine zweite Quelle der Wahrheit gibt.
 */

/** Punkteregeln (Spezifikation 14.1). */
export const scoringRules = {
  /** Erste richtige Antwort. */
  firstAnswerPoints: 100,
  /** Richtige zweite Chance bzw. richtige Bildantwort nach mindestens einem Fehlversuch. */
  secondChancePoints: 50,
  /** Falsche Antwort, Passen und Aufloesen ohne Antwort. Es gibt keinen Punktabzug. */
  noPoints: 0,
  /** Schrittweite der manuellen Korrektur. */
  manualAdjustmentStep: 100,
  /** Der Punktestand faellt standardmaessig nicht unter null. */
  minimumScore: 0,
} as const

/**
 * Timings, die den fachlichen Zustandswechsel steuern.
 *
 * Der Server setzt fuer zeitgesteuerte Phasen einen Fallback-Timer. Die Praesentation
 * darf eine Fertigmeldung senden, aber der fachliche Wechsel haengt niemals davon ab,
 * ob ein Browser ein `animationend`-Event zuverlaessig liefert (Spezifikation 22.1).
 */
export const gameTiming = {
  /** Dauer der Richtig-Animation, bevor die Loesung erscheint. */
  correctFeedbackMs: 1_400,
  /** Dauer der Falsch-Animation, bevor zweite Chance bzw. Loesung folgt. */
  incorrectFeedbackMs: 1_200,
  /** Kurze definierte Pause zwischen Feedback und Loesungsansicht. */
  solutionDelayMs: 250,
  /**
   * Bestaetigte Enthuellungsdauer beim Bilderkennen: exakt zehn Sekunden.
   * Dies ist der einzige Timingwert, der laut Spezifikation bindend ist.
   */
  imageRevealDurationMs: 10_000,
  /** Dauer des Pausen-/Logoscreens zwischen zwei Fragen. */
  pauseScreenMs: 1_200,
} as const

/** Parameter des Auswahlalgorithmus (Spezifikation 17.2). */
export const selectionTuning = {
  /** Mindestgroesse des Kandidatenfensters unter den am laengsten nicht genutzten Fragen. */
  minWindowSize: 3,
  /** Anteil der verfuegbaren Kandidaten, der zusaetzlich ins Fenster faellt. */
  windowFraction: 0.2,
  /**
   * Gewichtung innerhalb des Fensters. 0 = gleichverteilt, 1 = linear zugunsten
   * der aeltesten Frage. Bewusst leicht gewichtet, damit die Auswahl nicht starr wirkt.
   */
  olderBias: 0.5,
} as const

/** Warnschwellen der Inhaltsvalidierung (Spezifikation 17.5 und 24.4). */
export const contentThresholds = {
  /** Unter dieser Kandidatenzahl pro Fragenplatz wird gewarnt. */
  smallPoolWarning: 8,
  /** Unter so vielen wiederholungsfreien Spielen pro Preset wird gewarnt. */
  minGamesWithoutRepetition: 3,
  /** Ab dieser Laenge gilt ein Fragetext als sehr lang. */
  longPromptChars: 220,
  /** Ab dieser Laenge gilt ein Antworttext als sehr lang. */
  longOptionChars: 90,
  /** Anzahl Optionen, die Multiple-Choice-Fragen mit Optionen besitzen muessen. */
  requiredChoiceOptionCount: 4,
} as const

export type ScoringRules = typeof scoringRules
export type GameTiming = typeof gameTiming
