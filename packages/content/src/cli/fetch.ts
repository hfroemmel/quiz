/**
 * `pnpm content:fetch` - optionaler Abruf der redaktionellen Quelle.
 *
 * Der Abruf ist ausdruecklich OPTIONAL (Spezifikation 24.2). Der Build der
 * Veranstaltungssoftware darf zur Laufzeit nicht von Google Sheets abhaengen;
 * verbindlich ist immer das gebaute, gepruefte Paket unter `content/dist`.
 *
 * Ablauf laut Spezifikation 24.1:
 *   Google Sheet -> finale redaktionelle Uebergabe -> KI-gestuetzte Rechtschreibpruefung
 *   -> MENSCHLICHE FREIGABE -> Import -> strenge Validierung -> versioniertes Paket
 *
 * KI-Vorschlaege duerfen nicht ungeprueft uebernommen werden: Eigennamen, politische
 * Begriffe, historische Schreibweisen und absichtlich falsche Antwortoptionen wuerden
 * sonst stillschweigend veraendert. Dieses Skript schreibt deshalb ausschliesslich
 * nach `content/incoming` und niemals direkt nach `content/source`.
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
