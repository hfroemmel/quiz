/**
 * Inhaltsvalidierung (Spezifikation 24.4 und 17.5) und Hotfix-Overlay (25).
 */
import { describe, expect, it } from 'vitest'
import type { MediaAsset, Question } from '@hfroemmel/quiz-core'
import { validateContent } from '../src/validate'
import { applyContentProfile } from '../src/package'

const asset: MediaAsset = { id: 'img-1', kind: 'image', filename: 'images/a.svg', mimeType: 'image/svg+xml', credit: 'Eigene' }

/**
 * Fragenplatz der Testkonfiguration - vor der Schemapruefung, deshalb bewusst
 * offen: Jeder Test kombiniert die Filter, die er braucht.
 */
type TestSlot = { id: string; label?: string; filters: Record<string, unknown> }

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
  media: { imageAssetId: 'img-1' },
})

function validate(questions: Question[], overrides: Partial<typeof baseConfig> = {}, fileExists = true) {
  return validateContent({
    config: { ...baseConfig, ...overrides },
    questions,
    assets: [asset],
    assetFileExists: () => fileExists,
  })
}

describe('Schemafehler brechen den Build ab', () => {
  it('erkennt doppelte Frage-IDs', () => {
    const result = validate([question({ id: 'q1' }), question({ id: 'q1' }), revealQuestion])
    expect(result.errors.some((issue) => issue.code === 'duplicate-question-id')).toBe(true)
    expect(result.ok).toBe(false)
  })

  it('erkennt Multiple Choice ohne korrekte Option', () => {
    const result = validate([question({ id: 'q1', correctOptionId: undefined }), revealQuestion])
    expect(result.errors.some((issue) => issue.code === 'missing-correct-option')).toBe(true)
  })

  it('erkennt correctOptionId, die auf keine Option zeigt', () => {
    const result = validate([question({ id: 'q1', correctOptionId: 'gibt-es-nicht' }), revealQuestion])
    expect(result.errors.some((issue) => issue.code === 'correct-option-unknown')).toBe(true)
  })

  it('laesst drei und zwei Antwortoptionen zu', () => {
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

  it('meldet eine Auswahlfrage mit nur einer Option', () => {
    // Mit einer einzigen Option gibt es nichts zu waehlen - das ist keine Auswahl.
    const result = validate([
      question({ id: 'q1', options: [{ id: 'o1', text: 'A' }], correctOptionId: 'o1' }),
      revealQuestion,
    ])
    expect(result.errors.some((issue) => issue.code === 'option-count')).toBe(true)
  })

  it('meldet mehr Antwortoptionen als der Entwurf traegt', () => {
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

  it('erkennt ein fehlendes Pflichtmedium', () => {
    const result = validate([question({ id: 'q1' }), { ...revealQuestion, media: undefined }])
    expect(result.errors.some((issue) => issue.code === 'missing-media')).toBe(true)
  })

  it('erkennt eine fehlende Mediendatei', () => {
    const result = validate([question({ id: 'q1' }), revealQuestion], {}, false)
    expect(result.errors.some((issue) => issue.code === 'asset-file-missing')).toBe(true)
  })

  it('meldet eine fehlende Mediendatei bei deaktivierter Frage nur als Warnung', () => {
    // Eine deaktivierte Frage ist in keinem Pool und kann die Show nicht gefaehrden;
    // sie darf als vorbereitete Vorlage ohne Datei im Bestand liegen.
    const result = validate([question({ id: 'q1' }), revealQuestion], {}, false)
    expect(result.errors.some((issue) => issue.code === 'asset-file-missing')).toBe(true)

    const withDisabled = validate([question({ id: 'q1' }), { ...revealQuestion, enabled: false }], {}, false)
    expect(withDisabled.errors.some((issue) => issue.code === 'asset-file-missing')).toBe(false)
    expect(withDisabled.warnings.some((issue) => issue.code === 'asset-file-missing-disabled')).toBe(true)
  })

  it('erkennt unbekannte Referenzen', () => {
    const result = validate([question({ id: 'q1', categories: ['gibt-es-nicht'], difficulty: 'unbekannt' }), revealQuestion])
    expect(result.errors.some((issue) => issue.code === 'category-reference')).toBe(true)
    expect(result.errors.some((issue) => issue.code === 'difficulty-reference')).toBe(true)
  })

  it('erkennt einen nicht erfuellbaren Fragenplatz als harten Fehler', () => {
    const result = validate([question({ id: 'q1' })])
    expect(result.errors.some((issue) => issue.code === 'slot-unsatisfiable')).toBe(true)
  })

  it('erkennt eine abweichende Fragenplatzzahl im Preset', () => {
    const result = validate([question({ id: 'q1' }), revealQuestion], { questionsPerGame: 7 })
    expect(result.errors.some((issue) => issue.code === 'preset-slot-count')).toBe(true)
  })

  it('erkennt eine nicht parsebare Versionsangabe', () => {
    const result = validateContent({
      config: baseConfig,
      questions: [question({ id: 'q1' }), revealQuestion],
      assets: [asset],
      assetFileExists: () => true,
      contentVersion: 'kaputt',
    })
    expect(result.errors.some((issue) => issue.code === 'version-unparsable')).toBe(true)
  })
})

describe('Inhaltswarnungen', () => {
  it('warnt bei fehlender Erklaerung und kleinem Pool', () => {
    const result = validate([question({ id: 'q1', explanation: undefined }), revealQuestion])
    expect(result.warnings.some((issue) => issue.code === 'missing-explanation')).toBe(true)
    expect(result.warnings.some((issue) => issue.code === 'small-pool')).toBe(true)
    expect(result.ok).toBe(true)
  })

  it('warnt bei fast identischen Fragen ohne gemeinsame Wiederholungsgruppe', () => {
    const result = validate([
      question({ id: 'q1', prompt: 'Wie heisst die Hauptstadt?' }),
      question({ id: 'q2', prompt: 'Wie heisst die Hauptstadt' }),
      revealQuestion,
    ])
    expect(result.warnings.some((issue) => issue.code === 'similar-without-group')).toBe(true)
  })

  it('warnt nicht, wenn die Varianten eine gemeinsame Wiederholungsgruppe haben', () => {
    const result = validate([
      question({ id: 'q1', prompt: 'Gleiche Frage', repetitionGroupId: 'g1' }),
      question({ id: 'q2', prompt: 'Gleiche Frage', repetitionGroupId: 'g1' }),
      revealQuestion,
    ])
    expect(result.warnings.some((issue) => issue.code === 'similar-without-group')).toBe(false)
  })

  it('meldet, ob ein Preset am Touchgeraet spielbar ist', () => {
    const touchSlot = (id: string): TestSlot => ({ id, filters: { evaluationModes: ['option-comparison'] } })
    const touchPreset = { id: 'touch', label: 'Touch', slots: [touchSlot('a'), touchSlot('b')] }
    const result = validate([question({ id: 'q1' }), question({ id: 'q2' }), revealQuestion], {
      presets: [...baseConfig.presets, touchPreset],
      audiences: [{ ...baseConfig.audiences[0]!, allowedPresetIds: ['standard', 'touch'] }],
    })

    const standard = result.coverage.find((entry) => entry.presetId === 'standard')!
    const touch = result.coverage.find((entry) => entry.presetId === 'touch')!
    // Das Buehnenpreset enthaelt einen Bilderkennen-Platz mit muendlicher Antwort.
    expect(standard.selfServiceCapable).toBe(false)
    expect(touch.selfServiceCapable).toBe(true)
  })

  it('berechnet Poolabdeckung und moegliche Spiele ohne Wiederholung', () => {
    const result = validate([question({ id: 'q1' }), question({ id: 'q2' }), revealQuestion])
    const coverage = result.coverage[0]!
    expect(coverage.slots[0]!.candidateCount).toBe(2)
    expect(coverage.slots[1]!.candidateCount).toBe(1)
    expect(coverage.gamesWithoutRepetition).toBe(1)
  })
})

describe('Fehlende Mediendateien', () => {
  const questions = [question({ id: 'q1' }), revealQuestion]

  it('ist ohne Angabe ein Fehler', () => {
    const result = validate(questions, {}, false)
    expect(result.ok).toBe(false)
    expect(result.errors.some((issue) => issue.code === 'asset-file-missing')).toBe(true)
  })

  it('wird mit "warning" zur Warnung, ohne die Frage zu deaktivieren', () => {
    const result = validateContent({
      config: baseConfig,
      questions,
      assets: [asset],
      assetFileExists: () => false,
      missingMediaSeverity: 'warning',
    })
    expect(result.ok).toBe(true)
    expect(result.warnings.find((issue) => issue.code === 'asset-file-missing')?.message).toContain('Ersatzbild')
  })

  it('meldet eine unvollstaendige, deaktivierte Frage als Warnung statt als Fehler', () => {
    const draft = question({ id: 'entwurf', enabled: false, options: [{ id: 'o1', text: 'A' }] })
    const result = validate([question({ id: 'q1' }), revealQuestion, draft])
    expect(result.ok).toBe(true)
    expect(result.warnings.find((issue) => issue.code === 'option-count')?.message).toContain('deaktiviert')
  })
})

describe('Themes ohne Darstellung', () => {
  it('nimmt ein Theme ohne Farben und Schriften an - Darstellung gehoert dem Gastgeber', () => {
    const result = validate([question({ id: 'q1' }), revealQuestion], {
      themes: [{ id: 'default', label: 'Standard' }],
    })
    expect(result.ok).toBe(true)
  })
})

describe('Inhaltsprofile', () => {
  const videoQuestion = question({
    id: 'v1',
    questionType: 'video-then-question',
    media: { videoAssetId: 'vid-1' },
  })
  const videoAsset: MediaAsset = {
    id: 'vid-1',
    kind: 'video',
    filename: 'video/test.mp4',
    mimeType: 'video/mp4',
    credit: 'Eigene',
  }
  const source = {
    config: {
      ...baseConfig,
      presets: [
        {
          id: 'standard',
          label: 'Standard',
          slots: [
            { id: 'text', filters: { questionTypes: ['video-then-question', 'text-choice'] } },
            { id: 'nur-video', filters: { questionTypes: ['video-then-question'] } },
          ],
        },
      ],
    },
    questions: [question({ id: 'q1' }), videoQuestion],
    assets: [asset, videoAsset],
    rootDir: '/tmp',
  }

  it('laesst das Profil "full" unveraendert', () => {
    expect(applyContentProfile(source, 'full')).toBe(source)
  })

  it('nimmt fuer "no-video" Fragen, Medien und Fragenplatzfilter heraus', () => {
    const reduced = applyContentProfile(source, 'no-video')

    expect((reduced.questions as Question[]).map((entry) => entry.id)).toEqual(['q1'])
    expect(reduced.assets.map((entry) => entry.id)).toEqual(['img-1'])

    /*
     * Die ANZAHL der Fragenplaetze bleibt - sonst passte das Preset nicht mehr
     * zu `questionsPerGame`. Ein Platz, der NUR Videofragen zuliess, wird zum
     * freien Platz; bei einem gemischten Filter faellt nur der Videotyp weg.
     */
    const slots = (reduced.config as typeof source.config).presets[0]!.slots
    expect(slots).toHaveLength(2)
    expect(slots[0]!.filters).toEqual({ questionTypes: ['text-choice'] })
    expect(slots[1]!.filters).toEqual({})
  })

  it('laesst die Quelle des vollen Profils unberuehrt', () => {
    applyContentProfile(source, 'no-video')
    expect((source.questions as Question[]).map((entry) => entry.id)).toEqual(['q1', 'v1'])
    expect(source.config.presets[0]!.slots[1]!.filters.questionTypes).toEqual(['video-then-question'])
  })
})
