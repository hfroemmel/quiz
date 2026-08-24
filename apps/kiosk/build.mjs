/**
 * Buendelt den Hauptprozess des Kiosks zu einer Datei.
 *
 * Derselbe Weg wie bei `apps/desktop` und aus denselben Gruenden: Electron laedt
 * keinen TypeScript-Hauptprozess, und esbuild genuegt dafuer. Ein Preload gibt es
 * hier NICHT - die Spieleransicht braucht keine Fensterfunktionen.
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
  // Electron und native Module bleiben extern, sie kommen aus node_modules.
  external: ['electron', 'better-sqlite3'],
  // Einige Abhaengigkeiten (z. B. `ws`) sind CommonJS und verwenden `require`.
  banner: {
    js: "import { createRequire as __createRequire } from 'node:module';\nconst require = __createRequire(import.meta.url);",
  },
})

console.log('Kiosk-Hauptprozess gebaut: apps/kiosk/dist')
