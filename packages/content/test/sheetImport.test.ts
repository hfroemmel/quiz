/**
 * Der Import aus der Redaktionstabelle.
 *
 * Geprueft wird auf einer Zeichenkette und ohne Netz - die Tabelle ist hier eine
 * Zeile CSV. Genau das ist der Grund, warum das Uebersetzen von dem Holen
 * getrennt ist.
 */
import { describe, expect, it } from 'vitest'
import { parseCsv } from '../src/csv'
import { csvAdresse, importiereTabelle, standardMapping } from '../src/sheetImport'

const kopf = 'ID,Frage,Schwierigkeit,Kategorie,A,B,C,D,Richtig,Erklärung\n'

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
    const csv = `${kopf}1,Wie viele Abgeordnete hat der Bundestag?,leicht,Institution,598,630,736,709,C,Stand 2021.\n`
    const { fragen, uebersprungen } = importiereTabelle(csv)

    expect(uebersprungen).toEqual([])
    expect(fragen).toHaveLength(1)
    expect(fragen[0]).toMatchObject({
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
    expect(fragen[0]!.options).toEqual([
      { id: 'a', text: '598' },
      { id: 'b', text: '630' },
      { id: 'c', text: '736' },
      { id: 'd', text: '709' },
    ])
    expect(fragen[0]!.explanation).toEqual({ summary: 'Stand 2021.' })
  })

  it('liest die richtige Antwort als Buchstabe, als Nummer und als Text', () => {
    const zeile = (richtig: string) => `${kopf}1,Frage?,leicht,Recht,Alpha,Beta,Gamma,Delta,${richtig},\n`
    for (const [wert, erwartet] of [
      ['B', 'b'],
      ['2', 'b'],
      ['Beta', 'b'],
      ['beta', 'b'],
    ] as const) {
      expect(importiereTabelle(zeile(wert)).fragen[0]!.correctOptionId).toBe(erwartet)
    }
  })

  it('meldet eine Zeile mit Zeilennummer, statt den ganzen Bestand fallen zu lassen', () => {
    /*
     * Zweihundert Fragen wegen einer halbfertigen Zeile gar nicht zu bekommen,
     * waere in der Redaktion die teurere Antwort.
     */
    const csv =
      `${kopf}` +
      '1,Gute Frage?,leicht,Recht,Alpha,Beta,,,A,\n' +
      '2,,leicht,Recht,Alpha,Beta,,,A,\n' +
      '3,Ohne Loesung?,leicht,Recht,Alpha,Beta,,,Zeta,\n'
    const { fragen, uebersprungen } = importiereTabelle(csv)

    expect(fragen.map((frage) => frage.id)).toEqual(['1'])
    expect(uebersprungen).toEqual([
      { zeile: 3, grund: 'Keine Frage in der Fragespalte.' },
      { zeile: 4, grund: 'Die richtige Antwort ist nicht zuzuordnen.' },
    ])
  })

  it('macht aus Beschriftungen gueltige Bezeichner', () => {
    const csv = `${kopf}Frage 7,Wer?,schwer,"Ämter & Recht, Wahl",,,,,,\n`
    const frage = importiereTabelle(csv).fragen[0]!
    expect(frage.id).toBe('frage-7')
    expect(frage.difficulty).toBe('hard')
    expect(frage.categories).toEqual(['aemter-recht', 'wahl'])
    // Ohne Optionen ist es keine Auswahlfrage - bewertet wird von Hand.
    expect(frage.evaluationMode).toBe('manual-correct-incorrect')
  })

  it('nimmt eine eigene Spaltenzuordnung entgegen', () => {
    const csv = 'Nr,Question,Level\n7,Who?,hard\n'
    const { fragen } = importiereTabelle(csv, {
      spalten: { id: 'Nr', prompt: 'Question', difficulty: 'Level' },
      vorgaben: { poolIds: ['saarbruecken'], audiences: ['kids'], locale: 'en-GB' },
      werte: { difficulty: { hard: 'hard' } },
    })
    expect(fragen[0]).toMatchObject({
      id: '7',
      prompt: 'Who?',
      difficulty: 'hard',
      poolIds: ['saarbruecken'],
      audiences: ['kids'],
      locale: 'en-GB',
    })
  })

  it('nennt die gelesenen Spalten, damit eine falsche Zuordnung auffindbar ist', () => {
    expect(importiereTabelle('Nr,Question\n', { spalten: {} }).spalten).toEqual(['Nr', 'Question'])
  })
})

describe('csvAdresse', () => {
  it('macht aus der Adresse der Browserzeile die CSV-Adresse - mit Tabellenblatt', () => {
    expect(csvAdresse('https://docs.google.com/spreadsheets/d/ABC123/edit?gid=951895018#gid=951895018')).toBe(
      'https://docs.google.com/spreadsheets/d/ABC123/export?format=csv&gid=951895018',
    )
  })

  it('kommt auch mit der blossen Kennung aus', () => {
    expect(csvAdresse('ABC123')).toBe('https://docs.google.com/spreadsheets/d/ABC123/export?format=csv')
  })
})

describe('standardMapping', () => {
  it('nennt vier Antwortspalten - die Buehne zeigt vier Zeilen', () => {
    expect(standardMapping.spalten.options).toEqual(['A', 'B', 'C', 'D'])
  })
})
