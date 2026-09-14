/**
 * Hotfix overlay (specification 25): the base package stays unchanged, the
 * corrections lie over it at runtime.
 */
import { describe, expect, it } from 'vitest'
import type { Question, QuestionPatch } from '../src/contracts'
import { applyPatches, buildChangeReport, findUnreconciledPatches } from '../src/runtime/hotfix'
import { makeQuestion } from './helpers'

const question = (overrides: Partial<Question> & { id: string }) =>
  makeQuestion({ options: [
    { id: 'o1', text: 'A' },
    { id: 'o2', text: 'B' },
    { id: 'o3', text: 'C' },
    { id: 'o4', text: 'D' },
  ], correctOptionId: 'o1', ...overrides })

describe('Hotfix overlay', () => {
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

  it('does not change the base package but lays itself over it', () => {
    const result = applyPatches(base, [patch])
    expect(result.questions[0]!.prompt).toBe('Korrigierter Text')
    // The base set stays untouched.
    expect(base[0]!.prompt).toBe('Alter Text')
  })

  it('does not load a question with an invalid patch at all', () => {
    const broken: QuestionPatch = { ...patch, id: 'patch-2', changes: { prompt: '' } }
    const result = applyPatches(base, [broken])
    expect(result.questions).toHaveLength(0)
    expect(result.rejected[0]!.questionId).toBe('q1')
  })

  it('logs old and new value for the export', () => {
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

  it('warns when a hotfix is missing in the new customer source', () => {
    const newBase = [question({ id: 'q1', prompt: 'Alter Text' })]
    expect(findUnreconciledPatches([patch], newBase)).toHaveLength(1)
    const reconciled = [question({ id: 'q1', prompt: 'Korrigierter Text' })]
    expect(findUnreconciledPatches([patch], reconciled)).toHaveLength(0)
  })
})

/**
 * Missing media files during development.
 *
 * The approved image set arrives later than the question catalogue. So that
 * development is not blocked, the finding can be downgraded to a warning - for
 * live operation it stays an error.
 */
