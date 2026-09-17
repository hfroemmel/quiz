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
 */
const EXEMPT = ['palettes.ts', 'palette.css', 'preview/PreviewApp.tsx', 'hostThemes.ts']

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
const COLOR = new RegExp(`#[0-9a-fA-F]{3,8}\\b|\\brgba?\\(|(?<![-\\w])(${NAMED})(?![-\\w])`)

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
          if (COLOR.test(line)) offenders.push(`${relative}:${index + 1}: ${line.trim()}`)
        }
      }
    }
    expect(
      offenders,
      'Colour values belong in packages/themes/src/palettes.ts, not in a stylesheet or a component.',
    ).toEqual([])
  })
})
