/**
 * `pnpm content:validate` - Pflichtschritt vor jedem Build.
 *
 * Beendet sich mit Exit-Code 1, sobald ein Schemafehler vorliegt. Der CI-Build
 * schlaegt damit bei Schema- oder Referenzfehlern fehl (Spezifikation 31.5).
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { contentDir, flagValue } from './dirs'
import { applyContentProfile, readSource, validateSource } from '../package'
import { formatValidationReport } from '../report'

const args = process.argv.slice(2)
/**
 * `--placeholder-media` stuft fehlende Mediendateien zur Warnung herab.
 *
 * Gedacht fuer die Entwicklung, solange der freigegebene Bildbestand fehlt: Der
 * Server zeigt dann ein erzeugtes Ersatzbild. Fuer den Livebetrieb bleibt der
 * Aufruf ohne Flag verbindlich.
 */
const placeholderMedia = args.includes('--placeholder-media')
const sourceDir = contentDir(args, 'source', 'source')
const reportDir = contentDir(args, 'report', 'reports')
/** `--profile no-video` prueft die Quelle so, wie sie die Offline-Apps sehen. */
const profile = flagValue(args, 'profile') === 'no-video' ? ('no-video' as const) : ('full' as const)
const source = applyContentProfile(readSource(sourceDir), profile)
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
