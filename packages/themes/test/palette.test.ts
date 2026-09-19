/**
 * Keeps the palette central.
 *
 * Two guarantees are checked here, and both are easy to break without
 * anyone noticing: colour values are inconspicuous, and a second copy looks
 * harmless at first glance. This is exactly where the colour system drifted
 * apart once before - `tokens.css` and `config.json` carried different
 * accent colours, and because an inherited inline variable beats the
 * `:root` rule, the quiz package silently won.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { federalValues } from '../src/federalSpectrum'
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
} from '../src/palettes'
import { paletteStyleSheet } from '../src/paletteStylesheet'

const themesDir = fileURLToPath(new URL('..', import.meta.url))
const generated = join(themesDir, 'src', 'palette.css')
/*
 * Checks run across ALL surface layers: the themes themselves, the React
 * stage - which is where the playable quiz lives since 0.19.0 - and the
 * harness.
 */
const sourceDirs = [
  join(themesDir, 'src'),
  join(themesDir, '..', 'react', 'src'),
  join(themesDir, '..', '..', 'harness', 'src'),
]

/**
 * Allowed exceptions.
 *
 * `PreviewApp.tsx` draws placeholder graphics as data URIs - those are
 * images, not surface colours. They stand in for photos that come from the
 * server in production and have no business being in the palette.
 *
 * `hostThemes.ts` is the design of a HOST. A host's own colours are exactly
 * what a `ThemeDefinition` is for, and the harness plays the host here; the
 * rule applies to the surfaces of the packages, which must not name a tone.
 *
 * `federalSpectrum.ts` is the style guide itself - the seventeen tones and the
 * two rules that make every step of them. It is the one file allowed to state
 * a value, and the third test below is what keeps it the only one that matters.
 */
const EXEMPT = ['palettes.ts', 'federalSpectrum.ts', 'palette.css', 'preview/PreviewApp.tsx', 'hostThemes.ts']

/*
 * Hex values, `rgb(...)`, and CSS's named colours.
 *
 * The names need the boundary before and after them: `--kids-red` is a
 * variable name and not a colour, whereas `text-shadow: 0 0 black` is.
 * `transparent` and `currentColor` remain allowed - they name no tone.
 */
const NAMED = [
  'black', 'white', 'red', 'green', 'blue', 'yellow', 'orange', 'purple',
  'pink', 'brown', 'gray', 'grey', 'silver', 'gold', 'cyan', 'magenta',
  'teal', 'navy', 'olive', 'maroon', 'lime', 'aqua', 'fuchsia',
].join('|')
const VALUE = /#[0-9a-fA-F]{3,8}\b|\brgba?\(/
const NAMED_COLOR = new RegExp(`(?<![-\\w])(${NAMED})(?![-\\w])`)

/*
 * Comments are prose, not surface colours: "a white flash" in an explanation
 * is fine, `color: white` in a rule is not. Comment text is blanked out
 * before the check, keeping the line numbers intact.
 */
function withoutComments(text: string): string {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, ' '))
    .replace(/^\s*\/\/.*$/gm, '')
}

/*
 * A NAME IS NOT A VALUE.
 *
 * Since the stage has a red variant, that word stands in the sources as its
 * NAME: `stageThemes` offers it, and `[data-theme='red']` selects it. Both sit
 * in brackets - an array's or a selector's - and the named colours are not
 * looked for in there. A value would not be written that way: it stands after
 * a colon, and where it does it is still found.
 *
 * Hex values and `rgb()` keep being looked for everywhere, brackets or not:
 * those are values wherever they stand, and they are the form in which a
 * second copy of the palette actually creeps in.
 */
function withoutBrackets(text: string): string {
  return text.replace(/\[[^\]\n]*\]/g, (span) => span.replace(/[^\n]/g, ' '))
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry)
    if (statSync(path).isDirectory()) return sourceFiles(path)
    return /\.(css|ts|tsx)$/.test(entry) ? [path] : []
  })
}

describe('Colour palette', () => {
  it('generates palette.css unchanged from the source', () => {
    expect(
      readFileSync(generated, 'utf8'),
      'palette.css no longer matches src/palettes.ts - run `pnpm palette:build`.',
    ).toBe(paletteStyleSheet())
  })

  it('keeps all colour values in the palette', () => {
    const offenders: string[] = []
    for (const dir of sourceDirs) {
      for (const file of sourceFiles(dir)) {
        const relative = file.slice(dir.length + 1)
        if (EXEMPT.some((entry) => relative.endsWith(entry))) continue
        for (const [index, line] of withoutComments(readFileSync(file, 'utf8')).split('\n').entries()) {
          if (VALUE.test(line) || NAMED_COLOR.test(withoutBrackets(line))) {
            offenders.push(`${relative}:${index + 1}: ${line.trim()}`)
          }
        }
      }
    }
    expect(
      offenders,
      'Colour values belong in packages/themes/src/palettes.ts, not in a stylesheet or a component.',
    ).toEqual([])
  })
})

/**
 * EVERY COLOUR OF THIS HOUSE IS A COLOUR OF THE FEDERAL SPECTRUM.
 *
 * `palettes.ts` names tones and steps rather than values, so conformance is
 * true by construction - which is exactly why it needs a test: the next hand
 * that writes a literal in there would break the rule without breaking the
 * build. This resolves every palette and measures each value against the set
 * the two rules can produce.
 *
 * WHAT COUNTS AS A COLOUR OF THE SPECTRUM:
 *   - one of the seventeen tones at 100, 80, 60, 40 or 20 percent,
 *   - the same darkened with black at those steps,
 *   - white and black, which the style guide uses for labels and grounds,
 *   - any of those as a translucent veil: the alpha is not a colour.
 * A gradient is checked stop by stop.
 *
 * THE CHILDREN'S WORLD IS NOT IN HERE, and that is the one exception this
 * house makes: its colours come from its drawings, and a drawn frame does not
 * follow a spectrum (see `palettes.ts`). It is excluded by name, so the
 * exception stays visible instead of being a gap in a list.
 */
describe('the federal colour spectrum', () => {
  const legal = federalValues()

  /*
   * THE TONES OF THE HOUSE - the values this system names itself.
   *
   * The spectrum is still the rule for everything that can follow it: grounds,
   * greys, veils and the whole light variant's paper are steps of it, and a
   * value that is neither a step nor one of the names below fails here.
   *
   * WHAT STANDS HERE, AND WHY EACH ONE DOES:
   *
   *   #CA2F56  the ground of the red variant - ordered, and confirmed by the
   *            client after the conformance sweep had put `Rot` at 80 percent
   *            (#CD3363) in its place, fourteen units away.
   *   #A22644  the tile on that ground. A white veil over this red reads as a
   *            pale patch instead of a surface, so the variant names its own.
   *   #00ACD3  the accent of the stage, and #0084A1 its withdrawn step.
   *   #8CD000  the one green of the system - the solution, the right answer
   *            and the start button - with #A8E063, #B7F0A1 and #5A9E2B as
   *            its grades in the start menu.
   *   #333333  the ink on a light chip, #999999 the muted text on paper.
   *   #003399  the card of the Europe quiz, in the blue that quiz is about.
   *
   * THE LIST IS THE POINT. Each value is here by name, so a colour that
   * nobody chose deliberately still cannot enter - and dropping one of these
   * from `palettes.ts` fails the counter-test below.
   */
  const house = new Set([
    '#CA2F56',
    '#A22644',
    '#00ACD3',
    '#0084A1',
    '#8CD000',
    '#A8E063',
    '#B7F0A1',
    '#5A9E2B',
    '#333333',
    '#003399',
    '#999999',
    /* The offer overview: ink, its quiet step, and the icon of a card. */
    '#000',
    '#696969',
    '#BBB',
    /* The last stop of the children's card. */
    '#CBC9F1',
    /*
     * The ground of the dark stage in three plain greys, the chip on it, and
     * the mint of the light start button. The short forms are the design's
     * own writing and count as values of their own here.
     */
    '#111',
    '#232323',
    '#343434',
    '#F2F2F2',
    '#FFF',
    '#000',
    '#00CE9D',
  ])

  /** Every colour token of a value - a gradient carries several. */
  function colours(value: string): string[] {
    const found = value.match(/#[0-9a-fA-F]{3,8}|rgba?\([^)]*\)/g)
    return found ?? []
  }

  /** A veil reduced to the colour under it; anything else stays as it is. */
  function tone(colour: string): string | null {
    const veiled = colour.match(/^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/)
    if (!veiled) return colour.toUpperCase()
    const [red, green, blue] = veiled.slice(1, 4).map(Number) as [number, number, number]
    return `#${[red, green, blue].map((part) => part.toString(16).padStart(2, '0').toUpperCase()).join('')}`
  }

  const surfaces: Record<string, Record<string, string>> = {
    'stage, dark': stagePalettes.default,
    'stage, light': brightPalette as Record<string, string>,
    'stage, red': redPalette as Record<string, string>,
    'stage extras': stageExtras as unknown as Record<string, string>,
    'offer overview': quizSelectPalette as unknown as Record<string, string>,
    'offer overview, dark': darkQuizSelectPalette as unknown as Record<string, string>,
    'offer overview, red': redQuizSelectPalette as unknown as Record<string, string>,
    'control frame': uiPalette as unknown as Record<string, string>,
    'start menu': startPalette as unknown as Record<string, string>,
    'start menu, light': brightStartPalette as unknown as Record<string, string>,
    'start menu, red': redStartPalette as unknown as Record<string, string>,
  }

  for (const [name, palette] of Object.entries(surfaces)) {
    it(`${name} carries only tones of the spectrum`, () => {
      const strangers: string[] = []
      for (const [token, value] of Object.entries(palette)) {
        for (const colour of colours(value)) {
          /* `transparent` and `currentColor` name no tone - they pass by not matching. */
          const flat = tone(colour)
          if (flat && !legal.has(flat) && !house.has(flat)) strangers.push(`${token}: ${colour}`)
        }
      }
      expect(
        strangers,
        'Not a step of the Federal Government spectrum - see packages/themes/src/federalSpectrum.ts.',
      ).toEqual([])
    })
  }

  it('carries the commissioned ground and its tile - the two tones the spectrum does not have', () => {
    /*
     * The counter-test to the exception. It reads the ground from all three
     * palettes that show it, because they read one constant and a copy in one
     * of them is how the poster and the stage would drift apart. And the last
     * assertion is the sharp one: across every surface of the adults' world
     * there are EXACTLY these two values outside the spectrum - the ground and
     * the tile that sits on it. A THIRD literal creeping in fails here, and so
     * does a sweep that conforms one of them away - which is what happened
     * once, and what the client asked to have undone.
     */
    expect(redPalette.pageTop).toBe('#CA2F56')
    expect(redStartPalette['bg-top']).toBe('#CA2F56')
    expect(redQuizSelectPalette.page).toBe('#CA2F56')
    expect(legal.has('#CA2F56')).toBe(false)

    /* The tile belongs to that ground - and to this variant alone. */
    expect(redPalette.tile).toBe('#a22644')
    expect(redPalette.option).toBe(redPalette.tile)
    expect(redPalette.tileDisabled).toBe(redPalette.pageTop)
    expect(redPalette.tileQuiet).toBe(redPalette.pageTop)
    expect(legal.has('#A22644')).toBe(false)

    const outsiders = new Set<string>()
    for (const palette of Object.values(surfaces)) {
      for (const value of Object.values(palette)) {
        for (const colour of colours(value)) {
          const flat = tone(colour)
          if (flat && !legal.has(flat)) outsiders.add(flat)
        }
      }
    }
    /*
     * AND THE TWO LISTS ARE THE SAME LIST. Every tone outside the spectrum
     * that any surface carries stands in `house` above, and every name in
     * `house` is actually carried by one - a value dropped from
     * `palettes.ts` fails here just as a new literal does.
     */
    expect([...outsiders].sort()).toEqual([...house].sort())
  })

  it('states the children world as the exception, not as a gap', () => {
    /*
     * The counter-test: the drawn world really does carry colours the spectrum
     * does not have. If this ever came out empty, the exception above would be
     * pointless - and somebody would have quietly recoloured the illustrations.
     */
    const own = Object.values(stagePalettes.kids).filter((value) => {
      const flat = tone(colours(value)[0] ?? '')
      return flat !== null && !legal.has(flat)
    })
    expect(own.length).toBeGreaterThan(5)
  })
})
