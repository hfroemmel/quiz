/**
 * `quiz-content import-sheet` - an editorial sheet becomes `questions.json`.
 *
 * The path is deliberately this short: Google serves every shared sheet as
 * CSV, without API key and without a service account. What this tool needs is
 * the address from the browser bar and sharing set to "anyone with the link
 * can view".
 *
 * THE SHEET IS THE SOURCE. `questions.json` is the product and gets
 * overwritten; whoever corrects the product loses it on the next run.
 *
 *   quiz-content import-sheet --url <address> [--mapping <file>] [--out <file>]
 *   quiz-content import-sheet --csv <file>             from a downloaded file
 *   quiz-content import-sheet --url <address> --print-headers   only show the columns
 *   quiz-content import-sheet --url <address> --dry-run         write nothing
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { csvUrl, importSheet, defaultMapping, type SheetMapping } from '../sheetImport'
import { contentDir } from './dirs'
import { join } from 'node:path'

const argv = process.argv.slice(2)

function option(name: string): string | undefined {
  const position = argv.indexOf(`--${name}`)
  return position >= 0 ? argv[position + 1] : undefined
}
const toggle = (name: string): boolean => argv.includes(`--${name}`)

const url = option('url')
const csvFile = option('csv')

if (!url && !csvFile) {
  console.error('Es fehlt die Quelle: --url <Google-Tabelle> oder --csv <Datei>.')
  process.exit(1)
}

async function readCsv(): Promise<string> {
  if (csvFile) return readFileSync(csvFile, 'utf8')

  const address = csvUrl(url!)
  console.log(`Lade ${address}`)
  const answer = await fetch(address, { redirect: 'follow' })
  if (!answer.ok) {
    throw new Error(
      `Die Tabelle antwortete mit ${answer.status}. ` +
        'Ist sie fuer "Jeder mit dem Link" freigegeben? Sonst liefert Google statt der Daten eine Anmeldeseite.',
    )
  }
  const text = await answer.text()
  /*
   * A sheet that is not shared answers with 200 and an HTML page - without
   * this check that would silently produce zero questions.
   */
  if (text.trimStart().startsWith('<')) {
    throw new Error(
      'Google hat eine HTML-Seite geliefert statt der Tabelle. ' +
        'Das ist die Anmeldeseite: Die Tabelle ist nicht fuer "Jeder mit dem Link" freigegeben.',
    )
  }
  return text
}

function readMapping(): SheetMapping {
  const path = option('mapping')
  if (!path) return defaultMapping
  const raw = JSON.parse(readFileSync(path, 'utf8')) as Partial<SheetMapping> & {
    /** Former key names, still accepted for one release. */
    spalten?: SheetMapping['columns']
    vorgaben?: SheetMapping['defaults']
    werte?: SheetMapping['values']
  }
  // Defaults and value tables extend the default mapping instead of replacing it.
  return {
    columns: { ...defaultMapping.columns, ...(raw.columns ?? raw.spalten) },
    defaults: { ...defaultMapping.defaults, ...(raw.defaults ?? raw.vorgaben) },
    values: { ...defaultMapping.values, ...(raw.values ?? raw.werte) },
  }
}

const csv = await readCsv()

if (toggle('print-headers')) {
  const { columns } = importSheet(csv, { columns: {} })
  console.log('Spalten der Tabelle:')
  for (const [position, name] of columns.entries()) console.log(`  ${position + 1}. ${name}`)
  console.log('')
  console.log('Diese Namen gehoeren in die Zuordnungsdatei (--mapping).')
  process.exit(0)
}

const finding = importSheet(csv, readMapping())

console.log(`Gelesen: ${finding.questions.length} Fragen aus ${finding.columns.length} Spalten.`)
if (finding.skippedRows.length > 0) {
  console.log('')
  console.log(`Uebersprungen: ${finding.skippedRows.length} Zeilen`)
  for (const entry of finding.skippedRows) console.log(`  Zeile ${entry.row}: ${entry.reason}`)
}

if (finding.questions.length === 0) {
  console.error('')
  console.error('Keine einzige Frage uebernommen. Meist stimmt die Spaltenzuordnung nicht -')
  console.error('"--print-headers" zeigt, wie die Spalten wirklich heissen.')
  process.exit(1)
}

if (toggle('dry-run')) {
  console.log('')
  console.log('Probelauf - es wurde nichts geschrieben.')
  process.exit(0)
}

const target = option('out') ?? join(contentDir(argv, 'source', 'source'), 'questions.json')
writeFileSync(target, `${JSON.stringify(finding.questions, null, 2)}\n`, 'utf8')
console.log('')
console.log(`Geschrieben: ${target}`)
console.log('Naechster Schritt: quiz-content validate')

export {}
