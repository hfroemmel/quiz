/**
 * `pnpm palette:build` - schreibt `src/palette.css` dieses Pakets.
 *
 * Die Farben stehen in `src/palettes.ts`. Dieses Skript ist nur die Feder: Es
 * formt daraus das Stylesheet, das Gastgeber einbinden. Der Test
 * `test/palette.test.ts` schlaegt fehl, wenn die Datei nicht mehr zur Quelle
 * passt - vergessenes Nachschreiben faellt damit im Testlauf auf und nicht erst
 * auf der Buehne.
 */
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { paletteStyleSheet } from '../src/paletteStylesheet'

const target = fileURLToPath(new URL('../src/palette.css', import.meta.url))
writeFileSync(target, paletteStyleSheet(), 'utf8')
console.log(`palette.css geschrieben: ${target}`)
