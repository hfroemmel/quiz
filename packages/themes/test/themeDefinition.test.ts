/**
 * A theme says the same thing as the stylesheet - or it is a second copy.
 *
 * The generated `palette.css` is what the packages read today; `resolveTheme`
 * is what a host will pass in. Both come from `palettes.ts`, and this file
 * checks that they really do: every value of a built-in theme is compared
 * against the rule of the stylesheet that carries it. A theme that drifted
 * would not be a wrong colour somewhere - it would be two sources of truth
 * again, which is the mistake this package exists to prevent.
 */
import { describe, expect, it } from 'vitest'
import { paletteStyleSheet } from '../src/paletteStylesheet'
import {
  brightTheme,
  builtInThemes,
  darkTheme,
  kidsTheme,
  resolveTheme,
  themeDefinitionSchema,
  themeStyles,
  type ThemeDefinition,
} from '../src/themeDefinition'

/** The custom properties of one rule of the generated stylesheet. */
function declarations(selector: string): Record<string, string> {
  const sheet = paletteStyleSheet()
  const start = sheet.indexOf(`${selector} {`)
  expect(start, selector).toBeGreaterThan(-1)
  const body = sheet.slice(start + selector.length + 2, sheet.indexOf('}', start))
  const entries = body
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('--'))
    .map((line) => {
      const [name, ...rest] = line.replace(/;$/, '').split(':')
      return [name!.trim(), rest.join(':').trim()] as const
    })
  return Object.fromEntries(entries)
}

/** Only the tokens of one family, so the two sides can be compared directly. */
function family(variables: Record<string, string>, prefix: string): Record<string, string> {
  return Object.fromEntries(
    Object.entries(variables)
      .filter(([name]) => name.startsWith(prefix))
      .map(([name, value]) => [name.replace(/^--/, ''), value]),
  )
}

describe('the built-in themes carry the values of the stylesheet', () => {
  const fallback = declarations(':root')
  const brightStage = declarations('.stage--default.stage--bright')
  const brightStart = declarations("[data-quiz-game][data-theme='bright']")

  it('the dark stage is the fallback layer, token for token', () => {
    const dark = resolveTheme(darkTheme)
    for (const [name, value] of Object.entries(family(dark.variables, '--color-'))) {
      expect(fallback[`--${name}`], name).toBe(value)
    }
    for (const [name, value] of Object.entries(family(dark.variables, '--stage-'))) {
      expect(fallback[`--${name}`], name).toBe(value)
    }
  })

  it('the light stage is the fallback plus exactly the light rule', () => {
    const bright = resolveTheme(brightTheme)
    const colors = family(bright.variables, '--color-')
    for (const [name, value] of Object.entries(colors)) {
      // What the light rule names comes from there, everything else from the fallback.
      expect(value, name).toBe(brightStage[`--${name}`] ?? fallback[`--${name}`])
    }
    // And it really does differ - otherwise this test would prove nothing.
    expect(Object.keys(brightStage).length).toBeGreaterThan(3)
  })

  it('the start menu follows the same two layers', () => {
    const bright = family(resolveTheme(brightTheme).variables, '--start-')
    for (const [name, value] of Object.entries(bright)) {
      expect(value, name).toBe(brightStart[`--${name}`] ?? fallback[`--${name}`])
    }

    const dark = family(resolveTheme(darkTheme).variables, '--start-')
    for (const [name, value] of Object.entries(dark)) {
      expect(fallback[`--${name}`], name).toBe(value)
    }
  })

  it('the children world keeps its own paper and its own hand', () => {
    const kids = resolveTheme(kidsTheme)
    expect(kids.skin).toBe('kids')
    expect(kids.scene.headingFont).toContain('Patrick Hand')
    /*
     * The light variant belongs to the adults' stage: the children's world
     * brings its paper along, and a light version of it would be a second
     * drawing rather than a second palette.
     */
    expect(kids.variables['--color-pageTop']).not.toBe(brightStage['--color-pageTop'])
  })

  it('reports the scene theme the components read today', () => {
    const bright = resolveTheme(brightTheme)
    expect(bright.scene.skin).toBe('default')
    expect(bright.scene.colors.pageTop).toBe(bright.variables['--color-pageTop'])
    expect(bright.variables['--font-heading']).toBe(bright.scene.headingFont)
  })
})

describe('what a theme may override', () => {
  const own: ThemeDefinition = {
    id: 'foyer',
    base: 'bright',
    tokens: { colors: { accent: '#123456' }, start: { green: '#654321' }, stage: { inkOutline: '#000fff' } },
    typography: { display: "'Fraktur', serif", fonts: [{ family: 'Fraktur', src: "url('/f.woff2')", weight: 700 }] },
    assets: { wordmark: '/wordmark.svg' },
    motion: 'reduced',
  }

  it('replaces exactly what it names, in every family', () => {
    const theme = resolveTheme(own)
    expect(theme.variables['--color-accent']).toBe('#123456')
    expect(theme.variables['--start-green']).toBe('#654321')
    expect(theme.variables['--stage-inkOutline']).toBe('#000fff')
    // Its neighbours stay what the built-in says.
    expect(theme.variables['--color-text']).toBe(resolveTheme(brightTheme).variables['--color-text'])
  })

  it('carries voice, fonts, drawings and motion through', () => {
    const theme = resolveTheme(own)
    expect(theme.variables['--font-heading']).toBe("'Fraktur', serif")
    // What it says nothing about keeps the voice of its world.
    expect(theme.variables['--font-body']).toBe(resolveTheme(brightTheme).variables['--font-body'])
    expect(theme.assets.wordmark).toBe('/wordmark.svg')
    expect(theme.motion).toBe('reduced')
  })

  it('writes its fonts as rules, with the package rule for the exchange', () => {
    const css = themeStyles(resolveTheme(own))
    expect(css).toContain("font-family: 'Fraktur';")
    expect(css).toContain("src: url('/f.woff2');")
    expect(css).toContain('font-weight: 700;')
    // Never `swap`: a typeface exchanged mid-question is worse than a late one.
    expect(css).toContain('font-display: block;')
    expect(themeStyles({ fonts: [] })).toBe('')
  })
})

describe('the schema of a theme', () => {
  it('accepts the built-ins', () => {
    for (const theme of Object.values(builtInThemes)) {
      expect(themeDefinitionSchema.parse(theme)).toEqual(theme)
    }
  })

  it('refuses a colour name the stage does not have', () => {
    // `accentColor` instead of `accent` would silently change nothing.
    expect(() => themeDefinitionSchema.parse({ id: 'x', base: 'bright', tokens: { colors: { accentColor: '#fff' } } }))
      .toThrow()
  })

  it('refuses a token group it does not know', () => {
    expect(() => themeDefinitionSchema.parse({ id: 'x', base: 'bright', tokens: { colours: {} } })).toThrow()
  })

  it('refuses a base it cannot start from', () => {
    expect(() => themeDefinitionSchema.parse({ id: 'x', base: 'paper' })).toThrow()
  })
})
