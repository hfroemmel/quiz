/**
 * Live hotfixes as an overlay over the versioned base package (specification 25).
 *
 * Ground rule: the built base file is not changed during the event.
 *
 *   versioned base quiz package + local validated hotfix = content actually loaded
 *
 * Every patch is validated against the same schema as the base content. A
 * question with an invalid patch is not loaded - better it drops out of the pool
 * than appear inconsistent live.
 */
import { questionSchema, type Question, type QuestionPatch } from '../contracts'

export interface OverlayResult {
  questions: Question[]
  /** Questions whose patch was invalid and which were therefore not loaded. */
  rejected: { questionId: string; reason: string }[]
  appliedPatchIds: string[]
}

/**
 * Applies patches to the base set.
 *
 * `applyMode` decides when a patch takes effect:
 *  - `next-use`: the patch applies to the loaded pool, i.e. from the next use of
 *    the question. A question currently visible in public is not touched by it,
 *    because the server keeps its runtime copy.
 *  - `immediate-confirmed`: the operator has confirmed "apply now"; the server
 *    additionally swaps the running question.
 */
export function applyPatches(base: Question[], patches: QuestionPatch[]): OverlayResult {
  const byQuestion = new Map<string, QuestionPatch[]>()
  for (const patch of patches) {
    byQuestion.set(patch.questionId, [...(byQuestion.get(patch.questionId) ?? []), patch])
  }

  const rejected: OverlayResult['rejected'] = []
  const appliedPatchIds: string[] = []
  const questions: Question[] = []

  for (const question of base) {
    const relevant = byQuestion.get(question.id)
    if (!relevant?.length) {
      questions.push(question)
      continue
    }
    // Patches are applied in order of creation; the later one wins.
    const ordered = [...relevant].sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    const merged = ordered.reduce<Question>((current, patch) => ({ ...current, ...patch.changes }), question)

    const parsed = questionSchema.safeParse(merged)
    if (!parsed.success) {
      rejected.push({
        questionId: question.id,
        reason: parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; '),
      })
      continue
    }
    questions.push(parsed.data)
    appliedPatchIds.push(...ordered.map((patch) => patch.id))
  }

  return { questions, rejected, appliedPatchIds }
}

export interface PatchChangeReportEntry {
  questionId: string
  field: string
  oldValue: string
  newValue: string
  changedAt: string
  reason?: string
  baseContentVersion: string
}

/**
 * Change report for the export after the event (specification 25.4).
 * It names the old and the new value per field, so that the editors can carry
 * the correction into the customer source.
 */
export function buildChangeReport(base: Question[], patches: QuestionPatch[]): PatchChangeReportEntry[] {
  const baseById = new Map(base.map((question) => [question.id, question]))
  const entries: PatchChangeReportEntry[] = []

  for (const patch of [...patches].sort((a, b) => a.createdAt.localeCompare(b.createdAt))) {
    const original = baseById.get(patch.questionId)
    for (const [field, newValue] of Object.entries(patch.changes)) {
      const oldValue = original ? (original as unknown as Record<string, unknown>)[field] : undefined
      entries.push({
        questionId: patch.questionId,
        field,
        oldValue: stringify(oldValue),
        newValue: stringify(newValue),
        changedAt: patch.createdAt,
        reason: patch.reason,
        baseContentVersion: patch.baseContentVersion,
      })
    }
  }
  return entries
}

/**
 * Warning at the next content import: has a local hotfix not yet been carried
 * into the new customer source?
 */
export function findUnreconciledPatches(
  patches: QuestionPatch[],
  newBase: Question[],
): { patch: QuestionPatch; field: string }[] {
  const byId = new Map(newBase.map((question) => [question.id, question]))
  const open: { patch: QuestionPatch; field: string }[] = []

  for (const patch of patches) {
    const question = byId.get(patch.questionId)
    if (!question) continue
    for (const [field, patchedValue] of Object.entries(patch.changes)) {
      const currentValue = (question as unknown as Record<string, unknown>)[field]
      if (stringify(currentValue) !== stringify(patchedValue)) {
        open.push({ patch, field })
      }
    }
  }
  return open
}

function stringify(value: unknown): string {
  if (value === undefined) return '(nicht gesetzt)'
  if (typeof value === 'string') return value
  return JSON.stringify(value)
}
