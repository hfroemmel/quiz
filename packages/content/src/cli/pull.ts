/**
 * `quiz-content pull` - laedt ein gebautes Quizpaket aus einem GitHub-Release.
 *
 * WARUM NICHT AUS DEM INHALTE-REPOSITORY DIREKT: Die Medien liegen dort in Git
 * LFS. Ein Klon zoege bei jedem App-Build die volle LFS-Bandbreite, und ein
 * beweglicher Branch waere kein verlaesslicher Stand. Ein Release-Asset ist
 * dagegen unveraenderlich, traegt eine Pruefsumme und kostet keine LFS-Quota.
 *
 * Der gewuenschte Stand steht in `content.lock.json` - versioniert, damit jeder
 * Build derselben Anwendung denselben Inhalt bekommt:
 *
 * ```json
 * {
 *   "repository": "hfroemmel/quiz-content-data",
 *   "tag": "content-v2.0.0",
 *   "profile": "no-video",
 *   "checksum": "sha256:…",
 *   "target": "content/dist"
 * }
 * ```
 *
 * Geladen wird mit `gh` - so gilt dieselbe Authentifizierung wie fuer alles
 * andere am privaten Repository, in CI ueber `GH_TOKEN`.
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
  profile: z.enum(['full', 'no-video']).default('full'),
  /** `sha256:<hex>` des Archivs. Ohne Pruefsumme wird nicht entpackt. */
  checksum: z.string().regex(/^sha256:[0-9a-f]{64}$/, 'checksum muss "sha256:<64 Hexzeichen>" sein'),
  /** Zielverzeichnis relativ zum Arbeitsverzeichnis. */
  target: z.string().min(1).default('content/dist'),
})

const args = process.argv.slice(2)
const lockPath = resolve(flagValue(args, 'lock') ?? join(process.cwd(), 'content.lock.json'))
if (!existsSync(lockPath)) {
  console.error(`Keine Sperrdatei gefunden: ${lockPath}`)
  console.error('Sie nennt Repository, Tag, Profil und Pruefsumme des gewuenschten Inhaltsstands.')
  process.exit(1)
}

const lock = lockSchema.parse(JSON.parse(readFileSync(lockPath, 'utf8')))
const archiv = `content-${lock.profile}.tar.zst`
const ziel = resolve(join(process.cwd(), lock.target))
const ablage = mkdtempSync(join(tmpdir(), 'quiz-content-'))

try {
  console.log(`Lade ${archiv} aus ${lock.repository}@${lock.tag} ...`)
  execFileSync('gh', ['release', 'download', lock.tag, '--repo', lock.repository, '--pattern', archiv, '--dir', ablage], {
    stdio: 'inherit',
  })

  const datei = join(ablage, archiv)
  const gefunden = `sha256:${createHash('sha256').update(readFileSync(datei)).digest('hex')}`
  if (gefunden !== lock.checksum) {
    console.error('Pruefsumme stimmt nicht - das Archiv wird NICHT entpackt.')
    console.error(`  erwartet: ${lock.checksum}`)
    console.error(`  gefunden: ${gefunden}`)
    process.exit(1)
  }

  // Erst nach bestandener Pruefung wird das alte Paket ersetzt.
  rmSync(ziel, { recursive: true, force: true })
  mkdirSync(ziel, { recursive: true })
  execFileSync('tar', ['--zstd', '-xf', datei, '-C', ziel], { stdio: 'inherit' })

  console.log(`Quizpaket entpackt nach ${ziel} (Profil ${lock.profile}, ${lock.tag}).`)
} finally {
  rmSync(ablage, { recursive: true, force: true })
}
