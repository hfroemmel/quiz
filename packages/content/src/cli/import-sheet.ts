/**
 * `quiz-content import-sheet` - eine Redaktionstabelle wird zu `questions.json`.
 *
 * Der Weg ist Absicht so kurz: Google liefert jede freigegebene Tabelle als CSV
 * aus, ohne API-Schluessel und ohne Dienstkonto. Was dieses Werkzeug braucht,
 * ist die Adresse aus der Browserzeile und eine Freigabe "Jeder mit dem Link
 * kann lesen".
 *
 * DIE TABELLE IST DIE QUELLE. `questions.json` ist das Erzeugnis und wird
 * ueberschrieben; wer im Erzeugnis korrigiert, verliert es beim naechsten Lauf.
 *
 *   quiz-content import-sheet --url <adresse> [--mapping <datei>] [--out <datei>]
 *   quiz-content import-sheet --csv <datei>            aus einer heruntergeladenen Datei
 *   quiz-content import-sheet --url <adresse> --print-headers   nur die Spalten zeigen
 *   quiz-content import-sheet --url <adresse> --dry-run         nichts schreiben
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { csvAdresse, importiereTabelle, standardMapping, type SheetMapping } from '../sheetImport'
import { contentDir } from './dirs'
import { join } from 'node:path'

const argv = process.argv.slice(2)

function option(name: string): string | undefined {
  const stelle = argv.indexOf(`--${name}`)
  return stelle >= 0 ? argv[stelle + 1] : undefined
}
const schalter = (name: string): boolean => argv.includes(`--${name}`)

const url = option('url')
const csvDatei = option('csv')

if (!url && !csvDatei) {
  console.error('Es fehlt die Quelle: --url <Google-Tabelle> oder --csv <Datei>.')
  process.exit(1)
}

async function leseCsv(): Promise<string> {
  if (csvDatei) return readFileSync(csvDatei, 'utf8')

  const adresse = csvAdresse(url!)
  console.log(`Lade ${adresse}`)
  const antwort = await fetch(adresse, { redirect: 'follow' })
  if (!antwort.ok) {
    throw new Error(
      `Die Tabelle antwortete mit ${antwort.status}. ` +
        'Ist sie fuer "Jeder mit dem Link" freigegeben? Sonst liefert Google statt der Daten eine Anmeldeseite.',
    )
  }
  const text = await antwort.text()
  /*
   * Eine nicht freigegebene Tabelle antwortet mit 200 und einer HTML-Seite -
   * ohne diese Pruefung entstuenden daraus stumm null Fragen.
   */
  if (text.trimStart().startsWith('<')) {
    throw new Error(
      'Google hat eine HTML-Seite geliefert statt der Tabelle. ' +
        'Das ist die Anmeldeseite: Die Tabelle ist nicht fuer "Jeder mit dem Link" freigegeben.',
    )
  }
  return text
}

function leseMapping(): SheetMapping {
  const pfad = option('mapping')
  if (!pfad) return standardMapping
  const gelesen = JSON.parse(readFileSync(pfad, 'utf8')) as SheetMapping
  // Vorgaben und Wertetabellen ergaenzen die Standardzuordnung, statt sie zu ersetzen.
  return {
    spalten: { ...standardMapping.spalten, ...gelesen.spalten },
    vorgaben: { ...standardMapping.vorgaben, ...gelesen.vorgaben },
    werte: { ...standardMapping.werte, ...gelesen.werte },
  }
}

const csv = await leseCsv()

if (schalter('print-headers')) {
  const { spalten } = importiereTabelle(csv, { spalten: {} })
  console.log('Spalten der Tabelle:')
  for (const [stelle, name] of spalten.entries()) console.log(`  ${stelle + 1}. ${name}`)
  console.log('')
  console.log('Diese Namen gehoeren in die Zuordnungsdatei (--mapping).')
  process.exit(0)
}

const befund = importiereTabelle(csv, leseMapping())

console.log(`Gelesen: ${befund.fragen.length} Fragen aus ${befund.spalten.length} Spalten.`)
if (befund.uebersprungen.length > 0) {
  console.log('')
  console.log(`Uebersprungen: ${befund.uebersprungen.length} Zeilen`)
  for (const eintrag of befund.uebersprungen) console.log(`  Zeile ${eintrag.zeile}: ${eintrag.grund}`)
}

if (befund.fragen.length === 0) {
  console.error('')
  console.error('Keine einzige Frage uebernommen. Meist stimmt die Spaltenzuordnung nicht -')
  console.error('"--print-headers" zeigt, wie die Spalten wirklich heissen.')
  process.exit(1)
}

if (schalter('dry-run')) {
  console.log('')
  console.log('Probelauf - es wurde nichts geschrieben.')
  process.exit(0)
}

const ziel = option('out') ?? join(contentDir(argv, 'source', 'source'), 'questions.json')
writeFileSync(ziel, `${JSON.stringify(befund.fragen, null, 2)}\n`, 'utf8')
console.log('')
console.log(`Geschrieben: ${ziel}`)
console.log('Naechster Schritt: quiz-content validate')

export {}
