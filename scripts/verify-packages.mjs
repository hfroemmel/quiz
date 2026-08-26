/**
 * Paketqualitaet pruefen, wie sie beim Veroeffentlichen ankommt.
 *
 * `pnpm pack` wendet die publishConfig an (exports zeigen dann auf dist/);
 * publint und @arethetypeswrong/cli pruefen anschliessend das TARBALL - nicht
 * den Arbeitsstand. Nur so fallen Fehler auf, die es erst im gepackten Paket
 * gibt: vergessene Dateien, kaputte exports-Pfade, fehlende Typen.
 */
import { execSync } from 'node:child_process'
import { mkdtempSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const pakete = ['contracts', 'domain', 'content', 'persistence', 'runtime', 'server']
const ablage = mkdtempSync(join(tmpdir(), 'quiz-pack-'))
let fehler = 0

for (const name of pakete) {
  const verzeichnis = join('packages', name)
  execSync(`pnpm pack --out ${ablage}/${name}.tgz`, { cwd: verzeichnis, stdio: 'pipe' })
  const tarball = join(ablage, `${name}.tgz`)
  for (const [werkzeug, kommando] of [
    ['publint', `pnpm exec publint ${tarball}`],
    ['attw', `pnpm exec attw ${tarball} --profile esm-only`],
  ]) {
    try {
      execSync(kommando, { stdio: 'pipe' })
      console.log(`ok      ${name} (${werkzeug})`)
    } catch (error) {
      fehler += 1
      console.error(`FEHLER  ${name} (${werkzeug})`)
      console.error(String(error.stdout ?? ''))
      console.error(String(error.stderr ?? ''))
    }
  }
}

rmSync(ablage, { recursive: true, force: true })
process.exit(fehler === 0 ? 0 : 1)
