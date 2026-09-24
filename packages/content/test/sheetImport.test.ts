/**
 * The import from the editorial sheet.
 *
 * Tested on a string and without network - the sheet here is one line of
 * CSV. That is exactly why translating is separated from fetching.
 */
import { describe, expect, it } from 'vitest'
import { parseCsv } from '../src/csv'
import { csvUrl, importSheet, defaultMapping } from '../src/sheetImport'

const head = 'ID,Frage,Schwierigkeit,Kategorie,A,B,C,D,Richtig,Erklärung\n'

describe('parseCsv', () => {
  it('keeps comma, line break and quotation marks together in one cell', () => {
    const csv = 'a,b\n"eins, zwei","Zeile 1\nZeile 2"\n"Er sagte ""ja""",x\n'
    expect(parseCsv(csv)).toEqual([
      ['a', 'b'],
      ['eins, zwei', 'Zeile 1\nZeile 2'],
      ['Er sagte "ja"', 'x'],
    ])
  })

  it('drops empty rows at the end', () => {
    expect(parseCsv('a,b\n1,2\n\n\n')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ])
  })
})

describe('importSheet', () => {
  it('turns a row into a valid choice question', () => {
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

  it('reads the correct answer as a letter, as a number and as text', () => {
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

  it('reports a row with its row number instead of dropping the whole pool', () => {
    /*
     * Not getting two hundred questions at all because of one half-finished
     * row would be the more expensive answer for the editors.
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

  it('turns labels into valid identifiers', () => {
    const csv = `${head}Frage 7,Wer?,schwer,"Ämter & Recht, Wahl",,,,,,\n`
    const question = importSheet(csv).questions[0]!
    expect(question.id).toBe('frage-7')
    expect(question.difficulty).toBe('hard')
    expect(question.categories).toEqual(['aemter-recht', 'wahl'])
    // Without options it is not a choice question - it is judged by hand.
    expect(question.evaluationMode).toBe('manual-correct-incorrect')
  })

  it('accepts a custom column mapping', () => {
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

  it('reads a second language out of the same row', () => {
    /*
     * The pairing of the two languages lives IN THE ROW. Two sheets - one per
     * language - would leave nothing saying which German question the English
     * one belongs to; that is the reason for column groups rather than a second
     * import.
     */
    const csv = [
      'ID,Frage,A,B,Richtig,Erklärung,Frage EN,A EN,B EN,Erklärung EN',
      'q1,Wer regiert?,Der Bundestag,Der Bundesrat,A,Steht im Grundgesetz.,Who governs?,The Bundestag,The Bundesrat,In the constitution.',
      // Nothing in the English group: the question exists in German only.
      'q2,Wer waehlt?,Das Volk,Der Bundesrat,A,,,,,',
    ].join('\n')

    const { questions } = importSheet(csv, {
      columns: { id: 'ID', prompt: 'Frage', options: ['A', 'B'], correct: 'Richtig', explanation: 'Erklärung' },
      translations: {
        'en-GB': { prompt: 'Frage EN', options: ['A EN', 'B EN'], explanation: 'Erklärung EN' },
      },
    })

    expect(questions).toHaveLength(2)
    expect(questions[0]!.translations).toEqual({
      'en-GB': {
        prompt: 'Who governs?',
        options: [
          { id: 'a', text: 'The Bundestag' },
          { id: 'b', text: 'The Bundesrat' },
        ],
        explanation: { summary: 'In the constitution.' },
      },
    })
    // What decides the game stays with the question, not with the translation.
    expect(questions[0]!.correctOptionId).toBe('a')
    expect(questions[0]!.difficulty).toBe('medium')
    // An empty group is not an empty translation.
    expect(questions[1]!.translations).toBeUndefined()
  })

  it('leaves an option in the base language where the translation forgets it', () => {
    const csv = [
      'ID,Frage,A,B,Richtig,Frage EN,A EN,B EN',
      'q1,Wer regiert?,Der Bundestag,Der Bundesrat,A,Who governs?,The Bundestag,',
    ].join('\n')

    const { questions } = importSheet(csv, {
      columns: { id: 'ID', prompt: 'Frage', options: ['A', 'B'], correct: 'Richtig' },
      translations: { 'en-GB': { prompt: 'Frage EN', options: ['A EN', 'B EN'] } },
    })

    /*
     * Only the option that IS translated travels. The other keeps its German
     * wording when the question is read in English - a dropped option would
     * mean the one compared against might be missing.
     */
    expect(questions[0]!.translations?.['en-GB']?.options).toEqual([{ id: 'a', text: 'The Bundestag' }])
  })

  it('takes three answer options as they are', () => {
    // An editorial sheet has such rows; two is the minimum, four is not a rule.
    const csv = ['ID,Frage,A,B,C,D,Richtig', 'q1,Wie viele?,Eins,Zwei,Drei,,B'].join('\n')
    const { questions, skippedRows } = importSheet(csv, {
      columns: { id: 'ID', prompt: 'Frage', options: ['A', 'B', 'C', 'D'], correct: 'Richtig' },
    })
    expect(skippedRows).toEqual([])
    expect(questions[0]!.options).toHaveLength(3)
    expect(questions[0]!.correctOptionId).toBe('b')
  })

  /*
   * TWO RUBRIC COLUMNS, ONE FIELD. An editorial table that grades its rubric
   * writes the broad subject in one column and the finer one beside it; the
   * question carries them as its categories, in the order the mapping names
   * the columns, because that order is what the stage reads out.
   */
  it('reads the rubric out of as many columns as the mapping names', () => {
    const csv =
      'id,frage,kategorie,kategorie_2,A,B\n' +
      '1,Wie heisst der Beiname Bremens?,Bremen,Geschichte,Hansestadt,Freie Stadt\n' +
      '2,Woran erinnert der 3. Oktober?,Deutsche Einheit,,Wiedervereinigung,Mauerbau\n'
    const { questions } = importSheet(csv, {
      columns: {
        id: 'id',
        prompt: 'frage',
        categories: ['kategorie', 'kategorie_2'],
        options: ['A', 'B'],
      },
      correctOption: 1,
    })

    expect(questions[0]!.categories).toEqual(['bremen', 'geschichte'])
    // An empty cell adds nothing - the question keeps the one rubric it has.
    expect(questions[1]!.categories).toEqual(['deutsche-einheit'])
  })

  /*
   * ONE OPTION IS THE ANSWER, NOT A CHOICE. A picture question is answered out
   * loud and the table keeps that answer in the first option column; read as
   * "too few options" it used to be dropped, and the solution of every picture
   * question stood empty on the stage.
   */
  it('takes a lone option as the answer that is expected', () => {
    const csv = 'id,frage,typ,A,B,C,D\n1,Welches Gebaeude ist zu sehen?,image,Reichstagsgebaeude,,,\n'
    const { questions } = importSheet(csv, {
      columns: { id: 'id', prompt: 'frage', questionType: 'typ', options: ['A', 'B', 'C', 'D'] },
      correctOption: 1,
      /* The vocabulary of the table - the CLI merges the built-in one in. */
      values: { questionType: { image: 'image-reveal' } },
    })

    expect(questions[0]).toMatchObject({
      questionType: 'image-reveal',
      evaluationMode: 'manual-correct-incorrect',
      acceptedAnswerText: ['Reichstagsgebaeude'],
    })
    // And it is not offered as something to choose from.
    expect(questions[0]!.options).toBeUndefined()
  })

  /*
   * THE SAME QUESTION TWICE IS ONE QUESTION. A corpus carries the same question
   * for the adults and in the children's wording; without a common repetition
   * group the day's history counts them as two and an evening asks the same
   * thing twice.
   */
  it('ties identical questions into one repetition group', () => {
    const csv =
      'id,frage,mode,A,B\n' +
      '1,Wann fiel die Berliner Mauer?,adults,9. November 1989,3. Oktober 1990\n' +
      '2,Wann fiel die Berliner Mauer?,kids,9. November 1989,3. Oktober 1990\n' +
      '3,Wie heisst das Parlament?,adults,Bundestag,Bundesrat\n'
    const { questions } = importSheet(csv, {
      columns: { id: 'id', prompt: 'frage', audiences: 'mode', options: ['A', 'B'] },
      correctOption: 1,
    })

    expect(questions[0]!.repetitionGroupId).toBe(questions[1]!.repetitionGroupId)
    expect(questions[2]!.repetitionGroupId).not.toBe(questions[0]!.repetitionGroupId)
  })

  it('names the columns it read so that a wrong mapping can be found', () => {
    expect(importSheet('Nr,Question\n', { columns: {} }).columns).toEqual(['Nr', 'Question'])
  })
})

describe('csvUrl', () => {
  it('turns the browser bar address into the CSV address - with the sheet tab', () => {
    expect(csvUrl('https://docs.google.com/spreadsheets/d/ABC123/edit?gid=951895018#gid=951895018')).toBe(
      'https://docs.google.com/spreadsheets/d/ABC123/export?format=csv&gid=951895018',
    )
  })

  it('also works with the bare id', () => {
    expect(csvUrl('ABC123')).toBe('https://docs.google.com/spreadsheets/d/ABC123/export?format=csv')
  })
})

describe('defaultMapping', () => {
  it('names four answer columns - the stage shows four rows', () => {
    expect(defaultMapping.columns.options).toEqual(['A', 'B', 'C', 'D'])
  })
})
