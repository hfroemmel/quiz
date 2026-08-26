/**
 * `pnpm content:build` - erzeugt das normalisierte, versionierte Quizpaket.
 *
 * Ergebnis liegt unter `content/dist` und ist die einzige Quelle, aus der der Server
 * zur Laufzeit laedt. Ein Build der Veranstaltungssoftware haengt damit nie von
 * Google Sheets ab (Spezifikation 24.2).
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { contentPackageDir, contentReportDir, contentSourceDir } from '../paths'
import { MANIFEST_FILE, buildPackage, readJson } from '../package'
import { formatValidationReport } from '../report'

function nextContentVersion(): string {
  const explicit = process.env['CONTENT_VERSION']
  if (explicit) return explicit
  const manifestPath = join(contentPackageDir, MANIFEST_FILE)
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
const previousManifestPath = join(contentPackageDir, MANIFEST_FILE)
if (existsSync(previousManifestPath)) {
  try {
    const previous = readJson(previousManifestPath) as { contentVersion: string }
    const questions = readJson(join(contentPackageDir, 'questions.json')) as unknown[]
    previousStats = { contentVersion: previous.contentVersion, totalQuestions: questions.length }
  } catch {
    previousStats = undefined
  }
}

/** Siehe `pnpm content:validate --placeholder-media`. */
const placeholderMedia = process.argv.slice(2).includes('--placeholder-media')

const contentVersion = nextContentVersion()
const result = buildPackage({
  sourceDir: contentSourceDir,
  outDir: contentPackageDir,
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
mkdirSync(contentReportDir, { recursive: true })
writeFileSync(join(contentReportDir, 'build.md'), report, 'utf8')
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
