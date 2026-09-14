/**
 * CSV lesen - nach RFC 4180, ohne Abhaengigkeit.
 *
 * WARUM NICHT `zeile.split(',')`: In einer redaktionellen Tabelle steht in fast
 * jeder zweiten Frage ein Komma, und in Erklaerungstexten stehen Zeilenumbrueche
 * und Anfuehrungszeichen. Ein naives Trennen zerlegt genau die Zellen, auf die
 * es ankommt - und zwar still, mit einer um eins verschobenen Spalte.
 *
 * Die Regeln sind kurz: Felder trennt das Komma, Zeilen der Umbruch. Ein Feld in
 * Anfuehrungszeichen darf beides enthalten; ein doppeltes Anfuehrungszeichen
 * darin bedeutet eines.
 */

export function parseCsv(text: string): string[][] {
  // Ein BOM aus Tabellenprogrammen gehoert nicht in die erste Spaltenueberschrift.
  const raw = text.replace(/^﻿/, '')

  const rows: string[][] = []
  let cell = ''
  let row: string[] = []
  let quoted = false

  for (let i = 0; i < raw.length; i += 1) {
    const char = raw[i]!

    if (quoted) {
      if (char !== '"') {
        cell += char
        continue
      }
      // Verdoppeltes Anfuehrungszeichen steht fuer eines im Text.
      if (raw[i + 1] === '"') {
        cell += '"'
        i += 1
        continue
      }
      quoted = false
      continue
    }

    if (char === '"') {
      quoted = true
      continue
    }
    if (char === ',') {
      row.push(cell)
      cell = ''
      continue
    }
    if (char === '\r') continue
    if (char === '\n') {
      row.push(cell)
      rows.push(row)
      cell = ''
      row = []
      continue
    }
    cell += char
  }

  // Die letzte Zeile endet oft ohne Umbruch.
  if (cell !== '' || row.length > 0) {
    row.push(cell)
    rows.push(row)
  }

  /*
   * Leere Zeilen fliegen raus. Tabellen haben am Ende regelmaessig ein paar
   * davon, und aus ihnen entstuende sonst je eine Frage ohne Text.
   */
  return rows.filter((entry) => entry.some((value) => value.trim() !== ''))
}

/**
 * Kopfzeile und Datenzeilen zu Objekten verbinden.
 *
 * Spaltennamen werden getrimmt; doppelte Namen gewinnt der erste - sonst
 * ueberschriebe eine zweite Spalte "Frage" still die erste.
 */
export function csvToRows(text: string): { columns: string[]; rows: Record<string, string>[] } {
  const sheet = parseCsv(text)
  const head = (sheet[0] ?? []).map((name) => name.trim())

  const rows = sheet.slice(1).map((values) => {
    const row: Record<string, string> = {}
    head.forEach((name, index) => {
      if (name !== '' && !(name in row)) row[name] = (values[index] ?? '').trim()
    })
    return row
  })

  return { columns: head, rows }
}

/* Former names, kept for one release so that hosts can migrate. */
/** @deprecated Renamed to `csvToRows`. */
export const csvZuZeilen = csvToRows
