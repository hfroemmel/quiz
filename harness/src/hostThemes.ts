/**
 * The themes of the harness's own hosts.
 *
 * COLOUR VALUES ARE THE POINT HERE, and that is why they may stand in this
 * file. Everywhere else in this repository they belong in
 * `packages/themes/src/palettes.ts` - a surface of the packages that names a
 * tone has a second source of truth. A HOST is the other case: its design is
 * its own, it passes it in as a `ThemeDefinition`, and the whole purpose of
 * this file is to show that.
 *
 * The two designs are deliberately far apart - a leak between two quizzes on
 * one page has to be visible, not plausible (see `ThemedPair`).
 */
import type { ThemeDefinition } from '@hfroemmel/quiz-themes'

/** A foyer device in house colours: green where the package is blue. */
export const foyerTheme: ThemeDefinition = {
  id: 'foyer',
  base: 'bright',
  /*
   * Only the stage is named - the start menu follows it: in the light variant
   * the selected card carries the accent and the button the green, and
   * `resolveTheme` applies that relationship after the override.
   */
  tokens: { colors: { accent: '#00854a', primary: '#7a1f6e' } },
}

/** And one for a dark room, with a warm accent - same package, another hall. */
export const hallTheme: ThemeDefinition = {
  id: 'hall',
  base: 'dark',
  tokens: { colors: { accent: '#c8531a' }, start: { green: '#c8531a', 'green-light': '#c8531a', 'green-deep': '#c8531a' } },
}
