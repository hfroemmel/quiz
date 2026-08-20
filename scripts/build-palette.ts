/**
 * `pnpm palette:build` - schreibt `apps/web/src/styles/palette.css`.
 *
 * Die Farben stehen in `packages/contracts/src/theme.ts`. Dieses Skript ist nur
 * die Feder: Es formt daraus das Stylesheet, das der Web-Client einbindet. Der
 * Test `apps/web/test/palette.test.ts` schlaegt fehl, wenn die Datei nicht mehr
 * zur Quelle passt - vergessenes Nachschreiben faellt damit im Testlauf auf und
 * nicht erst auf der Buehne.
 */
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { paletteStyleSheet } from '../apps/web/src/theme/palette.ts'

const target = fileURLToPath(new URL('../apps/web/src/styles/palette.css', import.meta.url))
writeFileSync(target, paletteStyleSheet(), 'utf8')
console.log(`palette.css geschrieben: ${target}`)
