/**
 * Das Farb-VOKABULAR der Buehne: die Token, die jedes Theme belegen muss.
 *
 * Die konkreten Werte - Gestaltungswelten, helle Fassung, Bedienrahmen - stehen
 * seit der Paketierung in `@hfroemmel/quiz-themes`: Darstellung ist Sache des
 * Gastgebers, der Kern kennt nur die Struktur.
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
