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
 * AND A WORKBOOK IS A SOURCE TOO. An editorial sheet does not always live in a
 * Google table; often it arrives as a file, `Fragen 2026.xlsx` in a mail.
 * `--xlsx` reads it directly, because "export it as CSV first" is a manual step
 * in front of an automated one - and whoever forgets it imports the previous
 * export.
 *
 *   quiz-content import-sheet --url <address> [--mapping <file>] [--out <file>]
 *   quiz-content import-sheet --csv <file>             from a downloaded file
 *   quiz-content import-sheet --xlsx <file> [--sheet <name>]   from a workbook
 *   quiz-content import-sheet --url <address> --print-headers   only show the columns
 *   quiz-content import-sheet --url <address> --dry-run         write nothing
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { csvUrl, importGrid, defaultMapping, type SheetMapping } from '../sheetImport'
import { parseCsv } from '../csv'
import { readWorkbook } from '../workbook'
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
const workbookFile = option('xlsx')

if (!url && !csvFile && !workbookFile) {
  console.error('Es fehlt die Quelle: --url <Google-Tabelle>, --csv <Datei> oder --xlsx <Arbeitsmappe>.')
  process.exit(1)
}

/**
 * The table as a grid - from a workbook, a file or the network.
 *
 * All three ways end in the same grid, and the import knows only that one.
 */
async function readGrid(): Promise<string[][]> {
  if (workbookFile) {
    const workbook = readWorkbook(readFileSync(workbookFile))
    const wanted = option('sheet')
    if (wanted === undefined && workbook.sheets.length > 1) {
      console.log(`Blaetter der Arbeitsmappe: ${workbook.sheets.join(', ')}`)
      console.log(`Gelesen wird das erste ("${workbook.sheets[0]}") - ein anderes waehlt "--sheet <Name>".`)
    }
    return workbook.grid(wanted)
  }
  return parseCsv(await readCsv())
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

const grid = await readGrid()

if (toggle('print-headers')) {
  const { columns } = importGrid(grid, { columns: {} })
  console.log('Spalten der Tabelle:')
  for (const [position, name] of columns.entries()) console.log(`  ${position + 1}. ${name}`)
  console.log('')
  console.log('Diese Namen gehoeren in die Zuordnungsdatei (--mapping).')
  process.exit(0)
}

const finding = importGrid(grid, readMapping())

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
