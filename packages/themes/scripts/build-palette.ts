/**
 * `pnpm palette:build` - writes this package's `src/palette.css`.
 *
 * The colours live in `src/palettes.ts`. This script is just the pen: it
 * shapes the stylesheet that hosts include from them. The test
 * `test/palette.test.ts` fails if the file no longer matches the source -
 * so a forgotten rewrite shows up in the test run, not only on stage.
 */
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { paletteStyleSheet } from '../src/paletteStylesheet'

const target = fileURLToPath(new URL('../src/palette.css', import.meta.url))
writeFileSync(target, paletteStyleSheet(), 'utf8')
console.log(`palette.css geschrieben: ${target}`)
