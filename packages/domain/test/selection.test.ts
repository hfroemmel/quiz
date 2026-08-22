/**
 * Auswahltests (Spezifikation 31.2).
 *
 * Randomisierte Faelle verwenden gesetzte Seeds, damit Fehler reproduzierbar sind.
 */
import { describe, expect, it } from 'vitest'
import type { Question, QuestionSlotRule, QuizMode } from '@quiz/contracts'
import {
  candidateWindowSize,
  createSeededRng,
  matchesSlot,
  poolForMode,
  repetitionKey,
  selectQuestionForSlot,
  shuffleOptionOrder,
  type UsageSummary,
} from '../src/selection.ts'
import { makeQuestion } from './helpers.ts'

const slot = (overrides: Partial<QuestionSlotRule> = {}): QuestionSlotRule => ({
  id: 'slot-1',
  filters: {},
  ...overrides,
})

function pool(count: number, overrides: (index: number) => Partial<Question> = () => ({})): Question[] {
  return Array.from({ length: count }, (_, index) => makeQuestion({ id: `q${index + 1}`, ...overrides(index) }))
}

function select(input: {
  questions: Question[]
  rule?: QuestionSlotRule
  usage?: Map<string, UsageSummary>
  excludeQuestionIds?: Set<string>
  excludeRepetitionGroupIds?: Set<string>
  seed?: number
}) {
  return selectQuestionForSlot({
    slot: input.rule ?? slot(),
    slotIndex: 0,
    pool: input.questions,
    excludeQuestionIds: input.excludeQuestionIds ?? new Set(),
    excludeRepetitionGroupIds: input.excludeRepetitionGroupIds ?? new Set(),
    usage: input.usage ?? new Map(),
    rng: createSeededRng(input.seed ?? 1),
  })
}

describe('Slotfilter', () => {
  it('kombiniert Schwierigkeit, Praesentationstyp, Kategorie und Tags', () => {
    const question = makeQuestion({
      id: 'q1',
      difficultyId: 'hard',
      presentationType: 'image-reveal',
      categoryIds: ['history', 'saarbruecken'],
      tags: ['regional'],
    })

    expect(matchesSlot(question, slot({ filters: { difficultyIds: ['hard'] } }))).toBe(true)
    expect(matchesSlot(question, slot({ filters: { difficultyIds: ['easy'] } }))).toBe(false)
    expect(matchesSlot(question, slot({ filters: { presentationTypes: ['image-reveal'] } }))).toBe(true)
    expect(matchesSlot(question, slot({ filters: { presentationTypes: ['text-choice'] } }))).toBe(false)
    expect(matchesSlot(question, slot({ filters: { categoryIds: ['saarbruecken'] } }))).toBe(true)
    expect(matchesSlot(question, slot({ filters: { tags: ['regional'] } }))).toBe(true)
    expect(matchesSlot(question, slot({ filters: { tags: ['regional', 'fehlt'] } }))).toBe(false)
    // Alle Filter zusammen muessen gleichzeitig passen.
    expect(
      matchesSlot(question, slot({ filters: { difficultyIds: ['hard'], categoryIds: ['history'] } })),
    ).toBe(true)
    expect(
      matchesSlot(question, slot({ filters: { difficultyIds: ['hard'], categoryIds: ['sports'] } })),
    ).toBe(false)
  })

  it('filtert auf das Bewertungsverfahren - die Grundlage des Kioskbetriebs', () => {
    const muendlich = makeQuestion({
      id: 'q-muendlich',
      evaluationMode: 'manual-correct-incorrect',
      options: undefined,
      correctOptionId: undefined,
      acceptedAnswerText: ['Bundestag'],
    })
    const auswertbar = makeQuestion({ id: 'q-auswertbar' })
    const rule = slot({ filters: { evaluationModes: ['option-comparison'] } })

    expect(matchesSlot(auswertbar, rule)).toBe(true)
    expect(matchesSlot(muendlich, rule)).toBe(false)
    // Ohne Filter bleibt beides zulaessig - so laeuft die Buehne.
    expect(matchesSlot(muendlich, slot())).toBe(true)
  })

  it('behandelt fehlende Filter als "beliebig" - kein Sonderwert "random" noetig', () => {
    const question = makeQuestion({ id: 'q1' })
    expect(matchesSlot(question, slot({ filters: {} }))).toBe(true)
  })

  it('ignoriert deaktivierte Fragen', () => {
    const question = makeQuestion({ id: 'q1', enabled: false })
    expect(matchesSlot(question, slot())).toBe(false)
  })
})

describe('Modusfilter', () => {
  it('bildet eine regionale Auswahl ueber Kategorien statt ueber Sondercode ab', () => {
    const questions = [
      makeQuestion({ id: 'q1', modeIds: ['adults'], categoryIds: ['saarbruecken'] }),
      makeQuestion({ id: 'q2', modeIds: ['adults'], categoryIds: ['history'] }),
      makeQuestion({ id: 'q3', modeIds: ['kids'], categoryIds: ['saarbruecken'] }),
    ]
    const regional: QuizMode = {
      id: 'adults',
      label: 'Saarbruecken',
      questionFilter: { categoryIds: ['saarbruecken'] },
      themeId: 'default',
      allowedPresetIds: ['medium'],
    }
    expect(poolForMode(questions, regional).map((question) => question.id)).toEqual(['q1'])
  })
})

describe('Wiederholungsvermeidung', () => {
  it('schliesst im Spiel bereits verwendete Fragen aus', () => {
    const questions = pool(3)
    const result = select({ questions, excludeQuestionIds: new Set(['q1', 'q2']) })
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.question.id).toBe('q3')
  })

  it('behandelt eine Wiederholungsgruppe wie dieselbe Frage', () => {
    const questions = [
      makeQuestion({ id: 'q1', repetitionGroupId: 'gruppe-a' }),
      makeQuestion({ id: 'q2', repetitionGroupId: 'gruppe-a' }),
      makeQuestion({ id: 'q3' }),
    ]
    expect(repetitionKey(questions[0]!)).toBe('gruppe-a')
    const result = select({ questions, excludeRepetitionGroupIds: new Set(['gruppe-a']) })
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.question.id).toBe('q3')
  })

  it('bevorzugt noch nie verwendete Fragen', () => {
    const questions = pool(6)
    const usage = new Map<string, UsageSummary>([
      ['q1', { lastUsedAtMs: 1, useCount: 1 }],
      ['q2', { lastUsedAtMs: 2, useCount: 1 }],
      ['q3', { lastUsedAtMs: 3, useCount: 1 }],
    ])
    for (let seed = 0; seed < 25; seed += 1) {
      const result = select({ questions, usage, seed })
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(['q4', 'q5', 'q6']).toContain(result.question.id)
        expect(result.rationale.freshnessClass).toBe('never-used')
      }
    }
  })

  it('bevorzugt bei erschoepftem Pool die am laengsten nicht verwendeten Fragen', () => {
    const questions = pool(10)
    const usage = new Map<string, UsageSummary>(
      questions.map((question, index) => [question.id, { lastUsedAtMs: index * 1_000, useCount: 1 }]),
    )
    // windowSize = max(3, ceil(10 * 0,2)) = 3 -> nur q1..q3 kommen in Frage.
    expect(candidateWindowSize(10)).toBe(3)
    const picked = new Set<string>()
    for (let seed = 0; seed < 60; seed += 1) {
      const result = select({ questions, usage, seed })
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(['q1', 'q2', 'q3']).toContain(result.question.id)
        expect(result.rationale.freshnessClass).toBe('least-recently-used')
        picked.add(result.question.id)
      }
    }
    // Innerhalb der Frischeklasse bleibt echte Zufaelligkeit erhalten.
    expect(picked.size).toBeGreaterThan(1)
  })

  it('gewichtet innerhalb des Fensters zugunsten aelterer Fragen', () => {
    const questions = pool(10)
    const usage = new Map<string, UsageSummary>(
      questions.map((question, index) => [question.id, { lastUsedAtMs: index * 1_000, useCount: 1 }]),
    )
    const counts = new Map<string, number>()
    for (let seed = 0; seed < 900; seed += 1) {
      const result = select({ questions, usage, seed })
      if (result.ok) counts.set(result.question.id, (counts.get(result.question.id) ?? 0) + 1)
    }
    expect(counts.get('q1')!).toBeGreaterThan(counts.get('q3')!)
  })

  it('ist unabhaengig von Modus und Preset, weil die Historie global adressiert wird', () => {
    // Die Historie wird ueber `repetitionKey` adressiert - ohne Modus oder Preset im Schluessel.
    const questions = pool(4)
    const usage = new Map<string, UsageSummary>([
      ['q1', { lastUsedAtMs: 10, useCount: 1 }],
      ['q2', { lastUsedAtMs: 20, useCount: 1 }],
      ['q3', { lastUsedAtMs: 30, useCount: 1 }],
      ['q4', { lastUsedAtMs: 40, useCount: 1 }],
    ])
    const result = select({ questions, usage, seed: 7 })
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.rationale.freshnessClass).toBe('least-recently-used')
  })
})

describe('Fehlerfaelle', () => {
  it('meldet einen nicht erfuellbaren Fragenplatz mit klarer Meldung', () => {
    const result = select({
      questions: pool(3, () => ({ difficultyId: 'easy' })),
      rule: slot({ id: 'slot-hart', filters: { difficultyIds: ['hard'] } }),
    })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.message).toContain('slot-hart')
      expect(result.rationale.matchingCandidates).toBe(0)
    }
  })

  it('meldet einen im Spiel erschoepften Fragenplatz getrennt', () => {
    const result = select({ questions: pool(2), excludeQuestionIds: new Set(['q1', 'q2']) })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.message).toContain('bereits verwendet')
  })
})

describe('Optionsreihenfolge', () => {
  it('mischt die sichtbare Reihenfolge, ohne Optionen zu verlieren', () => {
    const question = makeQuestion({ id: 'q1' })
    const order = shuffleOptionOrder(question, createSeededRng(42))
    expect([...order].sort()).toEqual(['a', 'b', 'c', 'd'])
  })

  it('ist mit gesetztem Seed reproduzierbar', () => {
    const question = makeQuestion({ id: 'q1' })
    expect(shuffleOptionOrder(question, createSeededRng(99))).toEqual(shuffleOptionOrder(question, createSeededRng(99)))
  })
})
