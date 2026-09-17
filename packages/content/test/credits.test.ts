/**
 * Whose picture that is - the rule, and the two places that ask it.
 */
import { describe, expect, it } from 'vitest'
import type { MediaAsset, Question } from '@hfroemmel/quiz-core'
import { uncreditedImages } from '../src/credits'
import { validateContent } from '../src/validate'

function image(id: string, credit?: string): MediaAsset {
  return {
    id,
    kind: 'image',
    filename: `questions/${id}.svg`,
    mimeType: 'image/svg+xml',
    ...(credit === undefined ? {} : { credit }),
  }
}

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

const withImage = (id: string, assetId: string): Question => question({ id, media: { imageAssetId: assetId } })

describe('uncreditedImages', () => {
  it('names the question and the picture that has no licence line', () => {
    const found = uncreditedImages([withImage('q1', 'img-1')], [image('img-1')])

    expect(found).toEqual([{ questionId: 'q1', assetId: 'img-1', declared: true }])
  })

  it('says nothing about a picture that has one', () => {
    expect(uncreditedImages([withImage('q1', 'img-1')], [image('img-1', 'Foto: jemand')])).toEqual([])
  })

  it('treats a credit of spaces as none - typing one is not finishing it', () => {
    expect(uncreditedImages([withImage('q1', 'img-1')], [image('img-1', '   ')])).toHaveLength(1)
  })

  it('marks an undeclared medium as such, because that is a different fix', () => {
    const found = uncreditedImages([withImage('q1', 'img-missing')], [])

    expect(found).toEqual([{ questionId: 'q1', assetId: 'img-missing', declared: false }])
  })

  it('ignores questions without a picture, and the videos of those that have one', () => {
    const plain = question({ id: 'q1', questionType: 'text-choice' })
    const video = question({
      id: 'q2',
      questionType: 'video-then-question',
      media: { videoAssetId: 'vid-1' },
    })

    expect(uncreditedImages([plain, video], [])).toEqual([])
  })

  it('keeps the order of the questions, so the list reads like the table', () => {
    const found = uncreditedImages(
      [withImage('q1', 'img-1'), withImage('q2', 'img-2'), withImage('q3', 'img-3')],
      [image('img-1'), image('img-2', 'Foto: jemand'), image('img-3')],
    )

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

  function issuesFor(assets: MediaAsset[]) {
    return validateContent({
      config,
      questions: [withImage('q1', 'img-1')],
      assets,
      assetFileExists: () => true,
      missingMediaSeverity: 'warning',
    }).issues
  }

  it('warns once per question, under the code the report groups by', () => {
    const credits = issuesFor([image('img-1')]).filter((issue) => issue.code === 'missing-credit')

    expect(credits).toHaveLength(1)
    expect(credits[0]?.severity).toBe('warning')
    expect(credits[0]?.subject).toBe('q1')
  })

  it('says nothing about a credit when the medium itself is missing', () => {
    /*
     * That is `asset-reference`, an error. Two findings for one cause would
     * send the reader looking for the licence line of a picture nobody has.
     */
    const codes = issuesFor([]).map((issue) => issue.code)

    expect(codes).toContain('asset-reference')
    expect(codes).not.toContain('missing-credit')
  })
})
