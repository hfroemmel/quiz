/**
 * Haelt die Palette zentral.
 *
 * Zwei Zusagen werden hier geprueft, und beide sind leicht zu brechen, ohne dass
 * es jemandem auffiel: Farbwerte sind unauffaellig, und eine zweite Abschrift
 * sieht auf den ersten Blick harmlos aus. Genau daran ist das Farbsystem schon
 * einmal auseinandergelaufen - `tokens.css` und `config.json` trugen
 * verschiedene Akzentfarben, und weil eine geerbte Inline-Variable die
 * `:root`-Regel schlaegt, gewann stillschweigend das Quizpaket.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { paletteStyleSheet } from '../src/theme/palette.ts'

const webDir = fileURLToPath(new URL('..', import.meta.url))
const sourceDir = join(webDir, 'src')
const generated = join(sourceDir, 'styles', 'palette.css')

/**
 * Erlaubte Ausnahmen.
 *
 * `PreviewApp.tsx` zeichnet Platzhaltergrafiken als Daten-URI - das sind Bilder,
 * keine Oberflaechenfarben. Sie stehen fuer Fotos, die im Betrieb vom Server
 * kommen, und haben in der Palette nichts zu suchen.
 */
const EXEMPT = ['styles/palette.css', 'apps/preview/PreviewApp.tsx']

/*
 * Hexwerte, `rgb(...)` und die benannten Farben von CSS.
 *
 * Die Namen brauchen die Klammer davor und dahinter: `--kids-red` ist ein
 * Variablenname und keine Farbe, `text-shadow: 0 0 black` dagegen schon.
 * `transparent` und `currentColor` bleiben erlaubt - sie nennen keinen Ton.
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
      'palette.css passt nicht mehr zu packages/contracts/src/theme.ts - `pnpm palette:build` ausfuehren.',
    ).toBe(paletteStyleSheet())
  })

  it('haelt alle Farbwerte in der Palette', () => {
    const offenders: string[] = []
    for (const file of sourceFiles(sourceDir)) {
      const relative = file.slice(sourceDir.length + 1)
      if (EXEMPT.some((entry) => relative.endsWith(entry))) continue
      for (const [index, line] of readFileSync(file, 'utf8').split('\n').entries()) {
        if (COLOR.test(line)) offenders.push(`${relative}:${index + 1}: ${line.trim()}`)
      }
    }
    expect(
      offenders,
      'Farbwerte gehoeren nach packages/contracts/src/theme.ts, nicht in ein Stylesheet oder Bauteil.',
    ).toEqual([])
  })
})
