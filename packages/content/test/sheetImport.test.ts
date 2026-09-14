/**
 * Der Import aus der Redaktionstabelle.
 *
 * Geprueft wird auf einer Zeichenkette und ohne Netz - die Tabelle ist hier eine
 * Zeile CSV. Genau das ist der Grund, warum das Uebersetzen von dem Holen
 * getrennt ist.
 */
import { describe, expect, it } from 'vitest'
import { parseCsv } from '../src/csv'
import { csvUrl, importSheet, defaultMapping } from '../src/sheetImport'

const head = 'ID,Frage,Schwierigkeit,Kategorie,A,B,C,D,Richtig,Erklärung\n'

describe('parseCsv', () => {
  it('haelt Komma, Zeilenumbruch und Anfuehrungszeichen in einer Zelle zusammen', () => {
    const csv = 'a,b\n"eins, zwei","Zeile 1\nZeile 2"\n"Er sagte ""ja""",x\n'
    expect(parseCsv(csv)).toEqual([
      ['a', 'b'],
      ['eins, zwei', 'Zeile 1\nZeile 2'],
      ['Er sagte "ja"', 'x'],
    ])
  })

  it('wirft leere Zeilen am Ende weg', () => {
    expect(parseCsv('a,b\n1,2\n\n\n')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ])
  })
})

describe('importiereTabelle', () => {
  it('macht aus einer Zeile eine gueltige Auswahlfrage', () => {
    const csv = `${head}1,Wie viele Abgeordnete hat der Bundestag?,leicht,Institution,598,630,736,709,C,Stand 2021.\n`
    const { questions, skippedRows } = importSheet(csv)

    expect(skippedRows).toEqual([])
    expect(questions).toHaveLength(1)
    expect(questions[0]).toMatchObject({
      id: '1',
      prompt: 'Wie viele Abgeordnete hat der Bundestag?',
      difficulty: 'easy',
      categories: ['institution'],
      questionType: 'text-choice',
      evaluationMode: 'option-comparison',
      correctOptionId: 'c',
      locale: 'de-DE',
      enabled: true,
    })
    expect(questions[0]!.options).toEqual([
      { id: 'a', text: '598' },
      { id: 'b', text: '630' },
      { id: 'c', text: '736' },
      { id: 'd', text: '709' },
    ])
    expect(questions[0]!.explanation).toEqual({ summary: 'Stand 2021.' })
  })

  it('liest die richtige Antwort als Buchstabe, als Nummer und als Text', () => {
    const row = (correct: string) => `${head}1,Frage?,leicht,Recht,Alpha,Beta,Gamma,Delta,${correct},\n`
    for (const [value, expected] of [
      ['B', 'b'],
      ['2', 'b'],
      ['Beta', 'b'],
      ['beta', 'b'],
    ] as const) {
      expect(importSheet(row(value)).questions[0]!.correctOptionId).toBe(expected)
    }
  })

  it('meldet eine Zeile mit Zeilennummer, statt den ganzen Bestand fallen zu lassen', () => {
    /*
     * Zweihundert Fragen wegen einer halbfertigen Zeile gar nicht zu bekommen,
     * waere in der Redaktion die teurere Antwort.
     */
    const csv =
      `${head}` +
      '1,Gute Frage?,leicht,Recht,Alpha,Beta,,,A,\n' +
      '2,,leicht,Recht,Alpha,Beta,,,A,\n' +
      '3,Ohne Loesung?,leicht,Recht,Alpha,Beta,,,Zeta,\n'
    const { questions, skippedRows } = importSheet(csv)

    expect(questions.map((question) => question.id)).toEqual(['1'])
    expect(skippedRows).toEqual([
      { row: 3, reason: 'Keine Frage in der Fragespalte.' },
      { row: 4, reason: 'Die richtige Antwort ist nicht zuzuordnen.' },
    ])
  })

  it('macht aus Beschriftungen gueltige Bezeichner', () => {
    const csv = `${head}Frage 7,Wer?,schwer,"Ämter & Recht, Wahl",,,,,,\n`
    const question = importSheet(csv).questions[0]!
    expect(question.id).toBe('frage-7')
    expect(question.difficulty).toBe('hard')
    expect(question.categories).toEqual(['aemter-recht', 'wahl'])
    // Ohne Optionen ist es keine Auswahlfrage - bewertet wird von Hand.
    expect(question.evaluationMode).toBe('manual-correct-incorrect')
  })

  it('nimmt eine eigene Spaltenzuordnung entgegen', () => {
    const csv = 'Nr,Question,Level\n7,Who?,hard\n'
    const { questions } = importSheet(csv, {
      columns: { id: 'Nr', prompt: 'Question', difficulty: 'Level' },
      defaults: { poolIds: ['saarbruecken'], audiences: ['kids'], locale: 'en-GB' },
      values: { difficulty: { hard: 'hard' } },
    })
    expect(questions[0]).toMatchObject({
      id: '7',
      prompt: 'Who?',
      difficulty: 'hard',
      poolIds: ['saarbruecken'],
      audiences: ['kids'],
      locale: 'en-GB',
    })
  })

  it('nennt die gelesenen Spalten, damit eine falsche Zuordnung auffindbar ist', () => {
    expect(importSheet('Nr,Question\n', { columns: {} }).columns).toEqual(['Nr', 'Question'])
  })
})

describe('csvAdresse', () => {
  it('macht aus der Adresse der Browserzeile die CSV-Adresse - mit Tabellenblatt', () => {
    expect(csvUrl('https://docs.google.com/spreadsheets/d/ABC123/edit?gid=951895018#gid=951895018')).toBe(
      'https://docs.google.com/spreadsheets/d/ABC123/export?format=csv&gid=951895018',
    )
  })

  it('kommt auch mit der blossen Kennung aus', () => {
    expect(csvUrl('ABC123')).toBe('https://docs.google.com/spreadsheets/d/ABC123/export?format=csv')
  })
})

describe('standardMapping', () => {
  it('nennt vier Antwortspalten - die Buehne zeigt vier Zeilen', () => {
    expect(defaultMapping.columns.options).toEqual(['A', 'B', 'C', 'D'])
  })
})
