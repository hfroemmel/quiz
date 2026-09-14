/**
 * `pnpm content:migrate <questions.js> [config.js]`
 *
 * Translates the legacy sources into the new question model (specification
 * 26). The parser does NOT execute the files. The result lands as a proposal
 * under `content/migrated/` and is deliberately not adopted automatically into
 * `content/source` - the correction report needs human approval.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { contentDir } from './dirs'
import { formatMigrationReport, migrateLegacy } from '../legacy/migrate'
import { writeJson } from '../package'

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

const outDir = contentDir(process.argv.slice(2), 'out', 'migrated')
mkdirSync(outDir, { recursive: true })
writeJson(join(outDir, 'questions.json'), result.questions)
writeJson(join(outDir, 'assets.json'), result.assets)

const report = formatMigrationReport(result)
writeFileSync(join(outDir, 'migration-report.md'), report, 'utf8')
console.log(report)
console.log(`Vorschlag geschrieben nach ${outDir}.`)
console.log('Naechster Schritt: Bericht pruefen, Dateien nach content/source uebernehmen, dann "pnpm content:validate".')
