/**
 * Reading a workbook.
 *
 * The fixtures are BUILT HERE, as zip containers with stored entries: a test
 * that needs a binary file next to it can only be read, not understood, and
 * the cases that matter in this format are exactly the ones a hand-written
 * example states - a cell that points into the string table, one that carries
 * its text itself, a formula with its last computed value, a hole in the
 * middle of a row, and a missing row.
 */
import { deflateRawSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'
import { readWorkbook } from '../src/workbook'

/** A zip container with the given files - stored or deflated. */
function zip(files: Record<string, string>, { compress = false } = {}): Buffer {
  const parts: Buffer[] = []
  const directory: Buffer[] = []
  let offset = 0

  for (const [name, text] of Object.entries(files)) {
    const nameBytes = Buffer.from(name, 'utf8')
    const raw = Buffer.from(text, 'utf8')
    const body = compress ? deflateRawSync(raw) : raw
    const method = compress ? 8 : 0

    const local = Buffer.alloc(30)
    local.writeUInt32LE(0x04034b50, 0)
    local.writeUInt16LE(20, 4)
    local.writeUInt16LE(method, 8)
    local.writeUInt32LE(0, 14) // no crc check happens here
    local.writeUInt32LE(body.length, 18)
    local.writeUInt32LE(raw.length, 22)
    local.writeUInt16LE(nameBytes.length, 26)
    parts.push(local, nameBytes, body)

    const central = Buffer.alloc(46)
    central.writeUInt32LE(0x02014b50, 0)
    central.writeUInt16LE(20, 6)
    central.writeUInt16LE(method, 10)
    central.writeUInt32LE(body.length, 20)
    central.writeUInt32LE(raw.length, 24)
    central.writeUInt16LE(nameBytes.length, 28)
    central.writeUInt32LE(offset, 42)
    directory.push(central, nameBytes)

    offset += local.length + nameBytes.length + body.length
  }

  const entries = Buffer.concat(directory)
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0)
  end.writeUInt16LE(Object.keys(files).length, 8)
  end.writeUInt16LE(Object.keys(files).length, 10)
  end.writeUInt32LE(entries.length, 12)
  end.writeUInt32LE(offset, 16)
  return Buffer.concat([...parts, entries, end])
}

const workbookXml = `<?xml version="1.0"?><workbook xmlns:r="x"><sheets>
  <sheet name="Fragen" sheetId="1" r:id="rId1"/>
  <sheet name="Bilder &amp; Rechte" sheetId="2" r:id="rId2"/>
</sheets></workbook>`

const relationships = `<?xml version="1.0"?><Relationships>
  <Relationship Id="rId1" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Target="worksheets/sheet2.xml"/>
</Relationships>`

const strings = `<?xml version="1.0"?><sst count="4">
  <si><t>Frage</t></si>
  <si><t>Wer </t><t>fragt?</t></si>
  <si><t>Bild &amp; Nachweis</t></si>
  <si><t xml:space="preserve">Ja </t></si>
</sst>`

/*
 * Row 1 is the header, row 2 a data row with a hole at B, row 4 exists while
 * row 3 does not - the shapes a real sheet has.
 */
const sheetOne = `<?xml version="1.0"?><worksheet><sheetData>
  <row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>2</v></c><c r="C1" t="inlineStr"><is><t>Zahl</t></is></c></row>
  <row r="2"><c r="A2" t="s"><v>1</v></c><c r="B2" s="11"/><c r="C2"><v>42</v></c></row>
  <row r="4"><c r="A4" t="str"><v>aus Formel</v></c><c r="B4" t="s"><v>3</v></c></row>
  <row r="5" s="2"/>
</sheetData></worksheet>`

const sheetTwo = `<?xml version="1.0"?><worksheet><sheetData>
  <row r="1"><c r="A1" t="inlineStr"><is><t>Datei</t></is></c></row>
</sheetData></worksheet>`

const files = {
  'xl/workbook.xml': workbookXml,
  'xl/_rels/workbook.xml.rels': relationships,
  'xl/sharedStrings.xml': strings,
  'xl/worksheets/sheet1.xml': sheetOne,
  'xl/worksheets/sheet2.xml': sheetTwo,
}

describe('readWorkbook', () => {
  it('names the sheets in the order of the tabs', () => {
    const workbook = readWorkbook(zip(files))
    expect(workbook.sheets).toEqual(['Fragen', 'Bilder & Rechte'])
  })

  it('reads the cells of a sheet, whatever they carry', () => {
    const workbook = readWorkbook(zip(files))
    const grid = workbook.grid('Fragen')

    // The header: two cells out of the string table, one carrying its own text.
    expect(grid[0]).toEqual(['Frage', 'Bild & Nachweis', 'Zahl'])
    /*
     * Runs of one cell are joined, and the EMPTY CELL IN THE MIDDLE stays empty
     * while the cell behind it keeps its column. A spreadsheet writes a styled
     * but empty cell as `<c r="B2" s="11"/>`, and reading that as an opening tag
     * eats the cell behind it: C's raw value would arrive under B, unresolved,
     * and the whole row would be shifted by one in a way that looks like data.
     */
    expect(grid[1]).toEqual(['Wer fragt?', '', '42'])
    // A row the sheet does not store is empty, and the rows behind it keep
    // their place - a report that says "row 4" means row 4.
    expect(grid[2]).toEqual([])
    expect(grid[3]).toEqual(['aus Formel', 'Ja '])
    // A row without cells is a row, not a missing one.
    expect(grid[4]).toEqual([])
  })

  it('reads a deflated workbook the same way', () => {
    // Every workbook a spreadsheet program writes is packed; stored entries
    // exist, so both ways are read.
    const grid = readWorkbook(zip(files, { compress: true })).grid('Fragen')
    expect(grid[1]).toEqual(['Wer fragt?', '', '42'])
  })

  it('takes the first sheet without being asked, and says so when a name is wrong', () => {
    const workbook = readWorkbook(zip(files))
    expect(workbook.grid()[0]).toEqual(['Frage', 'Bild & Nachweis', 'Zahl'])
    expect(() => workbook.grid('Fragen 2026')).toThrow(/Fragen, Bilder & Rechte/)
  })

  it('refuses a file that is not a workbook instead of reading nothing', () => {
    expect(() => readWorkbook(Buffer.from('id,question\n1,Wer?\n', 'utf8'))).toThrow(/Keine Arbeitsmappe/)
    const withoutSheets = { ...files, 'xl/workbook.xml': '<workbook><sheets/></workbook>' }
    expect(() => readWorkbook(zip(withoutSheets))).toThrow(/kein Tabellenblatt/)
  })
})
