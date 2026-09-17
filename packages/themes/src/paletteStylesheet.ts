/**
 * The palette's colours as CSS rules.
 *
 * NO COLOUR VALUE LIVES HERE. All values come from `@quiz/contracts`
 * (`theme.ts`); this file only translates them into text. It is written out
 * as `src/palette.css` - see `pnpm palette:build`.
 *
 * WHY GENERATED AND NOT HAND-WRITTEN: The same values must also go into the
 * quiz package that the server ships per mode. A hand-written stylesheet
 * would inevitably be a second copy - exactly the duplication that once
 * drifted apart unnoticed.
 *
 * WHY A FILE AND NOT A RUNTIME STYLE TAG: The stage's background is painted
 * from `--color-pageTop`. If the variable only arrived with the JavaScript,
 * there would be an image without colour beforehand - a white flash on a
 * projector.
 *
 * WHICH RULES ARE PRODUCED, AND WHY ONLY THESE:
 *
 *   :root                          fallback level, until the server's first
 *                                  snapshot arrives.
 *   .stage--default.stage--bright  the light variant of the stage. It MUST
 *                                  sit on the stage element itself: the
 *                                  theme colours arrive as inline variables
 *                                  on the frame, and a declaration of its
 *                                  own beats an inherited value.
 *   .stage--default.stage--red     the red variant, for the same reason and in
 *                                  the same place. It names only the ground;
 *                                  everything else stays the dark variant's,
 *                                  which is where it comes from.
 *   [data-quiz-game][data-theme]   the light and the red variant of the start
 *                                  screen. It sits ABOVE the stage and
 *                                  therefore cannot read its class; the
 *                                  variant sits on the device's root element
 *                                  as an attribute. A data attribute and not a
 *                                  class, because this stylesheet is generated
 *                                  and the components' classes are hashed.
 *   [data-quiz-overview]           the dark and the red variant of the offer
 *                                  overview - the screen the room shows while
 *                                  no game is running. Its light set is the
 *                                  fallback level above, so only the two
 *                                  others need a rule of their own.
 *
 * For the stage's dark variant and the kids world, DELIBERATELY no rule is
 * produced: their colours are supplied by the running quiz's theme. A rule here
 * would lock out a theme with its own colours. The overview is different - it
 * stands BEFORE the choice of a quiz and therefore carries no theme that could
 * be locked out.
 */
import {
  brightPalette,
  brightStartPalette,
  darkQuizSelectPalette,
  quizSelectPalette,
  redPalette,
  redQuizSelectPalette,
  redStartPalette,
  stageExtras,
  stagePalettes,
  startPalette,
  uiPalette,
} from './palettes'

const HEADER = `/*
 * GENERATED - DO NOT EDIT BY HAND.
 *
 * Source of all values: packages/themes/src/palettes.ts
 * Regenerate:           pnpm palette:build
 *
 * Whoever changes a colour value here changes it only on the surface: in
 * operation the stage colours come from the quiz package, which is built from
 * the same source. The next run overwrites the change, and the test
 * packages/themes/test/palette.test.ts reports it beforehand.
 */`

function block(selector: string, entries: Record<string, string>): string {
  const lines = Object.entries(entries).map(([name, value]) => `  --${name}: ${value};`)
  return `${selector} {\n${lines.join('\n')}\n}`
}

/** The prefix says who the colour belongs to - the mode, the layout, or the direction. */
function prefixed(entries: Record<string, string>, prefix: string): Record<string, string> {
  return Object.fromEntries(Object.entries(entries).map(([name, value]) => [`${prefix}${name}`, value]))
}

/** The full content of `src/palette.css`. */
export function paletteStyleSheet(): string {
  return [
    HEADER,
    '',
    '/* Fallback layer: the adults stage, dark - plus everything that belongs to no theme. */',
    block(':root', {
      ...prefixed(stagePalettes.default, 'color-'),
      ...prefixed(stageExtras, 'stage-'),
      ...prefixed(uiPalette, 'ui-'),
      ...prefixed(startPalette, 'start-'),
      ...prefixed(quizSelectPalette, 'quiz-select-'),
    }),
    '',
    '/* Light version of the adults stage - only surfaces, edges and type. */',
    block('.stage--default.stage--bright', prefixed(brightPalette as Record<string, string>, 'color-')),
    '',
    '/* Red version of the adults stage - the dark one with its ground exchanged. */',
    block('.stage--default.stage--red', prefixed(redPalette as Record<string, string>, 'color-')),
    '',
    '/* Light version of the start selection in front of it - only what differs from the dark one. */',
    block("[data-quiz-game][data-theme='bright']", prefixed(brightStartPalette as Record<string, string>, 'start-')),
    '',
    '/* And its red version - the ground, and the two lights switched off. */',
    block("[data-quiz-game][data-theme='red']", prefixed(redStartPalette as Record<string, string>, 'start-')),
    '',
    '/* The offer overview on a dark and on a red ground - the cards stay as they are. */',
    block(
      "[data-quiz-overview][data-theme='dark']",
      prefixed(darkQuizSelectPalette as Record<string, string>, 'quiz-select-'),
    ),
    '',
    block(
      "[data-quiz-overview][data-theme='red']",
      prefixed(redQuizSelectPalette as Record<string, string>, 'quiz-select-'),
    ),
    '',
  ].join('\n')
}
