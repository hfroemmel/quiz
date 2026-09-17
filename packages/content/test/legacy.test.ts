/**
 * Legacy migration (specification 26).
 *
 * The parser does not execute the legacy file. The tests prove that by making
 * a file with a function call lead to a clear error instead of a side effect.
 */
import { describe, expect, it } from 'vitest'
import { extractDeclarations, parseLiteral } from '../src/legacy/parseLiteral'
import { formatMigrationReport, migrateLegacy, normalizeId } from '../src/legacy/migrate'

describe('Safe literal parser', () => {
  it('reads objects, arrays, comments and trailing commas', () => {
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

  it('executes no code but rejects expressions clearly', () => {
    expect(() => parseLiteral('{ id: doSomethingDangerous() }')).toThrow(/Nicht unterstuetzter Ausdruck/)
    expect(() => parseLiteral('{ id: `${process.env.SECRET}` }')).toThrow(/Template-Literale/)
  })

  it('recognises window and module.exports declarations', () => {
    expect(extractDeclarations('window.questions = [{ id: "1" }]').get('questions')).toEqual([{ id: '1' }])
    expect(extractDeclarations('module.exports = [{ id: "2" }]').get('exports')).toEqual([{ id: '2' }])
  })
})

describe('Migration to the new question model', () => {
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

  it('normalises enum values and documents every correction', () => {
    const result = migrateLegacy({ questionsSource: legacy })
    const normalized = result.notes.filter((note) => note.severity === 'normalized')

    expect(normalized.some((note) => note.message.includes('"Kids" zu "kids"'))).toBe(true)
    expect(normalized.some((note) => note.message.includes('"mittel" zu "medium"'))).toBe(true)
    // No silent correction: everything is in the report.
    expect(formatMigrationReport(result)).toContain('Automatisch normalisiert')
  })

  it('makes the correct answer explicit instead of deriving it from option_1', () => {
    const result = migrateLegacy({ questionsSource: legacy })
    const first = result.questions.find((question) => question.id === '1')!
    expect(first.correctOptionId).toBe('option-1')
    expect(first.options?.find((option) => option.id === first.correctOptionId)?.text).toBe('Konrad Adenauer')
    expect(result.notes.some((note) => note.code === 'implicit-correct-answer')).toBe(true)
  })

  it('distinguishes image recognition from image-based multiple choice', () => {
    const result = migrateLegacy({ questionsSource: legacy })
    expect(result.questions.find((question) => question.id === '48')!.questionType).toBe('image-reveal')
    expect(result.questions.find((question) => question.id === '1')!.questionType).toBe('text-choice')
  })

  it('recognises identical question texts as a repetition group', () => {
    const result = migrateLegacy({ questionsSource: legacy })
    const q48 = result.questions.find((question) => question.id === '48')!
    const q49 = result.questions.find((question) => question.id === '49')!
    expect(q48.repetitionGroupId).toBeDefined()
    expect(q48.repetitionGroupId).toBe(q49.repetitionGroupId)
    expect(result.notes.some((note) => note.code === 'repetition-group-detected')).toBe(true)
  })

  it('does not carry playCount into the content', () => {
    const result = migrateLegacy({ questionsSource: legacy })
    for (const question of result.questions) {
      expect(question).not.toHaveProperty('playCount')
    }
    expect(result.notes.some((note) => note.code === 'playcount-dropped')).toBe(true)
  })

  it('reports a wrong option count for review instead of inventing one', () => {
    const result = migrateLegacy({ questionsSource: legacy })
    const note = result.notes.find((entry) => entry.questionId === '151' && entry.code === 'option-count')
    expect(note?.severity).toBe('needs-review')
  })

  it('reports deviating question slot counts of the legacy configuration', () => {
    const result = migrateLegacy({
      questionsSource: legacy,
      configSource: 'const presets = { medium: { rounds: [1,2,3,4,5,6,7,8] }, easy: { rounds: [1,2,3,4,5,6,7] } };',
    })
    const note = result.notes.find((entry) => entry.code === 'preset-slot-count' && entry.message.includes('medium'))
    expect(note?.severity).toBe('needs-review')
    expect(note?.message).toContain('8 Fragenplaetze')
  })

  it('normalises ids with umlauts', () => {
    expect(normalizeId('Saarbrücken')).toBe('saarbruecken')
    expect(normalizeId('Groß/Klein')).toBe('gross-klein')
  })
})

/**
 * Field names of the catalogue that was actually delivered.
 *
 * The legacy data names difficulty, image file and image credit differently
 * from the names assumed earlier. These tests pin the mapping down - it is
 * the difference between "199 questions adopted" and "all questions medium".
 */
describe('Field names of the delivered catalogue', () => {
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

  it('also reads a question list declared with "export"', () => {
    expect(extractDeclarations(delivered).has('questions')).toBe(true)
  })

  it('takes the difficulty from the "level" field', () => {
    const result = migrateLegacy({ questionsSource: delivered })
    expect(result.questions.map((question) => question.difficulty)).toEqual(['easy', 'hard'])
  })

  it('recognises the image file in "img_filename" and the credit in "img_credit"', () => {
    const result = migrateLegacy({ questionsSource: delivered })
    expect(result.skipped).toHaveLength(0)
    // The picture goes ON the question now, file and credit together.
    const question = result.questions.find((entry) => entry.id === '0')
    expect(question?.image?.filename).toBe('questions/europe.jpg')
    expect(question?.image?.credit).toBe('Pixabay/Greg Montani')
    expect(result.notes.some((note) => note.code === 'missing-image-credit' && note.questionId === '13')).toBe(true)
  })

  it('does not turn the single legacy option of image recognition into a visible answer bar', () => {
    const result = migrateLegacy({ questionsSource: delivered })
    const reveal = result.questions.find((question) => question.id === '0')
    expect(reveal?.questionType).toBe('image-reveal')
    expect(reveal?.evaluationMode).toBe('manual-correct-incorrect')
    expect(reveal?.options).toBeUndefined()
    expect(reveal?.correctOptionId).toBeUndefined()
    expect(reveal?.acceptedAnswerText).toEqual(['Deutschland'])
  })
})

describe('the background of a question', () => {
  it('puts `info` where it is read and reports a remark instead of shipping it', () => {
    const source = `const questions = [
      {
        id: 1,
        mode: "adults",
        level: "easy",
        type: "multiple_choice",
        category: "Institution",
        question: "Wer waehlt den Bundeskanzler?",
        option_1: "Der Bundestag",
        option_2: "Der Bundesrat",
        info: "Die Kanzlerwahl steht in Artikel 63 des Grundgesetzes.",
        Anmerkung: "Frage vor der Veranstaltung noch mit der Pressestelle klaeren.",
        source_reference: "Grundgesetz"
      }
    ]`

    const { questions, notes } = migrateLegacy({ questionsSource: source })

    /*
     * `info` is the paragraph an audience reads after the solution, so it is
     * the background. `summary` stays empty: that field is the moderator's
     * lead-in, and a lead-in of six lines is none.
     */
    expect(questions[0]!.explanation?.details).toBe('Die Kanzlerwahl steht in Artikel 63 des Grundgesetzes.')
    expect(questions[0]!.explanation?.summary).toBeUndefined()
    expect(questions[0]!.explanation?.source).toBe('Grundgesetz')

    // The remark is one editor writing to another - it belongs in the report.
    const remark = notes.find((note) => note.code === 'editorial-remark')
    expect(remark?.message).toContain('Pressestelle')
    expect(JSON.stringify(questions[0])).not.toContain('Pressestelle')
  })
})
