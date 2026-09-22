/**
 * `quiz-content pull` - downloads a built quiz package from a GitHub release.
 *
 * WHY NOT DIRECTLY FROM THE CONTENT REPOSITORY: The media live there in Git
 * LFS. A clone would pull the full LFS bandwidth on every app build, and a
 * moving branch would not be a reliable state. A release asset, in contrast,
 * is immutable, carries a checksum and costs no LFS quota.
 *
 * The wanted state is in `content.lock.json` - versioned, so that every build
 * of the same application gets the same content:
 *
 * ```json
 * {
 *   "repository": "hfroemmel/quiz-content-data",
 *   "tag": "content-v2.0.0",
 *   "checksum": "sha256:…",
 *   "target": "content/dist"
 * }
 * ```
 *
 * Downloading uses `gh` - so the same authentication applies as for
 * everything else on the private repository, in CI via `GH_TOKEN`.
 */
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { z } from 'zod'
import { flagValue } from './dirs'

const lockSchema = z.object({
  repository: z.string().min(1),
  tag: z.string().min(1),
  /**
   * Name of the release asset. The pipeline builds ONE package, so the
   * default is the only archive a current release carries; older releases,
   * from the days when the same source was built in two variants, name that
   * variant in the file name and are reached by giving it here.
   */
  asset: z.string().min(1).default('content.tar.zst'),
  /** `sha256:<hex>` of the archive. Without a checksum nothing is unpacked. */
  checksum: z.string().regex(/^sha256:[0-9a-f]{64}$/, 'checksum muss "sha256:<64 Hexzeichen>" sein'),
  /** Target directory relative to the working directory. */
  target: z.string().min(1).default('content/dist'),
})

const args = process.argv.slice(2)
const lockPath = resolve(flagValue(args, 'lock') ?? join(process.cwd(), 'content.lock.json'))
if (!existsSync(lockPath)) {
  console.error(`Keine Sperrdatei gefunden: ${lockPath}`)
  console.error('Sie nennt Repository, Tag und Pruefsumme des gewuenschten Inhaltsstands.')
  process.exit(1)
}

const lock = lockSchema.parse(JSON.parse(readFileSync(lockPath, 'utf8')))
const archive = lock.asset
const target = resolve(join(process.cwd(), lock.target))
const storage = mkdtempSync(join(tmpdir(), 'quiz-content-'))

try {
  console.log(`Lade ${archive} aus ${lock.repository}@${lock.tag} ...`)
  execFileSync('gh', ['release', 'download', lock.tag, '--repo', lock.repository, '--pattern', archive, '--dir', storage], {
    stdio: 'inherit',
  })

  const file = join(storage, archive)
  const found = `sha256:${createHash('sha256').update(readFileSync(file)).digest('hex')}`
  if (found !== lock.checksum) {
    console.error('Pruefsumme stimmt nicht - das Archiv wird NICHT entpackt.')
    console.error(`  erwartet: ${lock.checksum}`)
    console.error(`  gefunden: ${found}`)
    process.exit(1)
  }

  // The old package is replaced only after the check has passed.
  rmSync(target, { recursive: true, force: true })
  mkdirSync(target, { recursive: true })
  execFileSync('tar', ['--zstd', '-xf', file, '-C', target], { stdio: 'inherit' })

  console.log(`Quizpaket entpackt nach ${target} (${lock.tag}).`)
} finally {
  rmSync(storage, { recursive: true, force: true })
}
