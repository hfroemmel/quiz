/**
 * `pnpm content:migrate <questions.js> [config.js]`
 *
 * Uebersetzt die Legacy-Quellen in das neue Fragenmodell (Spezifikation 26).
 * Der Parser fuehrt die Dateien NICHT aus. Das Ergebnis landet als Vorschlag unter
 * `content/migrated/` und wird bewusst nicht automatisch nach `content/source`
 * uebernommen - der Korrekturbericht braucht menschliche Freigabe.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { repositoryRoot } from '../paths.ts'
import { formatMigrationReport, migrateLegacy } from '../legacy/migrate.ts'
import { writeJson } from '../package.ts'

const questionsPath = process.argv[2]
const configPath = process.argv[3]

if (!questionsPath) {
  console.error('Aufruf: pnpm content:migrate <pfad/zu/questions.js> [pfad/zu/config.js]')
  console.error('Die identischen Duplikatdateien "questions(1).js" und "config(1).js" muessen nicht verarbeitet werden.')
  process.exit(1)
}
if (!existsSync(questionsPath)) {
  console.error(`Datei nicht gefunden: ${questionsPath}`)
  process.exit(1)
}

const result = migrateLegacy({
  questionsSource: readFileSync(questionsPath, 'utf8'),
  configSource: configPath && existsSync(configPath) ? readFileSync(configPath, 'utf8') : undefined,
})

const outDir = join(repositoryRoot, 'content', 'migrated')
mkdirSync(outDir, { recursive: true })
writeJson(join(outDir, 'questions.json'), result.questions)
writeJson(join(outDir, 'assets.json'), result.assets)

const report = formatMigrationReport(result)
writeFileSync(join(outDir, 'migration-report.md'), report, 'utf8')
console.log(report)
console.log(`Vorschlag geschrieben nach ${outDir}.`)
console.log('Naechster Schritt: Bericht pruefen, Dateien nach content/source uebernehmen, dann "pnpm content:validate".')
