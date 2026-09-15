/**
 * Content access of the server.
 *
 * Responsibilities:
 *  - load the versioned base package;
 *  - apply local hotfixes as an overlay (the base package stays unchanged);
 *  - supply questions for slots to the engine through the `QuestionSource` port;
 *  - translate asset ids into servable URLs.
 *
 * The question selection itself lives in `@quiz/domain/selection` - here it is
 * only connected with package, hotfixes and usage history.
 */
import { applyPatches } from './hotfix'
import type { Question, QuestionPatch, QuizPackage, QuizUnavailableReason, RuntimeQuestion } from '../contracts'
import {
  poolForGame,
  repetitionKey,
  resolveQuizMode,
  selectQuestionForSlot,
  shuffleOptionOrder,
  type Rng,
  type UsageSummary,
  type QuestionSource,
  type SlotRequest,
  type SlotResponse,
} from '../engine'
import type { UsageRow } from '../engine/storePort'

/**
 * How a host resolves a medium of the package.
 *
 * It receives the id from the question data and answers with an address its own
 * window can load - or with nothing, if it has no medium for it.
 */
export type AssetResolver = (assetId: string) => string | undefined

export class ContentService {
  private quizPackage: QuizPackage
  /** Base set plus valid hotfixes - the content actually played. */
  private effectiveQuestions: Question[]
  private rejectedPatches: { questionId: string; reason: string }[] = []
  /** Counted answer of `quizAvailability` - invalidated with the question set. */
  private availability: Record<string, QuizUnavailableReason> | null = null

  /**
   * The package comes in LOADED - this module reads no files. The loading path
   * (directory, checksum) is provided by `@hfroemmel/quiz-content`;
   * `extraMediaRoots` are additional roots for the server's media resolution
   * and likewise come from the caller.
   */
  constructor(
    quizPackage: QuizPackage,
    patches: QuestionPatch[] = [],
    extraMediaRoots: string[] = [],
    options: { media?: AssetResolver | undefined } = {},
  ) {
    this.quizPackage = quizPackage
    this.effectiveQuestions = this.quizPackage.questions
    this.extraMediaRoots = extraMediaRoots
    this.media = options.media
    this.applyPatchOverlay(patches)
  }

  private readonly extraMediaRoots: string[]
  private readonly media: AssetResolver | undefined

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

  /** Base set without the overlay - basis of the change report. */
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
    // A hotfix can switch the last question of a pool off - then the answer
    // below changes too.
    this.availability = null
  }

  findQuestion(questionId: string): Question | undefined {
    return this.effectiveQuestions.find((question) => question.id === questionId)
  }

  assetFilename(assetId: string): string | undefined {
    return this.quizPackage.assetsById.get(assetId)?.filename
  }

  /**
   * Directories in which a media file is looked for - in this order.
   *
   * First choice is the built package; it is the binding, versioned source and
   * the only thing that exists in a shipped application.
   *
   * Then come the injected fallback roots. The use case is development: the
   * image files lie in the repository under `content/source/assets`, their
   * copies in the package only appear at build time. Whether a root exists is
   * checked per file by whoever serves it - this module touches no file system.
   */
  get mediaRoots(): string[] {
    return [this.quizPackage.rootDir, ...this.extraMediaRoots]
  }

  /**
   * URL under which a medium is served. The path never comes from the quiz data.
   *
   * WHERE A HOST BRINGS ITS OWN RESOLUTION, IT DECIDES. An application that has
   * its media in its own bundle - imported by a bundler, addressed by a
   * protocol of its own - cannot use this route, and it used to replace this
   * method from outside. It is a parameter now (`media` on the runtime).
   *
   * A resolver that answers with nothing means: there is no medium for this id.
   * The question then runs without an image instead of with a broken frame.
   */
  assetUrl(assetId: string | undefined): string | undefined {
    if (!assetId) return undefined
    if (this.media) return this.media(assetId)
    if (!this.quizPackage.assetsById.has(assetId)) return undefined
    return `/media/${encodeURIComponent(assetId)}`
  }

  /**
   * Which quiz types cannot be started right now - and why.
   *
   * A CONFIGURED QUIZ WITHOUT QUESTIONS IS THE NORMAL INTERMEDIATE STATE: the
   * pool exists, its questions are not written yet. Whoever counts questions is
   * the only one who can see that, so it is reported here and travels into the
   * projection, where the start menu reads it (`quizAvailability`).
   *
   * IT COUNTS, IT DOES NOT SIMULATE. Whether enough questions are left for
   * every slot of a round is decided by the selection, per game and against the
   * usage history; predicting it here would be a second selection that can
   * disagree with the first. An empty pool, on the other hand, is certain -
   * and it is the case a menu has to say out loud.
   */
  quizAvailability(): Record<string, QuizUnavailableReason> {
    if (this.availability) return this.availability
    const unavailable: Record<string, QuizUnavailableReason> = {}
    for (const quiz of this.quizPackage.config.quizzes ?? []) {
      const pool = poolForGame(this.effectiveQuestions, {
        audience: quiz.audienceId,
        ...(quiz.poolIds === undefined ? {} : { poolIds: quiz.poolIds }),
      })
      if (pool.length === 0) unavailable[quiz.id] = 'no-questions'
    }
    /*
     * Counted once, not per projection: the answer only changes with the
     * question set, and a view is built for every command.
     */
    this.availability = unavailable
    return unavailable
  }

  /**
   * Builds the port for the engine.
   *
   * The usage history is handed in fresh per command, so that a usage just
   * booked flows into the next selection immediately.
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

      /*
       * THE CHECK LIVES IN `resolveQuizMode` and not here: it also applies to
       * the content validation, and two versions of it drifted apart. This port
       * only passes the configuration in.
       */
      quizFor: (quizId) => resolveQuizMode(config, quizId),

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
          // The visible order is shuffled per game; the evaluation always
          // compares against `correctOptionId`.
          optionOrder: shuffleOptionOrder(result.question, rng),
        }
        return { ok: true, runtimeQuestion, rationale: result.rationale.text }
      },
    }
  }
}

/**
 * History by repetition key. Questions of the same repetition group share one
 * entry, so that variants are treated as the same question.
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
