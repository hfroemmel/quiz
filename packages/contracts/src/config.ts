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
  manualAdjustmentStep: 50,
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
  /**
   * Dauer der Richtig-Animation, bevor die Loesung erscheint.
   *
   * Der Wert richtet sich nach der gelieferten Bewegtgrafik `correct.webm`: Der
   * Haken ist nach etwa 1,4 Sekunden fertig gezeichnet, das Konfetti danach
   * ausgelaufen. Eine kuerzere Phase wuerde mitten in die Aussage schneiden.
   */
  correctFeedbackMs: 2_000,
  /** Dauer der Falsch-Animation (Kreuz fertig nach etwa 1,4 Sekunden). */
  incorrectFeedbackMs: 1_800,
  /** Kurze definierte Pause zwischen Feedback und Loesungsansicht. */
  solutionDelayMs: 250,
  /**
   * Bestaetigte Enthuellungsdauer beim Bilderkennen: exakt zehn Sekunden.
   * Dies ist der einzige Timingwert, der laut Spezifikation bindend ist.
   */
  imageRevealDurationMs: 10_000,
  /**
   * Dauer des Pausen-/Logoscreens zwischen zwei Fragen.
   *
   * Er kuendigt Fragenummer und Rubrik an. Anderthalb Sekunden reichten dafuer
   * nicht: Die Rubrik blendet ein, und der Saal soll sie lesen koennen, bevor die
   * Frage steht.
   */
  pauseScreenMs: 3_000,
} as const

/**
 * Das Raster des Bilderkennens.
 *
 * Das Bild liegt unter einer Decke aus Kacheln, die waehrend der Enthuellung
 * eine nach der anderen verschwindet. Alle Werte, die diese Aufloesung bestimmen,
 * stehen hier - Rastergroesse, Reihenfolge und Kachelbewegung. Wer das Bild
 * anders aufdecken will, aendert nichts anderes als diese Zahlen.
 *
 * Warum fachlich und nicht rein visuell: Die Reihenfolge entscheidet, WAS ein
 * Spieler wann sieht. Sie gehoert damit zur Fairness und wird aus dem
 * Fortschritt abgeleitet, nicht aus einer nebenherlaufenden Animation.
 */
export const revealGrid = {
  columns: 6,
  rows: 4,
  /**
   * Anteil des Zufalls an der Reihenfolge.
   *
   * 0 deckt streng von aussen nach innen auf - erkennbar als wandernder Ring und
   * damit langweilig. 1 wuerde rein zufaellig aufdecken und das Motiv womoeglich
   * sofort preisgeben. Dazwischen entsteht das Bild des Entwurfs: verstreute
   * Kacheln, deren Mitte sich zuletzt schliesst.
   */
  jitter: 0.55,
  /**
   * Wo das Motiv vermutet wird, in Anteilen der Bildbreite und -hoehe.
   *
   * Ohne Bildanalyse ist das eine Annahme, aber eine tragfaehige: Fotos setzen
   * ihr Motiv in die Mitte, und der Himmel liegt oben. Der Punkt sitzt deshalb
   * etwas unterhalb der Mitte - dort, wo Gebaeude, Gesichter und Wahrzeichen
   * stehen, waehrend die Randkacheln fruehes Beiwerk zeigen.
   */
  focus: { x: 0.5, y: 0.58 },
  /** Dauer, in der eine einzelne Kachel verschwindet. */
  tileFadeMs: 320,
} as const

/**
 * Timings, die es nur im Selbstbedienungsprofil gibt.
 *
 * Sie ersetzen genau die Stellen, an denen sonst ein Mensch weiterschaltet. Sie
 * sind deshalb fachlich relevant und stehen hier - nicht in der Praesentation.
 */
export const selfServiceTiming = {
  /** Wie lange die Loesung stehen bleibt, bevor es von selbst weitergeht. */
  solutionHoldMs: 4_000,
  /** Kurzer Vorlauf, bevor ein Video von selbst startet. */
  videoLeadInMs: 500,
  /**
   * Zuschlag nach dem gemeldeten Ende eines Videos, bevor die Frage erscheint.
   * Er deckt Ausspielverzoegerungen ab.
   */
  videoTailMs: 400,
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
  /**
   * Zulaessige Anzahl Antwortoptionen einer Auswahlfrage.
   *
   * Unter zwei Optionen gibt es nichts zu waehlen - eine einzelne "Auswahl" waere
   * die Loesung selbst. Solche Fragen gehoeren als freie Antwort in
   * `acceptedAnswerText`. Nach oben begrenzt der Entwurf: vier Zeilen mit den
   * Buchstaben A bis D.
   */
  minChoiceOptionCount: 2,
  maxChoiceOptionCount: 4,
} as const

export type ScoringRules = typeof scoringRules
export type GameTiming = typeof gameTiming
export type SelfServiceTiming = typeof selfServiceTiming

/**
 * Ein Raster, das sich vom voreingestellten unterscheiden darf.
 *
 * Die Funktionen der Domain nehmen diesen Typ und nicht die Konstante: So laesst
 * sich die Aufloesung in Tests mit einem winzigen Raster pruefen, ohne die
 * Voreinstellung anzufassen.
 */
export interface RevealGrid {
  columns: number
  rows: number
  jitter: number
  focus: { x: number; y: number }
  tileFadeMs: number
}
