/**
 * The colour VOCABULARY of the stage: the tokens every theme has to fill.
 *
 * The concrete values - design worlds, bright variant, control chrome - live in
 * `@hfroemmel/quiz-themes` since the packaging: presentation is the host's
 * concern, the core knows only the structure.
 */

export const designColorTokens = [
  /* Base surfaces */
  'pageTop',
  'pageBottom',
  'stageTop',
  'stageBottom',
  'controls',
  /* Tiles and controls */
  'tile',
  'tileDisabled',
  'tileQuiet',
  'option',
  /* Semantic colours */
  'accent',
  'accentQuiet',
  'primary',
  'solution',
  'solutionChip',
  'correct',
  'incorrect',
  /* Type */
  'text',
  'textMuted',
] as const

export type DesignColorToken = (typeof designColorTokens)[number]

/** Complete token set of a theme. */
export type DesignColors = Record<DesignColorToken, string>

export function missingColorTokens(colors: Record<string, string>): DesignColorToken[] {
  return designColorTokens.filter((token) => !colors[token])
}
