/**
 * Farbtoken des Designsystems (Designergaenzung, `docs/design-system.md`).
 *
 * WARUM HIER: Die Tokenliste ist Vertrag zwischen drei Seiten - dem Quizpaket,
 * das die Werte liefert, der Inhaltsvalidierung, die Vollstaendigkeit prueft,
 * und der Oberflaeche, die daraus CSS-Custom-Properties macht. Es gibt sie
 * deshalb genau einmal.
 *
 * Ein Theme muss ALLE Token tragen. Ein fehlendes Token waere kein kleiner
 * Schoenheitsfehler, sondern eine Flaeche ohne Farbe auf der Buehne; die
 * Validierung meldet es als Fehler.
 */
export const designColorTokens = [
  /* Grundflaechen */
  'pageTop',
  'pageBottom',
  'stageTop',
  'stageBottom',
  'controls',
  /* Kacheln und Schaltflaechen */
  'tile',
  'tileDisabled',
  'tileQuiet',
  'option',
  /* Bedeutungsfarben */
  'accent',
  'accentQuiet',
  'primary',
  'solution',
  'solutionChip',
  'correct',
  'incorrect',
  /* Schrift */
  'text',
  'textMuted',
] as const

export type DesignColorToken = (typeof designColorTokens)[number]

/** Vollstaendiger Tokensatz eines Themes. */
export type DesignColors = Record<DesignColorToken, string>

export function missingColorTokens(colors: Record<string, string>): DesignColorToken[] {
  return designColorTokens.filter((token) => !colors[token])
}
