/**
 * The stage's presentation themes.
 *
 * Since the view models no longer carry colours and fonts (presentation is
 * the host's business), the theme is assembled HERE: from the design world
 * the content recommends (`view.theme.skin`) and this package's palettes.
 * A host can also give `<QuizScene>` its own theme; the table below is the
 * default.
 *
 * NO COLOUR VALUE LIVES HERE - all values come from `palettes.ts`.
 * The font stacks are presentation and therefore live exactly here, no
 * longer in the quiz package.
 */
import type { DesignColors, PublicQuizViewModel, ThemeSkin } from '@hfroemmel/quiz-core'
import { resolveThemeColors } from './palettes'

export interface QuizSceneTheme {
  /** Design world of the stage - carries classes, assets and palette. */
  skin: ThemeSkin
  colors: DesignColors
  headingFont: string
  bodyFont: string
}

/*
 * The same stacks as previously in the quiz package (`typography` per
 * theme) and in `tokens.css` - the switch must not change the typeface.
 */
const serifStack = "'Melior', 'Palatino Linotype', Palatino, Georgia, 'Times New Roman', serif"
const handStack = "'Patrick Hand', 'Comic Sans MS', cursive"

/**
 * The voice of each world, per role.
 *
 * Exported because a theme names the same two stacks (`typography` in
 * `ThemeDefinition`), and a second spelling of them would be a copy that can
 * drift: the day one world changes its typeface, it changes it here.
 */
export const headingStack: Record<ThemeSkin, string> = { default: serifStack, kids: handStack }
export const bodyStack: Record<ThemeSkin, string> = { default: serifStack, kids: handStack }

export const sceneThemes: Record<ThemeSkin, QuizSceneTheme> = {
  default: {
    skin: 'default',
    colors: resolveThemeColors({ skin: 'default' }),
    headingFont: headingStack.default,
    bodyFont: bodyStack.default,
  },
  kids: {
    skin: 'kids',
    colors: resolveThemeColors({ skin: 'kids' }),
    headingFont: headingStack.kids,
    bodyFont: bodyStack.kids,
  },
}

/** Default theme for the content's recommendation. */
export function themeForView(view: PublicQuizViewModel): QuizSceneTheme {
  return sceneThemes[view.theme.skin ?? 'default']
}

/**
 * Theme as CSS custom properties.
 *
 * IMPORTANT - BELONGS ON THE FRAME, NOT ON THE STAGE: the values arrive as
 * an inline style, and an inline style beats every class rule. If they sat
 * on the stage itself, `.stage--bright` could no longer set its colours.
 * They are inherited from the surrounding frame - and a value on the
 * element itself beats any inherited value. `<QuizScene>` does exactly that.
 */
export function themeVariables(theme: QuizSceneTheme): Record<string, string> {
  const variables: Record<string, string> = {}
  for (const [name, value] of Object.entries(theme.colors)) {
    variables[`--color-${name}`] = value
  }
  variables['--font-heading'] = theme.headingFont
  variables['--font-body'] = theme.bodyFont
  return variables
}
