/**
 * `pnpm content:validate` - Pflichtschritt vor jedem Build.
 *
 * Beendet sich mit Exit-Code 1, sobald ein Schemafehler vorliegt. Der CI-Build
 * schlaegt damit bei Schema- oder Referenzfehlern fehl (Spezifikation 31.5).
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { contentReportDir, contentSourceDir } from '../paths.ts'
import { readSource, validateSource } from '../package.ts'
import { formatValidationReport } from '../report.ts'

const sourceDir = process.argv[2] ?? contentSourceDir
const source = readSource(sourceDir)
const result = validateSource(source)

const report = formatValidationReport(result, { title: 'Validierungsbericht Quizinhalte' })
mkdirSync(contentReportDir, { recursive: true })
const reportPath = join(contentReportDir, 'validation.md')
writeFileSync(reportPath, report, 'utf8')

console.log(report)
console.log(`Bericht gespeichert: ${reportPath}`)

if (!result.ok) {
  console.error(`\nValidierung fehlgeschlagen: ${result.errors.length} Fehler.`)
  process.exit(1)
}
if (result.warnings.length) {
  console.log(`\nValidierung bestanden mit ${result.warnings.length} Warnungen (bewusste Freigabe erforderlich).`)
}
