/**
 * Selection tests (specification 31.2).
 *
 * Randomised cases use fixed seeds, so that failures are reproducible.
 */
import { describe, expect, it } from 'vitest'
import type { Question, QuestionSlotRule } from '../src'
import {
  candidateWindowSize,
  createSeededRng,
  matchesSlot,
  poolForGame,
  repetitionKey,
  selectQuestionForSlot,
  shuffleOptionOrder,
  type UsageSummary,
} from '../src/engine/selection'
import { makeQuestion } from './helpers'

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

describe('Slot filter', () => {
  it('combines difficulty, presentation type, category and tags', () => {
    const question = makeQuestion({
      id: 'q1',
      difficulty: 'hard',
      questionType: 'image-reveal',
      categories: ['history', 'saarbruecken'],
      tags: ['regional'],
    })

    expect(matchesSlot(question, slot({ filters: { difficultyIds: ['hard'] } }))).toBe(true)
    expect(matchesSlot(question, slot({ filters: { difficultyIds: ['easy'] } }))).toBe(false)
    expect(matchesSlot(question, slot({ filters: { questionTypes: ['image-reveal'] } }))).toBe(true)
    expect(matchesSlot(question, slot({ filters: { questionTypes: ['text-choice'] } }))).toBe(false)
    expect(matchesSlot(question, slot({ filters: { categoryIds: ['saarbruecken'] } }))).toBe(true)
    expect(matchesSlot(question, slot({ filters: { tags: ['regional'] } }))).toBe(true)
    expect(matchesSlot(question, slot({ filters: { tags: ['regional', 'fehlt'] } }))).toBe(false)
    // All filters together have to match at the same time.
    expect(
      matchesSlot(question, slot({ filters: { difficultyIds: ['hard'], categoryIds: ['history'] } })),
    ).toBe(true)
    expect(
      matchesSlot(question, slot({ filters: { difficultyIds: ['hard'], categoryIds: ['sports'] } })),
    ).toBe(false)
  })

  it('filters on the evaluation mode - the basis of kiosk operation', () => {
    const oral = makeQuestion({
      id: 'q-muendlich',
      evaluationMode: 'manual-correct-incorrect',
      options: undefined,
      correctOptionId: undefined,
      acceptedAnswerText: ['Bundestag'],
    })
    const evaluable = makeQuestion({ id: 'q-auswertbar' })
    const rule = slot({ filters: { evaluationModes: ['option-comparison'] } })

    expect(matchesSlot(evaluable, rule)).toBe(true)
    expect(matchesSlot(oral, rule)).toBe(false)
    // Without filters both stay admissible - that is how the stage runs.
    expect(matchesSlot(oral, slot())).toBe(true)
  })

  it('treats missing filters as "any" - no special value "random" needed', () => {
    const question = makeQuestion({ id: 'q1' })
    expect(matchesSlot(question, slot({ filters: {} }))).toBe(true)
  })

  it('ignores disabled questions', () => {
    const question = makeQuestion({ id: 'q1', enabled: false })
    expect(matchesSlot(question, slot())).toBe(false)
  })
})

describe('Base set of a game', () => {
  it('filters by audience and lets all pools play without a pool selection', () => {
    const questions = [
      makeQuestion({ id: 'q1', audiences: ['adults'], poolIds: ['saarbruecken'] }),
      makeQuestion({ id: 'q2', audiences: ['adults'], poolIds: ['bundestag'] }),
      makeQuestion({ id: 'q3', audiences: ['kids'], poolIds: ['saarbruecken'] }),
    ]
    expect(poolForGame(questions, { audience: 'adults' }).map((question) => question.id)).toEqual(['q1', 'q2'])
  })

  it('maps the regional selection as a plain question pool - without special code', () => {
    const questions = [
      makeQuestion({ id: 'q1', audiences: ['adults'], poolIds: ['saarbruecken'] }),
      makeQuestion({ id: 'q2', audiences: ['adults'], poolIds: ['bundestag'] }),
      makeQuestion({ id: 'q3', audiences: ['kids'], poolIds: ['saarbruecken'] }),
    ]
    expect(
      poolForGame(questions, { audience: 'adults', poolIds: ['saarbruecken'] }).map((question) => question.id),
    ).toEqual(['q1'])
  })
})

describe('Repetition avoidance', () => {
  it('excludes questions already used in the game', () => {
    const questions = pool(3)
    const result = select({ questions, excludeQuestionIds: new Set(['q1', 'q2']) })
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.question.id).toBe('q3')
  })

  it('treats a repetition group like the same question', () => {
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

  it('prefers never used questions', () => {
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

  it('prefers the longest unused questions when the pool is exhausted', () => {
    const questions = pool(10)
    const usage = new Map<string, UsageSummary>(
      questions.map((question, index) => [question.id, { lastUsedAtMs: index * 1_000, useCount: 1 }]),
    )
    // windowSize = max(3, ceil(10 * 0.2)) = 3 -> only q1..q3 are candidates.
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
    // Inside the freshness class real randomness is preserved.
    expect(picked.size).toBeGreaterThan(1)
  })

  it('weights in favour of older questions within the window', () => {
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

  it('is independent of mode and preset because the history is addressed globally', () => {
    // The history is addressed via `repetitionKey` - without mode or preset in the key.
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

describe('Error cases', () => {
  it('reports an unsatisfiable question slot with a clear message', () => {
    const result = select({
      questions: pool(3, () => ({ difficulty: 'easy' })),
      rule: slot({ id: 'slot-hart', filters: { difficultyIds: ['hard'] } }),
    })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.message).toContain('slot-hart')
      expect(result.rationale.matchingCandidates).toBe(0)
    }
  })

  it('reports a question slot exhausted in the game separately', () => {
    const result = select({ questions: pool(2), excludeQuestionIds: new Set(['q1', 'q2']) })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.message).toContain('bereits verwendet')
  })
})

describe('Option order', () => {
  it('shuffles the visible order without losing options', () => {
    const question = makeQuestion({ id: 'q1' })
    const order = shuffleOptionOrder(question, createSeededRng(42))
    expect([...order].sort()).toEqual(['a', 'b', 'c', 'd'])
  })

  it('is reproducible with a fixed seed', () => {
    const question = makeQuestion({ id: 'q1' })
    expect(shuffleOptionOrder(question, createSeededRng(99))).toEqual(shuffleOptionOrder(question, createSeededRng(99)))
  })
})
