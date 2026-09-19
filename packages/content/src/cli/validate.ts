/**
 * `pnpm content:validate` - mandatory step before every build.
 *
 * Exits with exit code 1 as soon as a schema error exists. The CI build thus
 * fails on schema or reference errors (specification 31.5).
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { contentDir, flagValue } from './dirs'
import { readSource, validateSource } from '../package'
import { formatValidationReport } from '../report'

const args = process.argv.slice(2)
/**
 * `--placeholder-media` downgrades missing media files to a warning.
 *
 * Meant for development while the approved image set is missing: the server
 * then shows a generated placeholder image. For live operation the call
 * without the flag remains binding.
 */
const placeholderMedia = args.includes('--placeholder-media')
const sourceDir = contentDir(args, 'source', 'source')
const reportDir = contentDir(args, 'report', 'reports')
const source = readSource(sourceDir)
const result = validateSource(source, { missingMediaSeverity: placeholderMedia ? 'warning' : 'error' })

const report = formatValidationReport(result, { title: 'Validierungsbericht Quizinhalte' })
mkdirSync(reportDir, { recursive: true })
const reportPath = join(reportDir, 'validation.md')
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
