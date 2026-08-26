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
import { paletteStyleSheet } from '../src/paletteStylesheet'

const themesDir = fileURLToPath(new URL('..', import.meta.url))
const generated = join(themesDir, 'src', 'palette.css')
/*
 * Geprueft wird ueber ALLE Oberflaechenschichten hinweg: die Themes selbst,
 * die React-Buehne, das Kiosk-Paket und die verbliebene Web-Anwendung.
 */
const sourceDirs = [
  join(themesDir, 'src'),
  join(themesDir, '..', 'react', 'src'),
  join(themesDir, '..', 'kiosk', 'src'),
  join(themesDir, '..', '..', 'apps', 'web', 'src'),
]

/**
 * Erlaubte Ausnahmen.
 *
 * `PreviewApp.tsx` zeichnet Platzhaltergrafiken als Daten-URI - das sind Bilder,
 * keine Oberflaechenfarben. Sie stehen fuer Fotos, die im Betrieb vom Server
 * kommen, und haben in der Palette nichts zu suchen.
 */
const EXEMPT = ['palettes.ts', 'palette.css', 'apps/preview/PreviewApp.tsx']

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
