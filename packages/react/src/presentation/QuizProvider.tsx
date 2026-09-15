/**
 * The theme of ONE quiz, on ONE element.
 *
 * WHY A PROVIDER AND NOT A STYLESHEET. The package's `palette.css` declares its
 * values on `:root` - the fallback layer for a page that shows one quiz. A host
 * that wants its own design had to overwrite those values on the document, and
 * two quizzes on one page (a game collection, a comparison view) could then
 * only ever have ONE look; whichever declaration came last won for both.
 *
 * `QuizProvider` puts the theme where the quiz is: its variables sit on this
 * element, and CSS custom properties inherit downwards only. Two providers side
 * by side therefore cannot recolour each other, which closes the open point
 * "CSS encapsulation" of `docs/mehrkontext-architektur.md`.
 *
 * `display: contents` keeps the element out of the layout: it carries values,
 * not a box.
 *
 * WHAT IT DOES NOT DECIDE: which WORLD is played. That comes from the content
 * (`view.theme.skin`) and is a layout, not a palette - a host theme for the
 * adults' stage does not recolour the children's paper, and a component asks
 * for the theme of the world it is showing (`themeForSkin`).
 */
import { createContext, useContext, useMemo, type CSSProperties, type ReactNode } from 'react'
import type { ThemeSkin } from '@hfroemmel/quiz-core'
import {
  resolveTheme,
  sceneThemes,
  themeStyles,
  type QuizSceneTheme,
  type ResolvedTheme,
  type ThemeDefinition,
} from '@hfroemmel/quiz-themes'

const ThemeContext = createContext<ResolvedTheme | null>(null)

/**
 * Which parts of the frame the quiz supplies itself.
 *
 * A host that has its own control bar carries the word mark, the way back and
 * its settings there - and hid the quiz's with `display: none`, three rules
 * that had to be kept in step with the package's markup. It says it here
 * instead, and what it takes over is not rendered at all.
 */
export interface QuizChrome {
  /** The word mark in the stage header. */
  brand?: boolean
  /** The button that ends a running game from the device. */
  abort?: boolean
  /** The gear that opens the device's settings. */
  settings?: boolean
}

const fullChrome: Required<QuizChrome> = { brand: true, abort: true, settings: true }

const ChromeContext = createContext<Required<QuizChrome>>(fullChrome)

/** The host's theme, where there is one. */
export function useQuizTheme(): ResolvedTheme | null {
  return useContext(ThemeContext)
}

/** Which parts of the frame the quiz shows. Without a host: all of them. */
export function useQuizChrome(): Required<QuizChrome> {
  return useContext(ChromeContext)
}

/**
 * The theme for one world - the host's where it is meant for that world, the
 * package's otherwise.
 *
 * A host states the design of ITS world; the second world of a package keeps
 * the drawing that belongs to it. Without that rule, a host theme for the
 * adults' stage would paint the children's paper in its colours.
 */
export function themeForSkin(host: ResolvedTheme | null, skin: ThemeSkin): QuizSceneTheme {
  return host && host.skin === skin ? host.scene : sceneThemes[skin]
}

export interface QuizProviderProps {
  /**
   * The design of this quiz. Without one, the package's own applies - so a
   * host that wants nothing of it needs no provider either.
   */
  theme?: ThemeDefinition | undefined
  /**
   * What the host supplies itself. Named parts are left out of the quiz's
   * frame; everything unnamed stays as it is.
   */
  chrome?: QuizChrome | undefined
  children: ReactNode
}

export function QuizProvider({ theme, chrome, children }: QuizProviderProps) {
  const resolved = useMemo(() => (theme ? resolveTheme(theme) : null), [theme])
  /*
   * The fonts are written as rules, once per theme. They are deliberately NOT
   * scoped: `@font-face` registers a family for the document - a font cannot be
   * local to an element, and two quizzes with the same family name would be
   * asking for the same file anyway.
   */
  const fontRules = useMemo(() => (resolved ? themeStyles(resolved) : ''), [resolved])
  const parts = useMemo(() => ({ ...fullChrome, ...chrome }), [chrome])

  const inner = <ChromeContext.Provider value={parts}>{children}</ChromeContext.Provider>
  if (!resolved) return inner

  return (
    <div
      style={{ display: 'contents', ...resolved.variables } as CSSProperties}
      data-quiz-theme={resolved.id}
      data-quiz-skin={resolved.skin}
      data-quiz-motion={resolved.motion}
    >
      {fontRules !== '' && <style>{fontRules}</style>}
      <ThemeContext.Provider value={resolved}>{inner}</ThemeContext.Provider>
    </div>
  )
}
