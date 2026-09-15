/**
 * `pnpm content:fetch` - optional retrieval of the editorial source.
 *
 * The retrieval is explicitly OPTIONAL (specification 24.2). The build of the
 * event software must not depend on Google Sheets at runtime; the built,
 * validated package under `content/dist` is always what counts.
 *
 * Flow per specification 24.1:
 *   Google Sheet -> final editorial handover -> AI-assisted spell check
 *   -> HUMAN APPROVAL -> import -> strict validation -> versioned package
 *
 * AI suggestions must not be adopted unchecked: proper names, political terms,
 * historical spellings and deliberately wrong answer options would otherwise
 * be changed silently. This script therefore writes exclusively to
 * `content/incoming` and never directly to `content/source`.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { contentDir } from './dirs'

const sheetCsvUrl = process.env['QUIZ_SHEET_CSV_URL']
const outDir = contentDir(process.argv.slice(2), 'out', 'incoming')

if (!sheetCsvUrl) {
  console.log('Kein QUIZ_SHEET_CSV_URL gesetzt - es wird nichts abgerufen.')
  console.log('Der Offline-Build funktioniert unveraendert mit content/source und content/dist.')
  console.log('')
  console.log('Verwendung:')
  console.log('  QUIZ_SHEET_CSV_URL="https://docs.google.com/.../export?format=csv" pnpm content:fetch')
  process.exit(0)
}

const response = await fetch(sheetCsvUrl)
if (!response.ok) {
  console.error(`Abruf fehlgeschlagen: HTTP ${response.status}`)
  process.exit(1)
}
const csv = await response.text()

mkdirSync(outDir, { recursive: true })
const target = join(outDir, 'sheet.csv')
writeFileSync(target, csv, 'utf8')

console.log(`Rohdaten gespeichert: ${target}`)
console.log('WICHTIG: Diese Datei ist noch nicht freigegeben.')
console.log('Naechste Schritte: Rechtschreibpruefung, menschliche Freigabe, Uebernahme nach content/source,')
console.log('danach "pnpm content:validate" und "pnpm content:build".')
