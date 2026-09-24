/**
 * `pnpm content:build` - produces the normalised, versioned quiz package.
 *
 * The result lives under `content/dist` and is the only source the server
 * loads from at runtime. A build of the event software therefore never
 * depends on Google Sheets (specification 24.2).
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { contentDir, flagValue } from './dirs'
import { MANIFEST_FILE, buildPackage, readJson } from '../package'
import { formatValidationReport } from '../report'

const args = process.argv.slice(2)
const sourceDir = contentDir(args, 'source', 'source')
const outDir = contentDir(args, 'out', 'dist')
const reportDir = contentDir(args, 'report', 'reports')

function nextContentVersion(): string {
  const explicit = process.env['CONTENT_VERSION']
  if (explicit) return explicit
  const manifestPath = join(outDir, MANIFEST_FILE)
  if (!existsSync(manifestPath)) return '1.0.0'
  try {
    const previous = readJson(manifestPath) as { contentVersion?: string }
    const parts = (previous.contentVersion ?? '1.0.0').split('.').map(Number)
    return `${parts[0] ?? 1}.${parts[1] ?? 0}.${(parts[2] ?? 0) + 1}`
  } catch {
    return '1.0.0'
  }
}

let previousStats: { contentVersion: string; totalQuestions: number } | undefined
const previousManifestPath = join(outDir, MANIFEST_FILE)
if (existsSync(previousManifestPath)) {
  try {
    const previous = readJson(previousManifestPath) as { contentVersion: string }
    const questions = readJson(join(outDir, 'questions.json')) as unknown[]
    previousStats = { contentVersion: previous.contentVersion, totalQuestions: questions.length }
  } catch {
    previousStats = undefined
  }
}

/** See `pnpm content:validate --placeholder-media`. */
const placeholderMedia = args.includes('--placeholder-media')
const contentVersion = nextContentVersion()
const result = buildPackage({
  sourceDir,
  outDir,
  contentVersion,
  sourceRevision: process.env['SOURCE_REVISION'],
  createdAt: new Date().toISOString(),
  missingMediaSeverity: placeholderMedia ? 'warning' : 'error',
})

const report = formatValidationReport(result.validation, {
  title: 'Build-Bericht Quizpaket',
  contentVersion,
  previous: previousStats,
})
mkdirSync(reportDir, { recursive: true })
writeFileSync(join(reportDir, 'build.md'), report, 'utf8')
console.log(report)

if (!result.validation.ok) {
  console.error('Build abgebrochen: Der Inhalt enthaelt Schemafehler. Es wurde kein Paket geschrieben.')
  process.exit(1)
}

if (result.missingAssetFiles.length) {
  console.log(`Hinweis: ${result.missingAssetFiles.length} Mediendateien fehlen und wurden uebersprungen.`)
  console.log('Der Server zeigt an ihrer Stelle ein Ersatzbild; die Liste steht im Build-Bericht.')
}
console.log(`Quizpaket ${contentVersion} geschrieben nach ${result.outDir}`)
console.log(`Pruefsumme: ${result.manifest.checksum.slice(0, 16)}...`)

/*
 * AND WHAT IS IN IT - the quiz types, by name.
 *
 * THE VERSION SAYS NOTHING ABOUT THE CONTENT. It is a counter of the builds in
 * this directory: a fresh `content/dist` starts at 1.0.0 and every build adds
 * one, so the same corpus has a different number on two machines and two
 * different corpora can carry the same. What an operator actually needs to
 * know is whether THIS package is the one the evening was prepared with - and
 * the answer is the offer it holds.
 *
 * It is the line that ends the commonest confusion there is around this
 * pipeline: the source is versioned, the package is not, so a build that was
 * forgotten shows itself as a room full of the previous offer. Whoever reads
 * this line sees the old names and knows where to look.
 */
const built = readJson(join(result.outDir, 'config.json')) as {
  quizzes?: { id: string; label: string }[]
}
const offered = built.quizzes ?? []
if (offered.length > 0) {
  console.log(`Quizarten (${offered.length}): ${offered.map((quiz) => `${quiz.id} "${quiz.label}"`).join(', ')}`)
}
