/**
 * Inhaltszugriff des Servers.
 *
 * Verantwortung:
 *  - das versionierte Basispaket laden;
 *  - lokale Hotfixes als Overlay anwenden (das Basispaket bleibt unveraendert);
 *  - der Engine ueber den Port `QuestionSource` Fragen fuer Fragenplaetze liefern;
 *  - Asset-IDs in ausspielbare URLs uebersetzen.
 *
 * Die Fragenauswahl selbst steht in `@quiz/domain/selection` - hier wird sie nur mit
 * Paket, Hotfixes und Nutzungshistorie verbunden.
 */
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { applyPatches, loadQuizPackage } from '@quiz/content'
import type { Question, QuestionPatch, QuizPackage, RuntimeQuestion } from '@quiz/contracts'
import {
  poolForMode,
  repetitionKey,
  selectQuestionForSlot,
  shuffleOptionOrder,
  type Rng,
  type UsageSummary,
  type QuestionSource,
  type SlotRequest,
  type SlotResponse,
} from '@quiz/domain'
import type { UsageRow } from '@quiz/persistence'

export class ContentService {
  private quizPackage: QuizPackage
  /** Basisbestand plus gueltige Hotfixes - das ist der tatsaechlich gespielte Inhalt. */
  private effectiveQuestions: Question[]
  private rejectedPatches: { questionId: string; reason: string }[] = []

  /**
   * `extraMediaRoots`: zusaetzliche Wurzeln fuer die Medienaufloesung, siehe
   * `mediaRoots`. Sie kommen vom Aufrufer - dieses Paket kennt keine
   * Repository-Struktur mehr.
   */
  constructor(packageDir: string, patches: QuestionPatch[] = [], extraMediaRoots: string[] = []) {
    this.quizPackage = loadQuizPackage(packageDir)
    this.effectiveQuestions = this.quizPackage.questions
    this.extraMediaRoots = extraMediaRoots
    this.applyPatchOverlay(patches)
  }

  private readonly extraMediaRoots: string[]

  get contentVersion(): string {
    return this.quizPackage.manifest.contentVersion
  }

  get config() {
    return this.quizPackage.config
  }

  get rootDir(): string {
    return this.quizPackage.rootDir
  }

  get questions(): Question[] {
    return this.effectiveQuestions
  }

  /** Basisbestand ohne Overlay - Grundlage des Aenderungsberichts. */
  get baseQuestions(): Question[] {
    return this.quizPackage.questions
  }

  get patchWarnings(): string[] {
    return this.rejectedPatches.map(
      (entry) => `Frage ${entry.questionId} wurde wegen eines ungültigen Hotfixes nicht geladen: ${entry.reason}`,
    )
  }

  applyPatchOverlay(patches: QuestionPatch[]): void {
    const overlay = applyPatches(this.quizPackage.questions, patches)
    this.effectiveQuestions = overlay.questions
    this.rejectedPatches = overlay.rejected
  }

  findQuestion(questionId: string): Question | undefined {
    return this.effectiveQuestions.find((question) => question.id === questionId)
  }

  assetFilename(assetId: string): string | undefined {
    return this.quizPackage.assetsById.get(assetId)?.filename
  }

  /**
   * Verzeichnisse, in denen eine Mediendatei gesucht wird - in dieser Reihenfolge.
   *
   * Erste Wahl ist das gebaute Paket; es ist die verbindliche, versionierte Quelle
   * und das Einzige, was in einer ausgelieferten Anwendung existiert.
   *
   * Danach kommen die injizierten Rueckfallwurzeln. Der Anwendungsfall ist die
   * Entwicklung: Die Bilddateien liegen im Repository unter
   * `content/source/assets`, ihre Kopien im Paket entstehen erst beim Build.
   * Ohne den Rueckfall zeigte eine frisch geklonte Arbeitskopie ueberall
   * Ersatzbilder, obwohl die Bilder danebenliegen. Eine ausgelieferte
   * Anwendung injiziert nichts, dort bleibt es beim Paket.
   */
  get mediaRoots(): string[] {
    return [this.quizPackage.rootDir, ...this.extraMediaRoots].filter(
      (dir, index) => index === 0 || existsSync(join(dir, 'assets')),
    )
  }

  /** URL, unter der ein Medium ausgeliefert wird. Der Pfad kommt nie aus den Quizdaten. */
  assetUrl(assetId: string | undefined): string | undefined {
    if (!assetId || !this.quizPackage.assetsById.has(assetId)) return undefined
    return `/media/${encodeURIComponent(assetId)}`
  }

  /**
   * Baut den Port fuer die Engine.
   *
   * Die Nutzungshistorie wird pro Befehl frisch uebergeben, damit eine gerade
   * gebuchte Nutzung sofort in die naechste Auswahl einfliesst.
   */
  createQuestionSource(usageRows: UsageRow[], rng: Rng): QuestionSource {
    const usage = buildUsageMap(usageRows)
    const questions = this.effectiveQuestions
    const config = this.quizPackage.config

    return {
      slotCountFor: (quizModeId, presetId) => {
        const mode = config.modes.find((entry) => entry.id === quizModeId)
        if (!mode || !mode.allowedPresetIds.includes(presetId)) return null
        const preset = config.presets.find((entry) => entry.id === presetId)
        return preset ? preset.slots.length : null
      },

      selectForSlot: (request: SlotRequest): SlotResponse => {
        const mode = config.modes.find((entry) => entry.id === request.quizModeId)
        const preset = config.presets.find((entry) => entry.id === request.presetId)
        const slot = preset?.slots[request.slotIndex]
        if (!mode || !preset || !slot) {
          return { ok: false, message: 'Quizmodus, Preset oder Fragenplatz ist nicht konfiguriert.' }
        }

        const result = selectQuestionForSlot({
          slot,
          slotIndex: request.slotIndex,
          pool: poolForMode(questions, mode),
          excludeQuestionIds: new Set(request.excludeQuestionIds),
          excludeRepetitionGroupIds: new Set(request.excludeRepetitionGroupIds),
          usage,
          rng,
        })
        if (!result.ok) return { ok: false, message: result.message }

        const runtimeQuestion: RuntimeQuestion = {
          question: result.question,
          slotId: slot.id,
          slotIndex: request.slotIndex,
          // Die sichtbare Reihenfolge wird pro Spiel gemischt; ausgewertet wird
          // immer gegen `correctOptionId`.
          optionOrder: shuffleOptionOrder(result.question, rng),
        }
        return { ok: true, runtimeQuestion, rationale: result.rationale.text }
      },
    }
  }
}

/**
 * Historie nach Wiederholungsschluessel. Fragen derselben Wiederholungsgruppe teilen
 * sich einen Eintrag, damit Varianten wie dieselbe Frage behandelt werden.
 */
export function buildUsageMap(rows: UsageRow[]): Map<string, UsageSummary> {
  const usage = new Map<string, UsageSummary>()
  for (const row of rows) {
    const key = row.repetitionGroupId ?? row.questionId
    const existing = usage.get(key)
    usage.set(key, {
      lastUsedAtMs: Math.max(existing?.lastUsedAtMs ?? 0, row.usedAtMs),
      useCount: (existing?.useCount ?? 0) + 1,
    })
  }
  return usage
}

export { repetitionKey }
