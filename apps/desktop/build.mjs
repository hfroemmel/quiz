/**
 * Buendelt Hauptprozess und Preload zu CommonJS-Dateien.
 *
 * Electron laedt den Hauptprozess nicht als TypeScript. esbuild reicht dafuer voellig
 * aus - ein zusaetzliches Buildsystem waere hier nicht gerechtfertigt.
 */
import { build } from 'esbuild'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))

// Der Hauptprozess wird als ES-Modul gebaut. Electron unterstuetzt das seit
// Version 28, und die Pakete verwenden `import.meta.url` zur Pfadaufloesung -
// in CommonJS waere das nicht uebersetzbar.
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
  // In einem ES-Modul gibt es das nicht, deshalb wird es hier bereitgestellt.
  banner: {
    js: "import { createRequire as __createRequire } from 'node:module';\nconst require = __createRequire(import.meta.url);",
  },
})

// Das Preload-Skript bleibt CommonJS: Es ist winzig, verwendet kein `import.meta`
// und CJS-Preload funktioniert in allen Electron-Versionen ohne Sonderfaelle.
await build({
  entryPoints: [join(here, 'src', 'preload.ts')],
  outfile: join(here, 'dist', 'preload.cjs'),
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node20',
  sourcemap: true,
  external: ['electron'],
})

console.log('Electron-Hauptprozess gebaut: apps/desktop/dist')
