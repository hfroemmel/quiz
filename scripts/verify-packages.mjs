/**
 * Checks package quality as it arrives when published.
 *
 * `pnpm pack` applies the publishConfig (exports then point to dist/);
 * publint and @arethetypeswrong/cli then check the TARBALL - not the
 * working tree. Only this way do errors show up that only exist in the
 * packed package: forgotten files, broken exports paths, missing types.
 */
import { execSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const packageNames = ['core', 'content', 'themes', 'react']
/*
 * Pure CSS and asset entry points have no types - attw only checks the
 * JavaScript entry points.
 */
const typelessEntryPoints = {
  themes: ['./palette.css', './fonts.css', './controls.css'],
  react: ['./styles.css', './styles/stage.css', './styles/motion.css', './assets/*'],
}
const workDir = mkdtempSync(join(tmpdir(), 'quiz-pack-'))
let failures = 0

for (const name of packageNames) {
  const directory = join('packages', name)
  execSync(`pnpm pack --out ${workDir}/${name}.tgz`, { cwd: directory, stdio: 'pipe' })
  const tarball = join(workDir, `${name}.tgz`)
  for (const [tool, command] of [
    ['publint', `pnpm exec publint ${tarball}`],
    [
      'attw',
      `pnpm exec attw ${tarball} --profile esm-only` +
        (typelessEntryPoints[name] ? ` --exclude-entrypoints ${typelessEntryPoints[name].join(' ')}` : ''),
    ],
  ]) {
    try {
      execSync(command, { stdio: 'pipe' })
      console.log(`ok      ${name} (${tool})`)
    } catch (error) {
      failures += 1
      console.error(`FAILED  ${name} (${tool})`)
      console.error(String(error.stdout ?? ''))
      console.error(String(error.stderr ?? ''))
    }
  }
}

rmSync(workDir, { recursive: true, force: true })
process.exit(failures === 0 ? 0 : 1)
