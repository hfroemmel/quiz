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
 * stage, the kiosk package and the harness.
 */
const sourceDirs = [
  join(themesDir, 'src'),
  join(themesDir, '..', 'react', 'src'),
  join(themesDir, '..', 'kiosk', 'src'),
  join(themesDir, '..', '..', 'harness', 'src'),
]

/**
 * Allowed exceptions.
 *
 * `PreviewApp.tsx` draws placeholder graphics as data URIs - those are
 * images, not surface colours. They stand in for photos that come from the
 * server in production and have no business being in the palette.
 */
const EXEMPT = ['palettes.ts', 'palette.css', 'preview/PreviewApp.tsx']

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

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry)
    if (statSync(path).isDirectory()) return sourceFiles(path)
    return /\.(css|ts|tsx)$/.test(entry) ? [path] : []
  })
}

describe('Farbpalette', () => {
  it('erzeugt palette.css unveraendert aus der Quelle', () => {
    expect(
      readFileSync(generated, 'utf8'),
      'palette.css passt nicht mehr zu src/palettes.ts - `pnpm palette:build` ausfuehren.',
    ).toBe(paletteStyleSheet())
  })

  it('haelt alle Farbwerte in der Palette', () => {
    const offenders: string[] = []
    for (const dir of sourceDirs) {
      for (const file of sourceFiles(dir)) {
        const relative = file.slice(dir.length + 1)
        if (EXEMPT.some((entry) => relative.endsWith(entry))) continue
        for (const [index, line] of readFileSync(file, 'utf8').split('\n').entries()) {
          if (COLOR.test(line)) offenders.push(`${relative}:${index + 1}: ${line.trim()}`)
        }
      }
    }
    expect(
      offenders,
      'Farbwerte gehoeren nach packages/themes/src/palettes.ts, nicht in ein Stylesheet oder Bauteil.',
    ).toEqual([])
  })
})
