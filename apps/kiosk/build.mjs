/**
 * Buendelt den Hauptprozess zu einer ES-Modul-Datei.
 *
 * Es gibt kein Preload-Skript: Die Spieleransicht braucht keine Fensterfunktionen.
 */
import { build } from 'esbuild'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))

await build({
  entryPoints: [join(here, 'src', 'main.ts')],
  outfile: join(here, 'dist', 'main.mjs'),
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  sourcemap: true,
  external: ['electron', 'better-sqlite3'],
  banner: {
    js: "import { createRequire as __createRequire } from 'node:module';\nconst require = __createRequire(import.meta.url);",
  },
})

console.log('Kiosk-Hauptprozess gebaut: apps/kiosk/dist')
