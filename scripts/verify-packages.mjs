/**
 * Checks package quality as it arrives when published.
 *
 * `pnpm pack` applies the publishConfig (exports then point to dist/);
 * publint and @arethetypeswrong/cli then check the TARBALL - not the
 * working tree. Only this way do errors show up that only exist in the
 * packed package: forgotten files, broken exports paths, missing types.
 */
import { execSync } from 'node:child_process'
import { mkdtempSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const pakete = ['core', 'content', 'themes', 'react', 'kiosk']
/*
 * Pure CSS and asset entry points have no types - attw only checks the
 * JavaScript entry points.
 */
const attwAusnahmen = {
  themes: ['./palette.css', './fonts.css', './controls.css'],
  react: ['./styles.css', './styles/stage.css', './styles/motion.css', './assets/*'],
  kiosk: ['./styles.css'],
}
const ablage = mkdtempSync(join(tmpdir(), 'quiz-pack-'))
let fehler = 0

for (const name of pakete) {
  const verzeichnis = join('packages', name)
  execSync(`pnpm pack --out ${ablage}/${name}.tgz`, { cwd: verzeichnis, stdio: 'pipe' })
  const tarball = join(ablage, `${name}.tgz`)
  for (const [werkzeug, kommando] of [
    ['publint', `pnpm exec publint ${tarball}`],
    [
      'attw',
      `pnpm exec attw ${tarball} --profile esm-only` +
        (attwAusnahmen[name] ? ` --exclude-entrypoints ${attwAusnahmen[name].join(' ')}` : ''),
    ],
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
