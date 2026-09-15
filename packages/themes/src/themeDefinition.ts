/**
 * A theme as ONE object - what a host passes in, and nothing it has to copy.
 *
 * WHY THIS EXISTS. A host that wanted its own look had to know four things: the
 * scene theme for `<QuizScene>` (`sceneThemes`), the stylesheet with the
 * `--start-*` tokens of the start screen, the font stacks, and the word mark as
 * a property. Three of the four are presentation of the SAME design, and where
 * they could not be reached they were copied - the media table repeated three
 * colour values as SCSS variables with the comment that whoever changes them
 * there changes them here by hand.
 *
 * A `ThemeDefinition` states all of it once: which built-in set it starts from,
 * what it overrides, which fonts it brings, which drawings. `resolveTheme`
 * turns it into the values the components read - and nothing else in the
 * package knows a colour.
 *
 * WHAT IS DELIBERATELY NOT HERE:
 *
 *   - The GEOMETRY of the scenes and of the children's world. `skin` chooses a
 *     world, it does not configure one: a different arrangement is a new world,
 *     not a theme.
 *   - Timings that carry game meaning (`gameTiming`, the reveal grid). They are
 *     fairness, not taste.
 *   - The operator's chrome (`--ui-*`). It is a tool, seen for hours at a desk,
 *     and it is not part of what the room sees.
 *
 * WHY THE TOKEN GROUPS STILL CARRY THEIR OLD NAMES. The migration plan (G.3)
 * renames the token families by role - `surface`, `ink`, `accent`, `action`.
 * That rename touches every stylesheet of the packages, so it belongs with that
 * sweep and not here: this file gives a host ONE object, in the vocabulary its
 * stylesheets already speak.
 */
import { z } from 'zod'
import { designColorTokens, type DesignColors, type ThemeSkin } from '@hfroemmel/quiz-core'
import {
  brightPalette,
  brightStartPalette,
  stageExtras,
  stagePalettes,
  startPalette,
} from './palettes'
import { bodyStack, headingStack, type QuizSceneTheme } from './sceneTheme'

/** A font the theme brings along - emitted as `@font-face` by `themeStyles`. */
export interface ThemeFontFace {
  family: string
  /** Complete `src` value, so a host can name its own format and fallbacks. */
  src: string
  weight?: number
  style?: 'normal' | 'italic'
  /**
   * The range of characters this file covers. The validator asks for it where a
   * theme brings fonts for more than one script - a font without the glyphs of
   * a registered language is the one language rule a theme has (G.7).
   */
  unicodeRange?: string
}

/**
 * The four surfaces a theme may recolour.
 *
 * They are the groups the palettes already have, and each of them is a
 * complete set in the built-ins: an override names only what differs.
 */
export interface ThemeTokenOverrides {
  /** The stage: surfaces, tiles, meaning colours, type (`--color-*`). */
  colors?: Partial<DesignColors>
  /** What sits on the stage without belonging to a scene (`--stage-*`). */
  stage?: Record<string, string>
  /** The start menu in front of it (`--start-*`). */
  start?: Record<string, string>
}

/** Drawings and images a theme brings. Paths are resolved by the host. */
export interface ThemeAssets {
  /** The word mark in the stage header - replaces the property of quiz-react. */
  wordmark?: string
  /** Motif of the start board where the content brings none. */
  startVisual?: string
}

export interface ThemeDefinition {
  /** Matches a `themes[].id` of the content, so a package can ask for it. */
  id: string
  /** Which built-in token set it starts from. */
  base: 'bright' | 'dark'
  /** Design world - the layout, not the colours. */
  skin?: ThemeSkin
  tokens?: ThemeTokenOverrides
  typography?: {
    /** Headings, question boards, numbers - the voice of the room. */
    display?: string
    /** Running text and controls. */
    body?: string
    fonts?: ThemeFontFace[]
  }
  assets?: ThemeAssets
  /**
   * `reduced` shortens every transition to a minimum - for a setup that has to
   * stand still, on top of what the operating system already asks for.
   */
  motion?: 'default' | 'reduced'
}

/* ------------------------------------------------------------------ *
 * Schema
 * ------------------------------------------------------------------ */

/** A colour value as CSS accepts it - checked for shape, never for taste. */
const colorValue = z.string().min(3)

const tokenMap = z.record(z.string().min(1), colorValue)

export const themeFontFaceSchema = z
  .object({
    family: z.string().min(1),
    src: z.string().min(1),
    weight: z.number().int().min(1).max(1000).optional(),
    style: z.enum(['normal', 'italic']).optional(),
    unicodeRange: z.string().min(1).optional(),
  })
  .strict()

/**
 * The schema of a theme.
 *
 * `strict` on every level: a misspelled token group would otherwise be read as
 * "changes nothing" and leave the host searching for a colour that never
 * arrives. The colour names of the stage are checked against the vocabulary of
 * the core for the same reason - a theme that sets `accentColor` instead of
 * `accent` says nothing at all.
 */
export const themeDefinitionSchema = z
  .object({
    id: z.string().min(1),
    base: z.enum(['bright', 'dark']),
    skin: z.enum(['default', 'kids']).optional(),
    tokens: z
      .object({
        colors: z.record(z.enum(designColorTokens), colorValue).optional(),
        stage: tokenMap.optional(),
        start: tokenMap.optional(),
      })
      .strict()
      .optional(),
    typography: z
      .object({
        display: z.string().min(1).optional(),
        body: z.string().min(1).optional(),
        fonts: z.array(themeFontFaceSchema).optional(),
      })
      .strict()
      .optional(),
    assets: z
      .object({
        wordmark: z.string().min(1).optional(),
        startVisual: z.string().min(1).optional(),
      })
      .strict()
      .optional(),
    motion: z.enum(['default', 'reduced']).optional(),
  })
  .strict()

/* ------------------------------------------------------------------ *
 * The three built-in themes
 * ------------------------------------------------------------------ */

/**
 * The light stage - the documented default and the one the start menu was
 * designed on.
 */
export const brightTheme: ThemeDefinition = { id: 'default', base: 'bright' }

/** The same stage in the dark - the variant for a hall with a projector. */
export const darkTheme: ThemeDefinition = { id: 'default-dark', base: 'dark' }

/**
 * The children's world: drawn paper, and its own hand as the typeface.
 *
 * It carries no `base`-independent colours of its own here - the world's values
 * live in its stylesheets (`.stage--kids`), because they are drawings and not a
 * palette. What the theme decides is the world and the voice.
 */
export const kidsTheme: ThemeDefinition = {
  id: 'kids',
  base: 'bright',
  skin: 'kids',
  typography: { display: headingStack.kids, body: bodyStack.kids },
}

/** The built-ins by id, for a host that only knows the name of its theme. */
export const builtInThemes: Record<string, ThemeDefinition> = {
  [brightTheme.id]: brightTheme,
  [darkTheme.id]: darkTheme,
  [kidsTheme.id]: kidsTheme,
}

/* ------------------------------------------------------------------ *
 * Resolution
 * ------------------------------------------------------------------ */

export interface ResolvedTheme {
  id: string
  skin: ThemeSkin
  /** What `<QuizScene>` and `<QuizGame>` read today. */
  scene: QuizSceneTheme
  /**
   * Every custom property this theme sets - the stage, what sits above it and
   * the start menu, plus the two font stacks. This is what a host puts on the
   * quiz's own element, so two quizzes on one page cannot recolour each other.
   */
  variables: Record<string, string>
  fonts: ThemeFontFace[]
  assets: ThemeAssets
  motion: 'default' | 'reduced'
}

/**
 * Turn a definition into values.
 *
 * ORDER, AND WHY: the built-in set of the base comes first, then the world's
 * (`skin`), then what the theme overrides. The light variant is a SET OF ITS
 * OWN and not a few exceptions: `brightPalette` names what differs from the
 * dark stage, `brightStartPalette` what differs from the dark start screen -
 * both are laid over their dark set here, exactly as the generated stylesheet
 * does it with its two extra rules.
 */
export function resolveTheme(definition: ThemeDefinition): ResolvedTheme {
  const skin = definition.skin ?? 'default'
  const bright = definition.base === 'bright'

  const colors: DesignColors = {
    ...stagePalettes[skin],
    /*
     * The light variant belongs to the ADULTS' stage. The children's world
     * brings its own paper and knows no such switch - a light variant of it
     * would be a second drawing, not a second palette.
     */
    ...(bright && skin === 'default' ? (brightPalette as Partial<DesignColors>) : {}),
    ...definition.tokens?.colors,
  }
  const stage = { ...stageExtras, ...definition.tokens?.stage }
  const start = {
    ...startPalette,
    ...(bright ? (brightStartPalette as Record<string, string>) : {}),
    ...definition.tokens?.start,
  }

  const display = definition.typography?.display ?? headingStack[skin]
  const body = definition.typography?.body ?? bodyStack[skin]

  const variables: Record<string, string> = {
    ...prefixed(colors, '--color-'),
    ...prefixed(stage, '--stage-'),
    ...prefixed(start, '--start-'),
    '--font-heading': display,
    '--font-body': body,
  }

  return {
    id: definition.id,
    skin,
    scene: { skin, colors, headingFont: display, bodyFont: body },
    variables,
    fonts: definition.typography?.fonts ?? [],
    assets: definition.assets ?? {},
    motion: definition.motion ?? 'default',
  }
}

function prefixed(entries: Record<string, string>, prefix: string): Record<string, string> {
  return Object.fromEntries(Object.entries(entries).map(([name, value]) => [`${prefix}${name}`, value]))
}

/**
 * The theme's fonts as `@font-face` rules.
 *
 * `font-display: block` and not `swap`, as in the package's own stylesheet: a
 * typeface exchanged in the middle of a question would be more noticeable than
 * a moment without text.
 */
export function themeStyles(theme: Pick<ResolvedTheme, 'fonts'>): string {
  return theme.fonts
    .map((font) =>
      [
        '@font-face {',
        `  font-family: ${quoted(font.family)};`,
        `  src: ${font.src};`,
        ...(font.weight === undefined ? [] : [`  font-weight: ${font.weight};`]),
        `  font-style: ${font.style ?? 'normal'};`,
        ...(font.unicodeRange === undefined ? [] : [`  unicode-range: ${font.unicodeRange};`]),
        '  font-display: block;',
        '}',
      ].join('\n'),
    )
    .join('\n\n')
}

/** A family name goes in quotes unless the host already quoted it. */
function quoted(family: string): string {
  return /^['"]/.test(family) ? family : `'${family}'`
}
