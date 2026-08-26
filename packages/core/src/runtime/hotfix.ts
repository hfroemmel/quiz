/**
 * Live-Hotfixes als Overlay ueber dem versionierten Basispaket (Spezifikation 25).
 *
 * Grundregel: Die gebaute Basisdatei wird waehrend der Veranstaltung nicht veraendert.
 *
 *   versioniertes Basis-Quizpaket + lokaler validierter Hotfix = tatsaechlich geladener Inhalt
 *
 * Jeder Patch wird gegen dasselbe Schema validiert wie der Basisinhalt. Eine Frage mit
 * ungueltigem Patch wird nicht geladen - lieber faellt sie aus dem Pool, als dass sie
 * live inkonsistent erscheint.
 */
import { questionSchema, type Question, type QuestionPatch } from '../contracts'

export interface OverlayResult {
  questions: Question[]
  /** Fragen, deren Patch ungueltig war und die deshalb nicht geladen wurden. */
  rejected: { questionId: string; reason: string }[]
  appliedPatchIds: string[]
}

/**
 * Wendet Patches auf den Basisbestand an.
 *
 * `applyMode` entscheidet, wann ein Patch wirkt:
 *  - `next-use`: Der Patch gilt fuer den geladenen Pool, also ab dem naechsten Einsatz
 *    der Frage. Eine gerade oeffentlich sichtbare Frage wird davon nicht beruehrt,
 *    weil der Server ihre Laufzeitkopie behaelt.
 *  - `immediate-confirmed`: Der Operator hat "Jetzt uebernehmen" bestaetigt; der Server
 *    tauscht zusaetzlich die laufende Frage aus.
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
    // Patches werden in Entstehungsreihenfolge angewendet; der spaetere gewinnt.
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
 * Aenderungsbericht fuer den Export nach der Veranstaltung (Spezifikation 25.4).
 * Er nennt alten und neuen Wert je Feld, damit die Redaktion die Korrektur in die
 * Kundenquelle uebernehmen kann.
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
 * Warnung beim naechsten Inhaltsimport: Wurde ein lokaler Hotfix in der neuen
 * Kundenquelle noch nicht nachvollzogen?
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
