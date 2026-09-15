/**
 * Rebuilds the native SQLite module for the Node runtime.
 *
 * Background: `better-sqlite3` is a native module and only ever fits ONE
 * runtime. Anyone who has started the desktop application
 * (`pnpm desktop:rebuild-native`) needs this command afterwards to use the
 * plain Node server and the tests again - and vice versa.
 */
import { createRequire } from 'node:module'
import { execFileSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

// pnpm installs strictly: `better-sqlite3` can only be resolved from its
// consuming package, not from the repository root.
const repositoryRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(join(repositoryRoot, 'packages', 'persistence', 'package.json'))
const packageJsonPath = require.resolve('better-sqlite3/package.json')
const packageDir = dirname(packageJsonPath)

console.log(`Baue better-sqlite3 fuer Node ${process.versions.node} in ${packageDir}`)

try {
  // Prefers the official prebuild - that takes seconds instead of minutes.
  execFileSync('npx', ['--yes', 'prebuild-install', '-r', 'node'], { cwd: packageDir, stdio: 'inherit' })
} catch {
  console.log('Kein passendes Prebuild gefunden, es wird lokal kompiliert.')
  execFileSync('npx', ['--yes', 'node-gyp', 'rebuild', '--release'], { cwd: packageDir, stdio: 'inherit' })
}

console.log('Fertig. "pnpm server" und "pnpm test" funktionieren wieder.')
