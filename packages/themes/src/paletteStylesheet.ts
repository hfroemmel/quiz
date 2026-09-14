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
 *   [data-quiz-game][data-theme]   the light variant of the start screen. It
 *                                  sits ABOVE the stage and therefore cannot
 *                                  read its class; the variant sits on the
 *                                  device's root element as an attribute. A
 *                                  data attribute and not a class, because
 *                                  this stylesheet is generated and the
 *                                  components' classes are hashed.
 *
 * For the dark variant and the kids world, DELIBERATELY no rule is produced:
 * their colours are supplied by the running quiz's theme. A rule here would
 * lock out a theme with its own colours.
 */
import {
  brightPalette,
  brightStartPalette,
  quizSelectPalette,
  stageExtras,
  stagePalettes,
  startPalette,
  uiPalette,
} from './palettes'

const HEADER = `/*
 * ERZEUGT - NICHT VON HAND BEARBEITEN.
 *
 * Quelle aller Werte: packages/themes/src/palettes.ts
 * Neu schreiben:      pnpm palette:build
 *
 * Wer hier einen Farbwert aendert, aendert ihn nur an der Oberflaeche: Im Betrieb
 * kommen die Buehnenfarben aus dem Quizpaket, das aus derselben Quelle gebaut
 * wird. Der naechste Lauf ueberschreibt die Aenderung, und der Test
 * packages/themes/test/palette.test.ts meldet sie vorher.
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
    '/* Rueckfallebene: Buehne der Erwachsenen, dunkel - plus alles, was keinem Theme gehoert. */',
    block(':root', {
      ...prefixed(stagePalettes.default, 'color-'),
      ...prefixed(stageExtras, 'stage-'),
      ...prefixed(uiPalette, 'ui-'),
      ...prefixed(startPalette, 'start-'),
      ...prefixed(quizSelectPalette, 'quiz-select-'),
    }),
    '',
    '/* Helle Fassung der Erwachsenenbuehne - nur Flaechen, Kanten und Schrift. */',
    block('.stage--default.stage--bright', prefixed(brightPalette as Record<string, string>, 'color-')),
    '',
    '/* Helle Fassung der Startauswahl davor - nur, was von der dunklen abweicht. */',
    block("[data-quiz-game][data-theme='bright']", prefixed(brightStartPalette as Record<string, string>, 'start-')),
    '',
  ].join('\n')
}
