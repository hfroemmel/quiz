/**
 * Read an Excel workbook - the sheet as a grid of strings.
 *
 * WHY AT ALL. Questions are born in a sheet, and the sheet arrives as a file:
 * `Fragen 2026.xlsx` in a mail, not a link to a shared Google table. Until now
 * the way in was "export the sheet as CSV first", which sounds small and is
 * not - it is a manual step in front of an automated one, it loses the second
 * sheet of the workbook (the picture list), and whoever forgets it imports the
 * previous export.
 *
 * WHY NO DEPENDENCY. An xlsx is a zip of XML files, and what is needed here is
 * one sheet as text. The libraries that read the format bring styles, number
 * formats, formulas and a date epoch with them - all of which an editorial
 * question sheet does not use. So: the zip container, enough XML to find the
 * cells, and nothing else.
 *
 * WHAT IT DOES NOT DO. No number formats and no dates: a cell arrives as the
 * text the sheet stored, and a question sheet holds text. A formula arrives as
 * its LAST COMPUTED value, which is what the file carries beside it - a
 * recalculation would need the whole function library. Where a workbook uses
 * zip64 (above four gigabytes, or more than 65535 entries) reading stops with
 * that as the reason instead of silently reading the wrong bytes.
 */
import { inflateRawSync } from 'node:zlib'

/** One entry of the zip container, still packed. */
interface Entry {
  name: string
  method: number
  offset: number
  compressedSize: number
}

const EOCD = 0x06054b50
const CENTRAL = 0x02014b50
const LOCAL = 0x04034b50
const ZIP64_MARK = 0xffffffff

/**
 * The entries of the container, read from the central directory.
 *
 * Deliberately not by scanning for local headers: their sizes may stand AFTER
 * the data (a streaming writer sets a flag and a trailer), while the central
 * directory always carries them. It sits at the end of the file, and the end
 * is where a zip is read from.
 */
function entries(data: Buffer): Map<string, Entry> {
  const limit = Math.min(data.length, 0xffff + 22)
  let start = -1
  for (let position = data.length - 22; position >= data.length - limit && position >= 0; position -= 1) {
    if (data.readUInt32LE(position) === EOCD) {
      start = position
      break
    }
  }
  if (start < 0) throw new Error('Keine Arbeitsmappe: Das Ende des Zip-Verzeichnisses fehlt.')

  const count = data.readUInt16LE(start + 10)
  const directory = data.readUInt32LE(start + 16)
  if (count === 0xffff || directory === ZIP64_MARK) {
    throw new Error('Die Arbeitsmappe ist im Zip64-Format. Bitte als xlsx ohne Zip64 oder als CSV exportieren.')
  }

  const found = new Map<string, Entry>()
  let cursor = directory
  for (let index = 0; index < count; index += 1) {
    if (data.readUInt32LE(cursor) !== CENTRAL) throw new Error('Das Zip-Verzeichnis der Arbeitsmappe ist beschaedigt.')
    const method = data.readUInt16LE(cursor + 10)
    const compressedSize = data.readUInt32LE(cursor + 20)
    const nameLength = data.readUInt16LE(cursor + 28)
    const extraLength = data.readUInt16LE(cursor + 30)
    const commentLength = data.readUInt16LE(cursor + 32)
    const offset = data.readUInt32LE(cursor + 42)
    const name = data.toString('utf8', cursor + 46, cursor + 46 + nameLength)
    if (offset === ZIP64_MARK || compressedSize === ZIP64_MARK) {
      throw new Error(`Der Eintrag "${name}" ist im Zip64-Format. Bitte als CSV exportieren.`)
    }
    found.set(name, { name, method, offset, compressedSize })
    cursor += 46 + nameLength + extraLength + commentLength
  }
  return found
}

/** The content of one entry, unpacked. */
function read(data: Buffer, entry: Entry): string {
  if (data.readUInt32LE(entry.offset) !== LOCAL) {
    throw new Error(`Der Eintrag "${entry.name}" der Arbeitsmappe steht nicht, wo das Verzeichnis ihn nennt.`)
  }
  const nameLength = data.readUInt16LE(entry.offset + 26)
  const extraLength = data.readUInt16LE(entry.offset + 28)
  const start = entry.offset + 30 + nameLength + extraLength
  const raw = data.subarray(start, start + entry.compressedSize)
  if (entry.method === 0) return raw.toString('utf8')
  if (entry.method === 8) return inflateRawSync(raw).toString('utf8')
  throw new Error(`Der Eintrag "${entry.name}" ist mit Verfahren ${entry.method} gepackt, das hier nicht gelesen wird.`)
}

/** The five entities XML always knows, plus numeric ones. */
function decode(text: string): string {
  return text
    .replace(/&#x([0-9a-fA-F]+);/g, (_, code: string) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number.parseInt(code, 10)))
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
}

/**
 * The text of a run-carrying element - `<si>` of the string table, `<is>` of an
 * inline cell.
 *
 * A cell's text can be split into runs, one per formatting change: a single
 * word in bold makes three of them. They are read in order and joined without
 * a separator, which is how the sheet shows them. A `<rPh>` - the reading aid
 * of Japanese sheets - is dropped, or it would be read twice.
 */
function textOf(xml: string): string {
  const withoutPhonetics = xml.replace(/<rPh[\s\S]*?<\/rPh>/g, '')
  const runs = withoutPhonetics.match(/<t\b[^>]*?\/>|<t\b[^>]*?>[\s\S]*?<\/t>/g) ?? []
  return runs
    .map((run) => (run.endsWith('/>') ? '' : decode(run.replace(/^<t\b[^>]*?>/, '').replace(/<\/t>$/, ''))))
    .join('')
}

/*
 * EVERY PATTERN HERE READS THE SELF-CLOSING FORM FIRST.
 *
 * `<c r="F2" s="11"/>` is an empty cell, and a pattern that takes its
 * attributes greedily swallows the slash, matches the opening-tag branch and
 * then reads to the NEXT `</c>` - it eats the cell behind it and reports its
 * raw value under the empty cell's column. A sheet whose F column is empty
 * then arrives with its G column shifted and unresolved, which is a shift that
 * looks like data. Hence the lazy attribute part: the alternation gets its
 * chance at `/>` at the earliest possible place.
 */

/** `BC` is the 55th column. */
function columnIndex(reference: string): number {
  const letters = /^[A-Z]+/.exec(reference)?.[0] ?? ''
  let index = 0
  for (const letter of letters) index = index * 26 + (letter.charCodeAt(0) - 64)
  return index - 1
}

export interface Workbook {
  /** The sheet names, in the order of the tabs. */
  sheets: string[]
  /**
   * One sheet as a grid of strings - by name, or the first one.
   *
   * Empty cells are empty strings, and a row is as long as its last filled
   * cell: a sheet stores only what somebody wrote, and a hole in the middle of
   * a row must not shift the cells behind it into the wrong column.
   */
  grid(sheet?: string): string[][]
}

export function readWorkbook(data: Buffer): Workbook {
  const files = entries(data)
  const need = (name: string): Entry => {
    const entry = files.get(name)
    if (!entry) throw new Error(`Keine Arbeitsmappe: "${name}" fehlt in der Datei.`)
    return entry
  }

  const workbookXml = read(data, need('xl/workbook.xml'))
  const relationships = read(data, need('xl/_rels/workbook.xml.rels'))

  const target = new Map<string, string>()
  for (const match of relationships.matchAll(/<Relationship\b[^>]*>/g)) {
    const id = /\bId="([^"]+)"/.exec(match[0])?.[1]
    const path = /\bTarget="([^"]+)"/.exec(match[0])?.[1]
    if (id && path) target.set(id, path.startsWith('/') ? path.slice(1) : `xl/${path}`)
  }

  const tabs: { name: string; path: string }[] = []
  for (const match of workbookXml.matchAll(/<sheet\b[^>]*>/g)) {
    const name = /\bname="([^"]*)"/.exec(match[0])?.[1]
    const id = /\br:id="([^"]+)"/.exec(match[0])?.[1]
    const path = id ? target.get(id) : undefined
    if (name !== undefined && path) tabs.push({ name: decode(name), path })
  }
  if (tabs.length === 0) throw new Error('Die Arbeitsmappe enthaelt kein Tabellenblatt.')

  /*
   * The string table, read once. Almost every text cell of a sheet points into
   * it instead of carrying its text - that is how the format keeps a column of
   * two hundred identical answers small.
   */
  const shared: string[] = []
  const table = files.get('xl/sharedStrings.xml')
  if (table) {
    for (const match of read(data, table).matchAll(/<si\b[^>]*?\/>|<si\b[^>]*?>([\s\S]*?)<\/si>/g)) {
      shared.push(textOf(match[1] ?? ''))
    }
  }

  return {
    sheets: tabs.map((tab) => tab.name),
    grid(sheet?: string): string[][] {
      const tab = sheet === undefined ? tabs[0]! : tabs.find((entry) => entry.name === sheet)
      if (!tab) {
        throw new Error(`Die Arbeitsmappe hat kein Blatt "${sheet}" - vorhanden: ${tabs.map((entry) => entry.name).join(', ')}.`)
      }
      const xml = read(data, need(tab.path))
      const rows: string[][] = []
      for (const rowMatch of xml.matchAll(/<row\b([^>]*?)\s*(?:\/>|>([\s\S]*?)<\/row>)/g)) {
        /*
         * The row number is read, not counted. A sheet stores only the rows
         * somebody wrote, so an empty row in the middle is simply absent - and
         * counting would move every row behind it up, which is exactly what a
         * report saying "row 87" must not do.
         */
        const attributes = rowMatch[1] ?? ''
        const number = Number.parseInt(/\br="(\d+)"/.exec(attributes)?.[1] ?? '', 10)
        if (Number.isFinite(number)) {
          while (rows.length < number - 1) rows.push([])
        }
        const cells: string[] = []
        for (const cellMatch of (rowMatch[2] ?? '').matchAll(/<c\b([^>]*?)\s*(?:\/>|>([\s\S]*?)<\/c>)/g)) {
          const cellAttributes = cellMatch[1] ?? ''
          const body = cellMatch[2] ?? ''
          const reference = /\br="([A-Z]+\d+)"/.exec(cellAttributes)?.[1]
          const kind = /\bt="([^"]+)"/.exec(cellAttributes)?.[1]
          let value: string
          if (kind === 's') {
            const index = Number.parseInt(/<v>([\s\S]*?)<\/v>/.exec(body)?.[1] ?? '', 10)
            value = shared[index] ?? ''
          } else if (kind === 'inlineStr') {
            value = textOf(body)
          } else {
            // `str` is a formula's text result, everything else a number or a
            // boolean - all of them stand in `<v>` as the sheet stored them.
            value = decode(/<v>([\s\S]*?)<\/v>/.exec(body)?.[1] ?? '')
          }
          const at = reference ? columnIndex(reference) : cells.length
          while (cells.length < at) cells.push('')
          cells[at] = value
        }
        rows.push(cells)
      }
      return rows
    },
  }
}
