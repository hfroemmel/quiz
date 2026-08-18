/**
 * Baut das native SQLite-Modul wieder fuer die Node-Laufzeit.
 *
 * Hintergrund: `better-sqlite3` ist ein natives Modul und passt immer nur zu EINER
 * Laufzeit. Wer die Desktop-Anwendung gestartet hat (`pnpm desktop:rebuild-native`),
 * braucht danach diesen Befehl, um wieder den reinen Node-Server und die Tests
 * verwenden zu koennen - und umgekehrt.
 */
import { createRequire } from 'node:module'
import { execFileSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

// pnpm installiert strikt: `better-sqlite3` ist nur von seinem Nutzerpaket aus
// aufloesbar, nicht vom Repository-Wurzelverzeichnis.
const repositoryRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(join(repositoryRoot, 'packages', 'persistence', 'package.json'))
const packageJsonPath = require.resolve('better-sqlite3/package.json')
const packageDir = dirname(packageJsonPath)

console.log(`Baue better-sqlite3 fuer Node ${process.versions.node} in ${packageDir}`)

try {
  // Bevorzugt das offizielle Prebuild - das dauert Sekunden statt Minuten.
  execFileSync('npx', ['--yes', 'prebuild-install', '-r', 'node'], { cwd: packageDir, stdio: 'inherit' })
} catch {
  console.log('Kein passendes Prebuild gefunden, es wird lokal kompiliert.')
  execFileSync('npx', ['--yes', 'node-gyp', 'rebuild', '--release'], { cwd: packageDir, stdio: 'inherit' })
}

console.log('Fertig. "pnpm server" und "pnpm test" funktionieren wieder.')
