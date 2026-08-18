/**
 * Inhaltsvalidierung (Spezifikation 24.4 und 17.5) und Hotfix-Overlay (25).
 */
import { describe, expect, it } from 'vitest'
import type { MediaAsset, Question, QuestionPatch } from '@quiz/contracts'
import { validateContent } from '../src/validate.ts'
import { applyPatches, buildChangeReport, findUnreconciledPatches } from '../src/hotfix.ts'

const asset: MediaAsset = { id: 'img-1', kind: 'image', filename: 'images/a.svg', mimeType: 'image/svg+xml', credit: 'Eigene' }

const baseConfig = {
  questionsPerGame: 2,
  difficulties: [{ id: 'easy', label: 'Leicht' }],
  categories: [{ id: 'allgemein', label: 'Allgemein' }],
  themes: [{ id: 'default', label: 'Standard', colors: { background: '#000' } }],
  presets: [
    {
      id: 'standard',
      label: 'Standard',
      slots: [
        { id: 'text', filters: { presentationTypes: ['text-choice'] } },
        { id: 'bild', filters: { presentationTypes: ['image-reveal'] } },
      ],
    },
  ],
  modes: [{ id: 'adults', label: 'Erwachsene', questionFilter: {}, themeId: 'default', allowedPresetIds: ['standard'] }],
}

function question(overrides: Partial<Question> & { id: string }): Question {
  return {
    modeIds: ['adults'],
    difficultyId: 'easy',
    categoryIds: ['allgemein'],
    tags: [],
    prompt: `Frage ${overrides.id}`,
    presentationType: 'text-choice',
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
  presentationType: 'image-reveal',
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

  it('erkennt eine falsche Optionsanzahl', () => {
    const result = validate([
      question({ id: 'q1', options: [{ id: 'o1', text: 'A' }, { id: 'o2', text: 'B' }] }),
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
    const result = validate([question({ id: 'q1', categoryIds: ['gibt-es-nicht'], difficultyId: 'unbekannt' }), revealQuestion])
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

  it('berechnet Poolabdeckung und moegliche Spiele ohne Wiederholung', () => {
    const result = validate([question({ id: 'q1' }), question({ id: 'q2' }), revealQuestion])
    const coverage = result.coverage[0]!
    expect(coverage.slots[0]!.candidateCount).toBe(2)
    expect(coverage.slots[1]!.candidateCount).toBe(1)
    expect(coverage.gamesWithoutRepetition).toBe(1)
  })
})

describe('Hotfix-Overlay', () => {
  const base = [question({ id: 'q1', prompt: 'Alter Text' })]
  const patch: QuestionPatch = {
    id: 'patch-1',
    questionId: 'q1',
    baseContentVersion: '1.0.0',
    changes: { prompt: 'Korrigierter Text' },
    reason: 'Tippfehler',
    createdAt: '2026-08-18T20:00:00.000Z',
    createdBy: 'operator',
    applyMode: 'next-use',
  }

  it('veraendert das Basispaket nicht, sondern legt sich darueber', () => {
    const result = applyPatches(base, [patch])
    expect(result.questions[0]!.prompt).toBe('Korrigierter Text')
    // Der Basisbestand bleibt unangetastet.
    expect(base[0]!.prompt).toBe('Alter Text')
  })

  it('laedt eine Frage mit ungueltigem Patch gar nicht', () => {
    const broken: QuestionPatch = { ...patch, id: 'patch-2', changes: { prompt: '' } }
    const result = applyPatches(base, [broken])
    expect(result.questions).toHaveLength(0)
    expect(result.rejected[0]!.questionId).toBe('q1')
  })

  it('protokolliert alten und neuen Wert fuer den Export', () => {
    const report = buildChangeReport(base, [patch])
    expect(report[0]).toMatchObject({
      questionId: 'q1',
      field: 'prompt',
      oldValue: 'Alter Text',
      newValue: 'Korrigierter Text',
      reason: 'Tippfehler',
      baseContentVersion: '1.0.0',
    })
  })

  it('warnt, wenn ein Hotfix in der neuen Kundenquelle fehlt', () => {
    const newBase = [question({ id: 'q1', prompt: 'Alter Text' })]
    expect(findUnreconciledPatches([patch], newBase)).toHaveLength(1)
    const reconciled = [question({ id: 'q1', prompt: 'Korrigierter Text' })]
    expect(findUnreconciledPatches([patch], reconciled)).toHaveLength(0)
  })
})

/**
 * Fehlende Mediendateien waehrend der Entwicklung.
 *
 * Der freigegebene Bildbestand liegt spaeter vor als der Fragenkatalog. Damit die
 * Entwicklung nicht blockiert, laesst sich die Meldung zur Warnung herabstufen -
 * fuer den Livebetrieb bleibt sie ein Fehler.
 */
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
