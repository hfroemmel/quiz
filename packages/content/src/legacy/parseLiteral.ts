/**
 * Sicherer Parser fuer JavaScript-Objektliterale.
 *
 * Die Legacy-Dateien `questions.js` und `config.js` sind JavaScript, aber ihr Inhalt
 * ist reine Datenstruktur. Der Migrationscode darf sie ausdruecklich NICHT per `eval`
 * oder `vm` ausfuehren (Spezifikation 26.1): eine fremde Datei koennte sonst beliebigen
 * Code im Build ausfuehren.
 *
 * Dieser Parser liest deshalb nur Literale und fuehrt nichts aus. Unterstuetzt werden
 * die Formen, die in den Altdaten tatsaechlich vorkommen:
 *   Objekte, Arrays, Strings (einfache und doppelte Anfuehrungszeichen), Zahlen,
 *   true/false/null, unquotierte Schluessel, nachgestellte Kommata, Kommentare.
 * Alles andere - insbesondere Funktionsaufrufe und Template-Literale mit Ausdruecken -
 * fuehrt zu einem klaren Fehler statt zu stiller Fehlinterpretation.
 */

export class LiteralParseError extends Error {
  constructor(
    message: string,
    readonly offset: number,
    readonly line: number,
  ) {
    super(`${message} (Zeile ${line})`)
    this.name = 'LiteralParseError'
  }
}

export type LiteralValue = string | number | boolean | null | LiteralValue[] | { [key: string]: LiteralValue }

class Reader {
  index = 0
  constructor(readonly source: string) {}

  get line(): number {
    let line = 1
    for (let i = 0; i < this.index && i < this.source.length; i += 1) if (this.source[i] === '\n') line += 1
    return line
  }

  fail(message: string): never {
    throw new LiteralParseError(message, this.index, this.line)
  }

  peek(): string | undefined {
    return this.source[this.index]
  }

  skipTrivia(): void {
    for (;;) {
      const char = this.source[this.index]
      if (char === undefined) return
      if (char === ' ' || char === '\t' || char === '\n' || char === '\r') {
        this.index += 1
        continue
      }
      if (char === '/' && this.source[this.index + 1] === '/') {
        while (this.index < this.source.length && this.source[this.index] !== '\n') this.index += 1
        continue
      }
      if (char === '/' && this.source[this.index + 1] === '*') {
        const end = this.source.indexOf('*/', this.index + 2)
        if (end === -1) this.fail('Nicht geschlossener Blockkommentar')
        this.index = end + 2
        continue
      }
      return
    }
  }

  expect(char: string): void {
    this.skipTrivia()
    if (this.source[this.index] !== char) this.fail(`Erwartet "${char}", gefunden "${this.source[this.index] ?? 'Dateiende'}"`)
    this.index += 1
  }
}

export function parseLiteral(source: string, startIndex = 0): { value: LiteralValue; endIndex: number } {
  const reader = new Reader(source)
  reader.index = startIndex
  const value = readValue(reader)
  return { value, endIndex: reader.index }
}

function readValue(reader: Reader): LiteralValue {
  reader.skipTrivia()
  const char = reader.peek()
  if (char === undefined) reader.fail('Unerwartetes Dateiende')
  if (char === '{') return readObject(reader)
  if (char === '[') return readArray(reader)
  if (char === '"' || char === "'" || char === '`') return readString(reader)
  if (char === '-' || char === '+' || (char >= '0' && char <= '9')) return readNumber(reader)

  const word = readWord(reader)
  if (word === 'true') return true
  if (word === 'false') return false
  if (word === 'null') return null
  if (word === 'undefined') return null
  reader.fail(`Nicht unterstuetzter Ausdruck "${word}". Der Legacy-Parser liest ausschliesslich Literale.`)
}

function readObject(reader: Reader): { [key: string]: LiteralValue } {
  reader.expect('{')
  const result: { [key: string]: LiteralValue } = {}
  for (;;) {
    reader.skipTrivia()
    if (reader.peek() === '}') {
      reader.index += 1
      return result
    }
    const key = readKey(reader)
    reader.expect(':')
    result[key] = readValue(reader)
    reader.skipTrivia()
    if (reader.peek() === ',') {
      reader.index += 1
      continue
    }
    if (reader.peek() === '}') {
      reader.index += 1
      return result
    }
    reader.fail('Erwartet "," oder "}"')
  }
}

function readArray(reader: Reader): LiteralValue[] {
  reader.expect('[')
  const result: LiteralValue[] = []
  for (;;) {
    reader.skipTrivia()
    if (reader.peek() === ']') {
      reader.index += 1
      return result
    }
    result.push(readValue(reader))
    reader.skipTrivia()
    if (reader.peek() === ',') {
      reader.index += 1
      continue
    }
    if (reader.peek() === ']') {
      reader.index += 1
      return result
    }
    reader.fail('Erwartet "," oder "]"')
  }
}

function readKey(reader: Reader): string {
  reader.skipTrivia()
  const char = reader.peek()
  if (char === '"' || char === "'" || char === '`') return readString(reader)
  const word = readWord(reader)
  if (!word) reader.fail('Leerer Objektschluessel')
  return word
}

function readWord(reader: Reader): string {
  reader.skipTrivia()
  const start = reader.index
  while (reader.index < reader.source.length && /[A-Za-z0-9_$]/.test(reader.source[reader.index]!)) {
    reader.index += 1
  }
  if (start === reader.index) reader.fail(`Unerwartetes Zeichen "${reader.source[start] ?? 'Dateiende'}"`)
  return reader.source.slice(start, reader.index)
}

function readNumber(reader: Reader): number {
  reader.skipTrivia()
  const start = reader.index
  if (reader.peek() === '-' || reader.peek() === '+') reader.index += 1
  while (reader.index < reader.source.length && /[0-9._eE+-]/.test(reader.source[reader.index]!)) {
    const char = reader.source[reader.index]!
    // "+"/"-" gehoeren nur direkt hinter einem Exponenten zur Zahl.
    if ((char === '+' || char === '-') && !/[eE]/.test(reader.source[reader.index - 1] ?? '')) break
    reader.index += 1
  }
  const text = reader.source.slice(start, reader.index).replace(/_/g, '')
  const value = Number(text)
  if (Number.isNaN(value)) reader.fail(`Ungueltige Zahl "${text}"`)
  return value
}

function readString(reader: Reader): string {
  const quote = reader.source[reader.index]
  if (quote === undefined) reader.fail('Unerwartetes Dateiende in Zeichenkette')
  reader.index += 1
  let result = ''
  for (;;) {
    const char = reader.source[reader.index]
    if (char === undefined) reader.fail('Nicht geschlossene Zeichenkette')
    if (char === '\\') {
      const escaped = reader.source[reader.index + 1]
      reader.index += 2
      switch (escaped) {
        case 'n':
          result += '\n'
          break
        case 't':
          result += '\t'
          break
        case 'r':
          result += '\r'
          break
        case 'b':
          result += '\b'
          break
        case 'f':
          result += '\f'
          break
        case 'u': {
          const hex = reader.source.slice(reader.index, reader.index + 4)
          if (!/^[0-9a-fA-F]{4}$/.test(hex)) reader.fail('Ungueltige Unicode-Escapesequenz')
          result += String.fromCharCode(Number.parseInt(hex, 16))
          reader.index += 4
          break
        }
        case '\n':
          break
        default:
          result += escaped ?? ''
      }
      continue
    }
    if (char === quote) {
      reader.index += 1
      return result
    }
    if (quote === '`' && char === '$' && reader.source[reader.index + 1] === '{') {
      reader.fail('Template-Literale mit Ausdruecken werden nicht unterstuetzt')
    }
    result += char
    reader.index += 1
  }
}

/**
 * Findet die deklarierten Datenstrukturen einer Legacy-Datei.
 *
 * Erkannt werden `const/let/var NAME = <literal>`, `window.NAME = <literal>`,
 * `module.exports = <literal>` und `export default <literal>`.
 */
export function extractDeclarations(source: string): Map<string, LiteralValue> {
  const result = new Map<string, LiteralValue>()
  const patterns: { regex: RegExp; nameGroup: number }[] = [
    { regex: /(?:^|[\n;])\s*(?:const|let|var)\s+([A-Za-z0-9_$]+)\s*=\s*(?=[[{])/g, nameGroup: 1 },
    { regex: /(?:^|[\n;])\s*(?:window|globalThis)\.([A-Za-z0-9_$]+)\s*=\s*(?=[[{])/g, nameGroup: 1 },
    { regex: /(?:^|[\n;])\s*module\.(exports)\s*=\s*(?=[[{])/g, nameGroup: 1 },
    { regex: /(?:^|[\n;])\s*export\s+(default)\s+(?=[[{])/g, nameGroup: 1 },
  ]

  for (const { regex, nameGroup } of patterns) {
    regex.lastIndex = 0
    let match: RegExpExecArray | null
    while ((match = regex.exec(source)) !== null) {
      const name = match[nameGroup]!
      const start = match.index + match[0].length
      const { value, endIndex } = parseLiteral(source, start)
      result.set(name, value)
      regex.lastIndex = endIndex
    }
  }
  return result
}
