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
import { applyPatches } from './hotfix'
import type { Question, QuestionPatch, QuizPackage, RuntimeQuestion } from '../contracts'
import {
  poolForGame,
  repetitionKey,
  selectQuestionForSlot,
  shuffleOptionOrder,
  type Rng,
  type UsageSummary,
  type QuestionSource,
  type SlotRequest,
  type SlotResponse,
} from '../engine'
import type { UsageRow } from '../engine/storePort'

export class ContentService {
  private quizPackage: QuizPackage
  /** Basisbestand plus gueltige Hotfixes - das ist der tatsaechlich gespielte Inhalt. */
  private effectiveQuestions: Question[]
  private rejectedPatches: { questionId: string; reason: string }[] = []

  /**
   * Das Paket kommt GELADEN herein - dieses Modul liest keine Dateien. Den
   * Ladeweg (Verzeichnis, Pruefsumme) stellt `@hfroemmel/quiz-content` bereit;
   * `extraMediaRoots` sind zusaetzliche Wurzeln fuer die Medienaufloesung des
   * Servers und kommen ebenfalls vom Aufrufer.
   */
  constructor(quizPackage: QuizPackage, patches: QuestionPatch[] = [], extraMediaRoots: string[] = []) {
    this.quizPackage = quizPackage
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
   * Ob eine Wurzel existiert, prueft der Ausliefernde je Datei - dieses Modul
   * fasst kein Dateisystem an.
   */
  get mediaRoots(): string[] {
    return [this.quizPackage.rootDir, ...this.extraMediaRoots]
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
      slotCountFor: (audience, presetId) => {
        const audienceConfig = config.audiences.find((entry) => entry.id === audience)
        if (!audienceConfig || !audienceConfig.allowedPresetIds.includes(presetId)) return null
        const preset = config.presets.find((entry) => entry.id === presetId)
        return preset ? preset.slots.length : null
      },

      selectForSlot: (request: SlotRequest): SlotResponse => {
        const audienceConfig = config.audiences.find((entry) => entry.id === request.audience)
        const preset = config.presets.find((entry) => entry.id === request.presetId)
        const slot = preset?.slots[request.slotIndex]
        if (!audienceConfig || !preset || !slot) {
          return { ok: false, message: 'Zielgruppe, Preset oder Fragenplatz ist nicht konfiguriert.' }
        }

        const result = selectQuestionForSlot({
          slot,
          slotIndex: request.slotIndex,
          pool: poolForGame(questions, { audience: request.audience, poolIds: request.poolIds }),
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
