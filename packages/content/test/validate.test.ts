/**
 * Content validation (specification 24.4 and 17.5) and hotfix overlay (25).
 */
import { describe, expect, it } from 'vitest'
import type { MediaAsset, Question } from '@hfroemmel/quiz-core'
import { validateContent } from '../src/validate'

const asset: MediaAsset = { id: 'img-1', kind: 'image', filename: 'images/a.svg', mimeType: 'image/svg+xml', credit: 'Eigene' }

/**
 * Question slot of the test configuration - before the schema check, hence
 * deliberately open: every test combines the filters it needs.
 */
type TestSlot = { id: string; label?: string; filters: Record<string, unknown> }

/** Quiz mode of the test configuration - also before the schema check. */
type TestQuiz = {
  id: string
  label: string
  audienceId: string
  themeId: string
  poolIds?: string[]
  presetIds: string[]
  defaultPresetId?: string
  playerCounts?: (1 | 2)[]
  artworkAssetId?: string
  emphasis?: 'wide' | 'regular'
  order?: number
}

const baseConfig = {
  questionsPerGame: 2,
  difficulties: [{ id: 'easy', label: 'Leicht' }],
  categories: [{ id: 'allgemein', label: 'Allgemein' }],
  pools: [{ id: 'bundestag', label: 'Bundestag' }],
  themes: [{ id: 'default', label: 'Standard' }],
  presets: [
    {
      id: 'standard',
      label: 'Standard',
      slots: [
        { id: 'text', filters: { questionTypes: ['text-choice'] } },
        { id: 'bild', filters: { questionTypes: ['image-reveal'] } },
      ] as TestSlot[],
    },
  ],
  audiences: [{ id: 'adults', label: 'Erwachsene', themeId: 'default', allowedPresetIds: ['standard'] }],
  /* Without quiz modes the pool still works - the desk then has nothing to offer. */
  quizzes: [] as TestQuiz[],
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
    questionType: 'text-choice',
    evaluationMode: 'option-comparison',
    options: [
      { id: 'o1', text: 'A' },
      { id: 'o2', text: 'B' },
      { id: 'o3', text: 'C' },
      { id: 'o4', text: 'D' },
    ],
    correctOptionId: 'o1',
    explanation: { summary: 'Erklaerung' },
    enabled: true,
    ...overrides,
  }
}

const revealQuestion = question({
  id: 'r1',
  questionType: 'image-reveal',
  evaluationMode: 'manual-correct-incorrect',
  options: undefined,
  correctOptionId: undefined,
  acceptedAnswerText: ['Antwort'],
  image: { filename: 'images/a.svg', credit: 'Eigene' },
})

function validate(questions: Question[], overrides: Partial<typeof baseConfig> = {}, fileExists = true) {
  return validateContent({
    config: { ...baseConfig, ...overrides },
    questions,
    assets: [asset],
    mediaFileExists: () => fileExists,
  })
}

describe('Schema errors abort the build', () => {
  it('detects duplicate question ids', () => {
    const result = validate([question({ id: 'q1' }), question({ id: 'q1' }), revealQuestion])
    expect(result.errors.some((issue) => issue.code === 'duplicate-question-id')).toBe(true)
    expect(result.ok).toBe(false)
  })

  it('detects multiple choice without a correct option', () => {
    const result = validate([question({ id: 'q1', correctOptionId: undefined }), revealQuestion])
    expect(result.errors.some((issue) => issue.code === 'missing-correct-option')).toBe(true)
  })

  it('detects a correctOptionId that points to no option', () => {
    const result = validate([question({ id: 'q1', correctOptionId: 'gibt-es-nicht' }), revealQuestion])
    expect(result.errors.some((issue) => issue.code === 'correct-option-unknown')).toBe(true)
  })

  it('allows three and two answer options', () => {
    const three = validate([
      question({
        id: 'q1',
        options: [
          { id: 'o1', text: 'A' },
          { id: 'o2', text: 'B' },
          { id: 'o3', text: 'C' },
        ],
      }),
      revealQuestion,
    ])
    expect(three.errors.some((issue) => issue.code === 'option-count')).toBe(false)

    const two = validate([
      question({ id: 'q1', options: [{ id: 'o1', text: 'A' }, { id: 'o2', text: 'B' }] }),
      revealQuestion,
    ])
    expect(two.errors.some((issue) => issue.code === 'option-count')).toBe(false)
  })

  it('reports a choice question with only one option', () => {
    // With a single option there is nothing to choose - that is not a choice.
    const result = validate([
      question({ id: 'q1', options: [{ id: 'o1', text: 'A' }], correctOptionId: 'o1' }),
      revealQuestion,
    ])
    expect(result.errors.some((issue) => issue.code === 'option-count')).toBe(true)
  })

  it('reports more answer options than the design carries', () => {
    const result = validate([
      question({
        id: 'q1',
        options: [
          { id: 'o1', text: 'A' },
          { id: 'o2', text: 'B' },
          { id: 'o3', text: 'C' },
          { id: 'o4', text: 'D' },
          { id: 'o5', text: 'E' },
        ],
      }),
      revealQuestion,
    ])
    expect(result.errors.some((issue) => issue.code === 'option-count')).toBe(true)
  })

  it('detects a missing mandatory medium', () => {
    const result = validate([question({ id: 'q1' }), { ...revealQuestion, image: undefined }])
    expect(result.errors.some((issue) => issue.code === 'missing-media')).toBe(true)
  })

  it('detects a missing media file', () => {
    const result = validate([question({ id: 'q1' }), revealQuestion], {}, false)
    expect(result.errors.some((issue) => issue.code === 'asset-file-missing')).toBe(true)
  })

  it('reports a missing media file of a disabled question only as a warning', () => {
    // A disabled question is in no pool and cannot endanger the show;
    // it may stay in the pool as a prepared template without a file.
    const result = validate([question({ id: 'q1' }), revealQuestion], {}, false)
    expect(result.errors.some((issue) => issue.code === 'asset-file-missing')).toBe(true)

    const withDisabled = validate([question({ id: 'q1' }), { ...revealQuestion, enabled: false }], {}, false)
    expect(withDisabled.errors.some((issue) => issue.code === 'asset-file-missing')).toBe(false)
    expect(withDisabled.warnings.some((issue) => issue.code === 'asset-file-missing-disabled')).toBe(true)
  })

  it('detects unknown references', () => {
    const result = validate([question({ id: 'q1', categories: ['gibt-es-nicht'], difficulty: 'unbekannt' }), revealQuestion])
    expect(result.errors.some((issue) => issue.code === 'category-reference')).toBe(true)
    expect(result.errors.some((issue) => issue.code === 'difficulty-reference')).toBe(true)
  })

  it('detects an unsatisfiable question slot as a hard error', () => {
    const result = validate([question({ id: 'q1' })])
    expect(result.errors.some((issue) => issue.code === 'slot-unsatisfiable')).toBe(true)
  })

  it('detects a deviating question slot count in the preset', () => {
    const result = validate([question({ id: 'q1' }), revealQuestion], { questionsPerGame: 7 })
    expect(result.errors.some((issue) => issue.code === 'preset-slot-count')).toBe(true)
  })

  it('detects an unparsable version string', () => {
    const result = validateContent({
      config: baseConfig,
      questions: [question({ id: 'q1' }), revealQuestion],
      assets: [asset],
      mediaFileExists: () => true,
      contentVersion: 'kaputt',
    })
    expect(result.errors.some((issue) => issue.code === 'version-unparsable')).toBe(true)
  })
})

describe('Content warnings', () => {
  it('warns on a missing explanation and a small pool', () => {
    const result = validate([question({ id: 'q1', explanation: undefined }), revealQuestion])
    expect(result.warnings.some((issue) => issue.code === 'missing-explanation')).toBe(true)
    expect(result.warnings.some((issue) => issue.code === 'small-pool')).toBe(true)
    expect(result.ok).toBe(true)
  })

  it('warns on nearly identical questions without a shared repetition group', () => {
    const result = validate([
      question({ id: 'q1', prompt: 'Wie heisst die Hauptstadt?' }),
      question({ id: 'q2', prompt: 'Wie heisst die Hauptstadt' }),
      revealQuestion,
    ])
    expect(result.warnings.some((issue) => issue.code === 'similar-without-group')).toBe(true)
  })

  it('does not warn when the variants share a repetition group', () => {
    const result = validate([
      question({ id: 'q1', prompt: 'Gleiche Frage', repetitionGroupId: 'g1' }),
      question({ id: 'q2', prompt: 'Gleiche Frage', repetitionGroupId: 'g1' }),
      revealQuestion,
    ])
    expect(result.warnings.some((issue) => issue.code === 'similar-without-group')).toBe(false)
  })

  it('reports whether a preset is playable on the touch device', () => {
    const touchSlot = (id: string): TestSlot => ({ id, filters: { evaluationModes: ['option-comparison'] } })
    const touchPreset = { id: 'touch', label: 'Touch', slots: [touchSlot('a'), touchSlot('b')] }
    const result = validate([question({ id: 'q1' }), question({ id: 'q2' }), revealQuestion], {
      presets: [...baseConfig.presets, touchPreset],
      audiences: [{ ...baseConfig.audiences[0]!, allowedPresetIds: ['standard', 'touch'] }],
    })

    const standard = result.coverage.find((entry) => entry.presetId === 'standard')!
    const touch = result.coverage.find((entry) => entry.presetId === 'touch')!
    // The stage preset contains an image recognition slot with a spoken answer.
    expect(standard.selfServiceCapable).toBe(false)
    expect(touch.selfServiceCapable).toBe(true)
  })

  it('computes pool coverage and possible games without repetition', () => {
    const result = validate([question({ id: 'q1' }), question({ id: 'q2' }), revealQuestion])
    const coverage = result.coverage[0]!
    expect(coverage.slots[0]!.candidateCount).toBe(2)
    expect(coverage.slots[1]!.candidateCount).toBe(1)
    expect(coverage.gamesWithoutRepetition).toBe(1)
  })
})

describe('Missing media files', () => {
  const questions = [question({ id: 'q1' }), revealQuestion]

  it('are an error by default', () => {
    const result = validate(questions, {}, false)
    expect(result.ok).toBe(false)
    expect(result.errors.some((issue) => issue.code === 'asset-file-missing')).toBe(true)
  })

  it('become a warning with "warning", without disabling the question', () => {
    const result = validateContent({
      config: baseConfig,
      questions,
      assets: [asset],
      mediaFileExists: () => false,
      missingMediaSeverity: 'warning',
    })
    expect(result.ok).toBe(true)
    expect(result.warnings.find((issue) => issue.code === 'asset-file-missing')?.message).toContain('Ersatzbild')
  })

  it('reports an incomplete, disabled question as a warning instead of an error', () => {
    const draft = question({ id: 'entwurf', enabled: false, options: [{ id: 'o1', text: 'A' }] })
    const result = validate([question({ id: 'q1' }), revealQuestion, draft])
    expect(result.ok).toBe(true)
    expect(result.warnings.find((issue) => issue.code === 'option-count')?.message).toContain('deaktiviert')
  })
})

describe('Themes without presentation', () => {
  it('accepts a theme without colours and fonts - presentation belongs to the host', () => {
    const result = validate([question({ id: 'q1' }), revealQuestion], {
      themes: [{ id: 'default', label: 'Standard' }],
    })
    expect(result.ok).toBe(true)
  })
})

describe('Quiz modes', () => {
  const quiz = (overrides: Partial<TestQuiz> = {}): TestQuiz => ({
    id: 'bundestag',
    label: 'Bundestagsquiz',
    audienceId: 'adults',
    themeId: 'default',
    presetIds: ['standard'],
    ...overrides,
  })

  it('accepts a fully wired quiz mode', () => {
    const result = validate([question({ id: 'q1' }), revealQuestion], { quizzes: [quiz()] })
    expect(result.ok).toBe(true)
  })

  it('detects an unknown audience', () => {
    const result = validate([question({ id: 'q1' }), revealQuestion], {
      quizzes: [quiz({ audienceId: 'marsmenschen' })],
    })
    expect(result.errors.some((issue) => issue.code === 'audience-reference')).toBe(true)
  })

  it('accepts the fields of the start menu and keeps their references', () => {
    const result = validate([question({ id: 'q1' }), revealQuestion], {
      quizzes: [quiz({ playerCounts: [1], artworkAssetId: 'img-1', emphasis: 'wide', order: 10 })],
    })
    expect(result.ok).toBe(true)
    // Only the pool warnings of this small fixture, nothing about the new fields.
    /*
     * Only the pool warnings of this small fixture - the new fields add none
     * of their own as long as they are consistent.
     */
    const aboutTheMenu = result.warnings.filter((issue) => issue.code.startsWith('quiz-'))
    expect(aboutTheMenu).toEqual([])
  })

  it('detects a card artwork that does not exist', () => {
    const result = validate([question({ id: 'q1' }), revealQuestion], {
      quizzes: [quiz({ artworkAssetId: 'img-does-not-exist' })],
    })
    expect(result.errors.some((issue) => issue.code === 'asset-reference')).toBe(true)
  })

  it('warns about a player count named twice - it would be one card too many', () => {
    const result = validate([question({ id: 'q1' }), revealQuestion], {
      quizzes: [quiz({ playerCounts: [1, 1] })],
    })
    expect(result.ok).toBe(true)
    expect(result.warnings.some((issue) => issue.code === 'quiz-player-counts')).toBe(true)
  })

  it('warns about two quizzes on the same menu position', () => {
    const result = validate([question({ id: 'q1' }), revealQuestion], {
      quizzes: [quiz({ order: 10 }), quiz({ id: 'kids-quiz', order: 10 })],
    })
    expect(result.warnings.some((issue) => issue.code === 'quiz-order')).toBe(true)
  })

  it('detects an unknown theme', () => {
    const result = validate([question({ id: 'q1' }), revealQuestion], { quizzes: [quiz({ themeId: 'neon' })] })
    expect(result.errors.some((issue) => issue.code === 'theme-reference')).toBe(true)
  })

  it('detects an unknown question pool', () => {
    const result = validate([question({ id: 'q1' }), revealQuestion], {
      quizzes: [quiz({ poolIds: ['atlantis'] })],
    })
    expect(result.errors.some((issue) => issue.code === 'pool-reference')).toBe(true)
  })

  it('detects a preset that is not open to the audience', () => {
    const result = validate([question({ id: 'q1' }), revealQuestion], {
      quizzes: [quiz({ presetIds: ['gibt-es-nicht'] })],
    })
    expect(result.errors.some((issue) => issue.code === 'preset-reference')).toBe(true)
  })

  it('detects a default that is not among the levels', () => {
    const result = validate([question({ id: 'q1' }), revealQuestion], {
      quizzes: [quiz({ defaultPresetId: 'schwer' })],
    })
    expect(result.errors.some((issue) => issue.code === 'preset-reference')).toBe(true)
  })

  it('detects a quiz mode configured twice', () => {
    const result = validate([question({ id: 'q1' }), revealQuestion], { quizzes: [quiz(), quiz()] })
    expect(result.errors.some((issue) => issue.code === 'quiz-duplicate')).toBe(true)
  })
})

