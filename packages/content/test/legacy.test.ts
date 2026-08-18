/**
 * Legacy-Migration (Spezifikation 26).
 *
 * Der Parser fuehrt die Legacy-Datei nicht aus. Die Tests belegen das, indem eine
 * Datei mit Funktionsaufruf zu einem klaren Fehler statt zu einem Seiteneffekt fuehrt.
 */
import { describe, expect, it } from 'vitest'
import { extractDeclarations, parseLiteral } from '../src/legacy/parseLiteral.ts'
import { formatMigrationReport, migrateLegacy, normalizeId } from '../src/legacy/migrate.ts'

describe('Sicherer Literal-Parser', () => {
  it('liest Objekte, Arrays, Kommentare und nachgestellte Kommata', () => {
    const source = `
      // Kommentar
      const questions = [
        {
          id: '1',
          /* Blockkommentar */
          question: "Wie viel ist 2 + 2?",
          option_1: 'Vier',
          nested: { a: [1, 2, 3,], b: true, c: null },
        },
      ];
    `
    const declarations = extractDeclarations(source)
    const questions = declarations.get('questions') as Record<string, unknown>[]
    expect(questions).toHaveLength(1)
    expect(questions[0]!['question']).toBe('Wie viel ist 2 + 2?')
    expect(questions[0]!['nested']).toEqual({ a: [1, 2, 3], b: true, c: null })
  })

  it('fuehrt keinen Code aus, sondern lehnt Ausdruecke klar ab', () => {
    expect(() => parseLiteral('{ id: doSomethingDangerous() }')).toThrow(/Nicht unterstuetzter Ausdruck/)
    expect(() => parseLiteral('{ id: `${process.env.SECRET}` }')).toThrow(/Template-Literale/)
  })

  it('erkennt window- und module.exports-Deklarationen', () => {
    expect(extractDeclarations('window.questions = [{ id: "1" }]').get('questions')).toEqual([{ id: '1' }])
    expect(extractDeclarations('module.exports = [{ id: "2" }]').get('exports')).toEqual([{ id: '2' }])
  })
})

describe('Migration ins neue Fragenmodell', () => {
  const legacy = `
    const questions = [
      {
        id: "1", mode: "adults", difficulty: "mittel", category: "Geschichte",
        type: "multiple_choice", question: "Wer war der erste Bundeskanzler?",
        option_1: "Konrad Adenauer", option_2: "Ludwig Erhard", option_3: "Willy Brandt", option_4: "Kurt Georg Kiesinger",
        info: "1949 bis 1963.", playCount: "0"
      },
      {
        id: "48", mode: "Kids", difficulty: "easy", category: "Natur",
        type: "image", question: "Welches Tier ist das?", answer: "Fuchs",
        image: "fuchs.jpg", source_reference: "Eigenes Foto", playCount: "0"
      },
      {
        id: "49", mode: "Kids", difficulty: "easy", category: "Natur",
        type: "image", question: "Welches Tier ist das?", answer: "Dachs",
        image: "dachs.jpg", playCount: "0"
      },
      {
        id: "151", mode: "adults", difficulty: "hard", category: "Wissenschaft",
        type: "multiple_choice", question: "Nur drei Optionen?",
        option_1: "A", option_2: "B", option_3: "C", playCount: "0"
      }
    ];
  `

  it('normalisiert Enumwerte und dokumentiert jede Korrektur', () => {
    const result = migrateLegacy({ questionsSource: legacy })
    const normalized = result.notes.filter((note) => note.severity === 'normalized')

    expect(normalized.some((note) => note.message.includes('"Kids" zu "kids"'))).toBe(true)
    expect(normalized.some((note) => note.message.includes('"mittel" zu "medium"'))).toBe(true)
    // Keine stille Korrektur: alles steht im Bericht.
    expect(formatMigrationReport(result)).toContain('Automatisch normalisiert')
  })

  it('macht die richtige Antwort explizit statt sie aus option_1 abzuleiten', () => {
    const result = migrateLegacy({ questionsSource: legacy })
    const first = result.questions.find((question) => question.id === '1')!
    expect(first.correctOptionId).toBe('option-1')
    expect(first.options?.find((option) => option.id === first.correctOptionId)?.text).toBe('Konrad Adenauer')
    expect(result.notes.some((note) => note.code === 'implicit-correct-answer')).toBe(true)
  })

  it('unterscheidet Bilderkennen von bildgestuetztem Multiple Choice', () => {
    const result = migrateLegacy({ questionsSource: legacy })
    expect(result.questions.find((question) => question.id === '48')!.presentationType).toBe('image-reveal')
    expect(result.questions.find((question) => question.id === '1')!.presentationType).toBe('text-choice')
  })

  it('erkennt gleiche Fragetexte als Wiederholungsgruppe', () => {
    const result = migrateLegacy({ questionsSource: legacy })
    const q48 = result.questions.find((question) => question.id === '48')!
    const q49 = result.questions.find((question) => question.id === '49')!
    expect(q48.repetitionGroupId).toBeDefined()
    expect(q48.repetitionGroupId).toBe(q49.repetitionGroupId)
    expect(result.notes.some((note) => note.code === 'repetition-group-detected')).toBe(true)
  })

  it('uebernimmt playCount nicht in den Inhalt', () => {
    const result = migrateLegacy({ questionsSource: legacy })
    for (const question of result.questions) {
      expect(question).not.toHaveProperty('playCount')
    }
    expect(result.notes.some((note) => note.code === 'playcount-dropped')).toBe(true)
  })

  it('meldet eine falsche Optionsanzahl zur Pruefung, statt sie zu erfinden', () => {
    const result = migrateLegacy({ questionsSource: legacy })
    const note = result.notes.find((entry) => entry.questionId === '151' && entry.code === 'option-count')
    expect(note?.severity).toBe('needs-review')
  })

  it('meldet abweichende Fragenplatzzahlen der Legacy-Konfiguration', () => {
    const result = migrateLegacy({
      questionsSource: legacy,
      configSource: 'const presets = { medium: { rounds: [1,2,3,4,5,6,7,8] }, easy: { rounds: [1,2,3,4,5,6,7] } };',
    })
    const note = result.notes.find((entry) => entry.code === 'preset-slot-count' && entry.message.includes('medium'))
    expect(note?.severity).toBe('needs-review')
    expect(note?.message).toContain('8 Fragenplaetze')
  })

  it('normalisiert IDs mit Umlauten', () => {
    expect(normalizeId('Saarbrücken')).toBe('saarbruecken')
    expect(normalizeId('Groß/Klein')).toBe('gross-klein')
  })
})

/**
 * Feldnamen des tatsaechlich gelieferten Katalogs.
 *
 * Die Altdaten benennen Schwierigkeit, Bilddatei und Bildnachweis anders als die
 * frueher angenommenen Namen. Diese Tests halten die Zuordnung fest - sie ist der
 * Unterschied zwischen "199 Fragen uebernommen" und "alle Fragen mittelschwer".
 */
describe('Feldnamen des gelieferten Katalogs', () => {
  const delivered = `
    export const questions = [
      {
        "id": "0", "playCount": "0", "mode": "adults", "level": "easy", "type": "image",
        "category": "Ämter", "question": "Welches Land stellt die meisten Abgeordneten?",
        "option_1": "Deutschland", "option_2": null, "option_3": null, "option_4": null,
        "img_filename": "europe.jpg", "img_credit": "Pixabay/Greg Montani",
        "source_reference": null, "info": "Gruendungsmitglied der EU."
      },
      {
        "id": "13", "playCount": "0", "mode": "Kids", "level": "hard", "type": "multiple_choice",
        "category": "Gebäude", "question": "Wo tagen die Fachausschuesse?",
        "option_1": "Paul-Loebe-Haus", "option_2": "Reichstagsgebaeude",
        "option_3": "Jakob-Kaiser-Haus", "option_4": "Marie-Elisabeth-Lueders-Haus",
        "img_filename": "plh.png", "img_credit": null, "info": null
      }
    ];
  `

  it('liest auch eine mit "export" deklarierte Fragenliste', () => {
    expect(extractDeclarations(delivered).has('questions')).toBe(true)
  })

  it('uebernimmt die Schwierigkeit aus dem Feld "level"', () => {
    const result = migrateLegacy({ questionsSource: delivered })
    expect(result.questions.map((question) => question.difficultyId)).toEqual(['easy', 'hard'])
  })

  it('erkennt die Bilddatei im Feld "img_filename" und den Nachweis in "img_credit"', () => {
    const result = migrateLegacy({ questionsSource: delivered })
    expect(result.skipped).toHaveLength(0)
    const asset = result.assets.find((entry) => entry.id === 'img-0')
    expect(asset?.filename).toBe('images/europe.jpg')
    expect(asset?.credit).toBe('Pixabay/Greg Montani')
    expect(result.notes.some((note) => note.code === 'missing-image-credit' && note.questionId === '13')).toBe(true)
  })

  it('macht aus der einzigen Legacy-Option des Bilderkennens keine sichtbare Antwortleiste', () => {
    const result = migrateLegacy({ questionsSource: delivered })
    const reveal = result.questions.find((question) => question.id === '0')
    expect(reveal?.presentationType).toBe('image-reveal')
    expect(reveal?.evaluationMode).toBe('manual-correct-incorrect')
    expect(reveal?.options).toBeUndefined()
    expect(reveal?.correctOptionId).toBeUndefined()
    expect(reveal?.acceptedAnswerText).toEqual(['Deutschland'])
  })
})
