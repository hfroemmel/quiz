/**
 * Whose picture that is - the rule, and the two places that ask it.
 */
import { describe, expect, it } from 'vitest'
import type { MediaAsset, Question } from '@hfroemmel/quiz-core'
import { uncreditedImages } from '../src/credits'
import { validateContent } from '../src/validate'

function question(overrides: Partial<Question> & { id: string }): Question {
  return {
    poolIds: ['bundestag'],
    audiences: ['adults'],
    difficulty: 'easy',
    categories: ['allgemein'],
    tags: [],
    locale: 'de-DE',
    prompt: `Frage ${overrides.id}`,
    questionType: 'image-choice',
    evaluationMode: 'option-comparison',
    options: [
      { id: 'o1', text: 'A' },
      { id: 'o2', text: 'B' },
    ],
    correctOptionId: 'o1',
    explanation: { summary: 'Erklaerung' },
    enabled: true,
    ...overrides,
  }
}

const withImage = (id: string, filename: string, credit?: string): Question =>
  question({ id, image: { filename, ...(credit === undefined ? {} : { credit }) } })

describe('uncreditedImages', () => {
  it('names the question and the file that has no licence line', () => {
    const found = uncreditedImages([withImage('q1', 'questions/a.jpg')])

    expect(found).toEqual([{ questionId: 'q1', filename: 'questions/a.jpg' }])
  })

  it('says nothing about a picture that has one', () => {
    expect(uncreditedImages([withImage('q1', 'questions/a.jpg', 'Foto: jemand')])).toEqual([])
  })

  it('treats a credit of spaces as none - typing one is not finishing it', () => {
    expect(uncreditedImages([withImage('q1', 'questions/a.jpg', '   ')])).toHaveLength(1)
  })

  it('ignores questions without a picture, and the videos of those that have one', () => {
    const plain = question({ id: 'q1', questionType: 'text-choice' })
    const video = question({ id: 'q2', questionType: 'text-choice', video: { filename: 'video/v.mp4' } })

    expect(uncreditedImages([plain, video])).toEqual([])
  })

  it('keeps the order of the questions, so the list reads like the table', () => {
    const found = uncreditedImages([
      withImage('q1', 'questions/a.jpg'),
      withImage('q2', 'questions/b.jpg', 'Foto: jemand'),
      withImage('q3', 'questions/c.jpg'),
    ])

    expect(found.map((entry) => entry.questionId)).toEqual(['q1', 'q3'])
  })
})

describe('the same rule inside the validation', () => {
  const config = {
    questionsPerGame: 1,
    difficulties: [{ id: 'easy', label: 'Leicht' }],
    categories: [{ id: 'allgemein', label: 'Allgemein' }],
    pools: [{ id: 'bundestag', label: 'Bundestag' }],
    themes: [{ id: 'default', label: 'Standard' }],
    presets: [{ id: 'standard', label: 'Standard', slots: [{ id: 'bild', filters: {} }] }],
    audiences: [{ id: 'adults', label: 'Erwachsene', themeId: 'default', allowedPresetIds: ['standard'] }],
    quizzes: [],
  }

  function issuesFor(credit: string | undefined, assets: MediaAsset[] = []) {
    return validateContent({
      config,
      questions: [withImage('q1', 'questions/a.jpg', credit)],
      assets,
      mediaFileExists: () => true,
      missingMediaSeverity: 'warning',
    }).issues
  }

  it('warns once per question, under the code the report groups by', () => {
    const credits = issuesFor(undefined).filter((issue) => issue.code === 'missing-credit')

    expect(credits).toHaveLength(1)
    expect(credits[0]?.severity).toBe('warning')
    expect(credits[0]?.subject).toBe('q1')
  })

  it('stays silent where the licence line is there', () => {
    expect(issuesFor('Foto: jemand').map((issue) => issue.code)).not.toContain('missing-credit')
  })

  it('no longer reports an unknown medium, because there is no reference to resolve', () => {
    /*
     * `asset-reference` and `asset-kind` were findings about an ASSET ID. A
     * question names a file now, and the only question left about it is
     * whether it exists - which `asset-file-missing` answers.
     */
    const codes = issuesFor('Foto: jemand').map((issue) => issue.code)

    expect(codes).not.toContain('asset-reference')
    expect(codes).not.toContain('asset-kind')
  })
})
