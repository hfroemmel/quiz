/**
 * Read CSV - per RFC 4180, without a dependency.
 *
 * WHY NOT `line.split(',')`: In an editorial sheet almost every second question
 * contains a comma, and explanation texts contain line breaks and quotation
 * marks. A naive split breaks exactly the cells that matter - silently, with a
 * column shifted by one.
 *
 * The rules are short: fields are separated by the comma, rows by the line
 * break. A quoted field may contain both; a doubled quotation mark inside it
 * means one.
 */

export function parseCsv(text: string): string[][] {
  // A BOM from spreadsheet programs does not belong in the first column header.
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
      // A doubled quotation mark stands for one in the text.
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

  // The last row often ends without a line break.
  if (cell !== '' || row.length > 0) {
    row.push(cell)
    rows.push(row)
  }

  /*
   * Empty rows are dropped. Sheets regularly have a few of them at the end,
   * and each would otherwise become a question without text.
   */
  return rows.filter((entry) => entry.some((value) => value.trim() !== ''))
}

/**
 * Join the header row and the data rows into objects.
 *
 * Column names are trimmed; on duplicate names the first wins - otherwise a
 * second "Frage" column would silently overwrite the first.
 */
export function csvToRows(text: string): { columns: string[]; rows: Record<string, string>[] } {
  return gridToRows(parseCsv(text))
}

/**
 * A grid of cells becomes rows addressed by their column header.
 *
 * The step is separate from reading CSV because a CSV is no longer the only
 * way in: an Excel workbook arrives as the same grid (`readWorkbook`), and
 * from here on both take one route.
 */
export function gridToRows(sheet: string[][]): { columns: string[]; rows: Record<string, string>[] } {
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
