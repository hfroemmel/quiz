/**
 * `pnpm content:build` - erzeugt das normalisierte, versionierte Quizpaket.
 *
 * Ergebnis liegt unter `content/dist` und ist die einzige Quelle, aus der der Server
 * zur Laufzeit laedt. Ein Build der Veranstaltungssoftware haengt damit nie von
 * Google Sheets ab (Spezifikation 24.2).
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { contentPackageDir, contentReportDir, contentSourceDir } from '../paths.ts'
import { MANIFEST_FILE, buildPackage, readJson } from '../package.ts'
import { formatValidationReport } from '../report.ts'

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

const contentVersion = nextContentVersion()
const result = buildPackage({
  sourceDir: contentSourceDir,
  outDir: contentPackageDir,
  contentVersion,
  sourceRevision: process.env['SOURCE_REVISION'],
  createdAt: new Date().toISOString(),
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

for (const filename of result.missingAssetFiles) {
  console.log(`Hinweis: Mediendatei "${filename}" fehlt. Sie gehoert zu einer deaktivierten Frage und wurde uebersprungen.`)
}
console.log(`Quizpaket ${contentVersion} geschrieben nach ${result.outDir}`)
console.log(`Pruefsumme: ${result.manifest.checksum.slice(0, 16)}...`)
