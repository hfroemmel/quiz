/**
 * Die Darstellungs-Themes der Buehne - der Keim von `@hfroemmel/quiz-themes`.
 *
 * Seit die View-Modelle keine Farben und Schriften mehr tragen (Darstellung ist
 * Sache des Gastgebers), entsteht das Theme HIER: aus der Gestaltungswelt, die
 * der Inhalt empfiehlt (`view.theme.skin`), und den Paletten aus
 * `@quiz/contracts`. Ein Gastgeber kann `<QuizScene>` auch ein eigenes Theme
 * geben; die Tabelle unten ist der Standard.
 *
 * HIER STEHT KEIN FARBWERT - alle Werte kommen aus `theme.ts` der Contracts.
 * Die Schriftstapel sind Darstellung und stehen deshalb genau hier, nicht mehr
 * im Quizpaket.
 */
import { resolveThemeColors, type DesignColors, type PublicQuizViewModel, type ThemeSkin } from '@hfroemmel/quiz-core'

export interface QuizSceneTheme {
  /** Gestaltungswelt der Buehne - traegt Klassen, Assets und Palette. */
  skin: ThemeSkin
  colors: DesignColors
  headingFont: string
  bodyFont: string
}

/*
 * Dieselben Stapel wie zuvor im Quizpaket (`typography` je Theme) und in
 * `tokens.css` - die Umstellung darf kein Schriftbild aendern.
 */
const serifStack = "'Melior', 'Palatino Linotype', Palatino, Georgia, 'Times New Roman', serif"
const handStack = "'Patrick Hand', 'Comic Sans MS', cursive"

export const sceneThemes: Record<ThemeSkin, QuizSceneTheme> = {
  default: {
    skin: 'default',
    colors: resolveThemeColors({ skin: 'default' }),
    headingFont: serifStack,
    bodyFont: serifStack,
  },
  kids: {
    skin: 'kids',
    colors: resolveThemeColors({ skin: 'kids' }),
    headingFont: handStack,
    bodyFont: handStack,
  },
}

/** Standard-Theme zur Empfehlung des Inhalts. */
export function themeForView(view: PublicQuizViewModel): QuizSceneTheme {
  return sceneThemes[view.theme.skin ?? 'default']
}

/**
 * Theme als CSS-Custom-Properties.
 *
 * WICHTIG - GEHOERT AUF DEN RAHMEN, NICHT AUF DIE BUEHNE: Die Werte kommen als
 * Inline-Stil, und ein Inline-Stil schlaegt jede Klassenregel. Stuenden sie an
 * der Buehne selbst, koennte `.stage--bright` seine Farben nicht mehr setzen.
 * Vom umgebenden Rahmen aus werden sie geerbt - und eine Angabe am Element
 * sticht jeden geerbten Wert. `<QuizScene>` uebernimmt genau das.
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
