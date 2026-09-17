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
import {
  brightPalette,
  brightStartInkOnStrong,
  brightStartMirrors,
  brightStartPalette,
  stageExtras,
} from '../src/palettes'
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

describe('the menu mirrors the stage', () => {
  it('the table says the same as the light start palette', () => {
    /*
     * `brightStartPalette` states the relationship as a reference taken once;
     * the table states it as data, so it can be applied after a host's
     * overrides. Whoever changes one of the two has to change the other.
     */
    for (const [startToken, stageToken] of Object.entries(brightStartMirrors)) {
      expect((brightStartPalette as Record<string, string>)[startToken], startToken).toBe(
        (brightPalette as Record<string, string>)[stageToken],
      )
    }
    for (const startToken of brightStartInkOnStrong) {
      expect((brightStartPalette as Record<string, string>)[startToken], startToken).toBe(stageExtras.inkOnStrong)
    }
  })

  it('an own stage accent reaches the menu, and the action follows the own green', () => {
    const theme = resolveTheme({
      id: 'foyer',
      base: 'bright',
      tokens: { colors: { accent: '#00854a', primary: '#7a1f6e' } },
    })
    expect(theme.variables['--start-selected']).toBe('#00854a')
    expect(theme.variables['--start-surface-selected']).toBe('#00854a')
    expect(theme.variables['--start-green-light']).toBe('#7a1f6e')
    expect(theme.variables['--start-green-deep']).toBe('#7a1f6e')
  })

  it('but a token the theme names itself has the last word', () => {
    const theme = resolveTheme({
      id: 'foyer',
      base: 'bright',
      tokens: { colors: { accent: '#00854a' }, start: { selected: '#111111' } },
    })
    expect(theme.variables['--start-selected']).toBe('#111111')
    expect(theme.variables['--start-surface-selected']).toBe('#00854a')
  })

  it('the dark menu keeps its own set - there selection and action differ on purpose', () => {
    const theme = resolveTheme({ id: 'hall', base: 'dark', tokens: { colors: { accent: '#c8531a' } } })
    expect(theme.variables['--color-accent']).toBe('#c8531a')
    expect(theme.variables['--start-selected']).not.toBe('#c8531a')
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

/**
 * THE RED VARIANT - the one it is easiest to break without noticing.
 *
 * It is the dark stage with its ground exchanged, and it says that by naming
 * almost nothing. Exactly that is what is checked here: a value that creeps
 * into this rule would be a colour the dark stage does not have, and the three
 * signals - blue for the selection and the player on turn, green for the right
 * answer, red for the wrong one - are the ones that must not move.
 */
describe('the red variant', () => {
  const fallback = declarations(':root')
  const redStage = declarations('.stage--default.stage--red')
  const redStart = declarations("[data-quiz-game][data-theme='red']")
  const darkOverview = declarations("[data-quiz-overview][data-theme='dark']")
  const redOverview = declarations("[data-quiz-overview][data-theme='red']")

  it('names the ground of the stage, and nothing else', () => {
    expect(Object.keys(redStage).sort()).toEqual([
      '--color-controls',
      '--color-pageBottom',
      '--color-pageTop',
      '--color-stageBottom',
      '--color-stageTop',
    ])
    // One tone across all four areas - the veils on top of it make the depth.
    const ground = new Set(Object.values(redStage))
    expect(ground.size).toBe(1)
    expect(redStage['--color-pageTop']).not.toBe(fallback['--color-pageTop'])
  })

  it('leaves the signals and the veils to the dark stage', () => {
    for (const token of [
      '--color-accent',
      '--color-primary',
      '--color-solution',
      '--color-correct',
      '--color-incorrect',
      '--color-tile',
      '--color-option',
      '--color-text',
    ]) {
      expect(redStage[token], token).toBeUndefined()
      expect(fallback[token], token).toBeDefined()
    }
  })

  it('gives the device start screen the same ground and switches its lights off', () => {
    expect(Object.keys(redStart).sort()).toEqual([
      '--start-ambient-left',
      '--start-ambient-right',
      '--start-bg-bottom',
      '--start-bg-mid',
      '--start-bg-top',
    ])
    expect(redStart['--start-bg-top']).toBe(redStage['--color-pageTop'])
    expect(redStart['--start-ambient-left']).toBe(redStart['--start-ambient-right'])
    expect(redStart['--start-ambient-left']).not.toBe(fallback['--start-ambient-left'])
  })

  it('turns the offer overview ground and ink, and keeps the cards as they are', () => {
    for (const [name, rule] of [
      ['dark', darkOverview],
      ['red', redOverview],
    ] as const) {
      expect(Object.keys(rule).sort(), name).toEqual([
        '--quiz-select-ink',
        '--quiz-select-ink-quiet',
        '--quiz-select-page',
        '--quiz-select-shadow',
      ])
    }
    // Two grounds, one ink: the red variant is the dark one with its ground exchanged.
    expect(redOverview['--quiz-select-page']).toBe(redStage['--color-pageTop'])
    expect(redOverview['--quiz-select-page']).not.toBe(darkOverview['--quiz-select-page'])
    expect(redOverview['--quiz-select-ink']).toBe(darkOverview['--quiz-select-ink'])

    /*
     * AND THE CARDS KEEP THEIR DARK TEXT. Their surfaces are the colours of
     * their quizzes and stay light in every variant, so the ink on them may not
     * follow the page's - that is what the second pair of names is for.
     */
    expect(darkOverview['--quiz-select-ink-on-card']).toBeUndefined()
    expect(fallback['--quiz-select-ink-on-card']).toBe(fallback['--quiz-select-ink'])
    expect(darkOverview['--quiz-select-ink']).not.toBe(fallback['--quiz-select-ink-on-card'])
    for (const card of ['bundestag', 'kids', 'europe', 'unity', 'bremen']) {
      expect(darkOverview[`--quiz-select-card-${card}`], card).toBeUndefined()
    }
  })
})
