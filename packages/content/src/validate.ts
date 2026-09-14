/**
 * Strict content validation (specification 24.4 and 17.5).
 *
 * Two levels:
 *  - `error`   -> the build must abort. These cases would endanger the show.
 *  - `warning` -> conscious editorial approval needed, the build continues.
 *
 * A selection algorithm cannot hide an insufficient pool. That is why the
 * validation additionally computes, per audience, preset and question slot,
 * how many candidates exist and how many games without repetition are
 * possible. The calculation runs over the UNFILTERED base set of the audience:
 * a pool restriction is a conscious choice at runtime, and the engine rejects
 * a too thin cut comprehensibly at start - the build does not have to
 * anticipate that.
 */
import {
  contentThresholds,
  isSelfServicePreset,
  presentationNeedsImage,
  presentationNeedsOptions,
  questionSchema,
  quizConfigSchema,
  type MediaAsset,
  type Question,
  type QuizConfig,
} from '@hfroemmel/quiz-core'
import { matchesSlot, poolForGame, repetitionKey } from '@hfroemmel/quiz-core'

export type IssueSeverity = 'error' | 'warning'

export interface ValidationIssue {
  severity: IssueSeverity
  code: string
  message: string
  /** Question id or row reference so that editors can find the spot. */
  subject?: string
}

export interface SlotCoverage {
  audience: string
  presetId: string
  slotIndex: number
  slotId: string
  candidateCount: number
  repetitionGroupCount: number
  /** Question slots of the same preset that compete for the same pool. */
  competingSlotIds: string[]
}

export interface PresetCoverage {
  audience: string
  presetId: string
  slots: SlotCoverage[]
  /** How many games are possible without repetition? Minimum over all pool groups. */
  gamesWithoutRepetition: number
  /**
   * Is this preset suitable for the touch device? Only if every question slot
   * exclusively admits questions that can be evaluated without an operator.
   */
  selfServiceCapable: boolean
}

export interface ContentStatistics {
  totalQuestions: number
  enabledQuestions: number
  byAudience: Record<string, number>
  byPool: Record<string, number>
  byDifficulty: Record<string, number>
  byQuestionType: Record<string, number>
  byCategory: Record<string, number>
  repetitionGroups: number
  mediaAssets: number
}

export interface ValidationResult {
  issues: ValidationIssue[]
  errors: ValidationIssue[]
  warnings: ValidationIssue[]
  statistics: ContentStatistics
  coverage: PresetCoverage[]
  ok: boolean
}

export interface ValidationInput {
  config: unknown
  questions: unknown
  assets: MediaAsset[]
  /** Does the asset's file exist? Wired to the file system by the CLI. */
  assetFileExists: (asset: MediaAsset) => boolean
  contentVersion?: string
  /**
   * During development the approved image set is not available yet. With
   * `'warning'` a missing media file does not block the build; the server
   * shows a generated placeholder image in its place.
   *
   * For live operation the default `'error'` remains binding: a question
   * without an image is unplayable on stage.
   */
  missingMediaSeverity?: IssueSeverity
}

export function validateContent(input: ValidationInput): ValidationResult {
  const issues: ValidationIssue[] = []
  const add = (severity: IssueSeverity, code: string, message: string, subject?: string) =>
    issues.push({ severity, code, message, subject })

  /* -------- Schema check -------- */

  const configResult = quizConfigSchema.safeParse(input.config)
  if (!configResult.success) {
    for (const issue of configResult.error.issues) {
      add('error', 'config-schema', `Konfiguration ungueltig bei "${issue.path.join('.')}": ${issue.message}`)
    }
    return finish(issues, emptyStatistics(), [])
  }
  const config = configResult.data

  if (!Array.isArray(input.questions)) {
    add('error', 'questions-schema', 'Die Fragendatei enthaelt kein Array.')
    return finish(issues, emptyStatistics(), [])
  }

  const questions: Question[] = []
  input.questions.forEach((raw, index) => {
    const parsed = questionSchema.safeParse(raw)
    if (!parsed.success) {
      const id = typeof (raw as { id?: unknown })?.id === 'string' ? (raw as { id: string }).id : `Index ${index}`
      for (const issue of parsed.error.issues) {
        add('error', 'question-schema', `Feld "${issue.path.join('.')}": ${issue.message}`, id)
      }
      return
    }
    questions.push(parsed.data)
  })

  if (input.contentVersion !== undefined && !/^\d+\.\d+\.\d+(?:[-+].+)?$/.test(input.contentVersion)) {
    add('error', 'version-unparsable', `Inhaltsversion "${input.contentVersion}" ist keine gueltige Versionsangabe.`)
  }

  /* -------- References and required fields -------- */

  const knownDifficulties = new Set(config.difficulties.map((entry) => entry.id))
  const knownCategories = new Set(config.categories.map((entry) => entry.id))
  const knownAudiences = new Set(config.audiences.map((entry) => entry.id))
  const knownPools = new Set(config.pools.map((entry) => entry.id))
  const knownThemes = new Set(config.themes.map((entry) => entry.id))
  const knownPresets = new Set(config.presets.map((entry) => entry.id))
  const assetsById = new Map(input.assets.map((asset) => [asset.id, asset]))

  for (const audienceConfig of config.audiences) {
    if (!knownThemes.has(audienceConfig.themeId)) {
      add('error', 'theme-reference', `Zielgruppe "${audienceConfig.id}" verweist auf unbekanntes Theme "${audienceConfig.themeId}".`, audienceConfig.id)
    }
    for (const presetId of audienceConfig.allowedPresetIds) {
      if (!knownPresets.has(presetId)) {
        add('error', 'preset-reference', `Zielgruppe "${audienceConfig.id}" erlaubt unbekanntes Preset "${presetId}".`, audienceConfig.id)
      }
    }
    if (audienceConfig.startVisualAssetId && !assetsById.has(audienceConfig.startVisualAssetId)) {
      add('error', 'asset-reference', `Startgrafik "${audienceConfig.startVisualAssetId}" von Zielgruppe "${audienceConfig.id}" fehlt.`, audienceConfig.id)
    }
  }
  /* -------- Quiz modes -------- */

  /*
   * A QUIZ MODE IS ONLY AS GOOD AS ITS FOUR REFERENCES. It names audience,
   * theme, pools and difficulty levels; if one of them points nowhere, the
   * server rejects the start in the evening - and that should be noticed
   * here, not there.
   */
  const quizIds = new Set<string>()
  for (const quiz of config.quizzes ?? []) {
    if (quizIds.has(quiz.id)) {
      add('error', 'quiz-duplicate', `Die Quizart "${quiz.id}" ist mehrfach konfiguriert.`, quiz.id)
    }
    quizIds.add(quiz.id)

    const audienceConfig = config.audiences.find((entry) => entry.id === quiz.audienceId)
    if (!audienceConfig) {
      add('error', 'audience-reference', `Quizart "${quiz.id}" verweist auf unbekannte Zielgruppe "${quiz.audienceId}".`, quiz.id)
    }
    if (!knownThemes.has(quiz.themeId)) {
      add('error', 'theme-reference', `Quizart "${quiz.id}" verweist auf unbekanntes Theme "${quiz.themeId}".`, quiz.id)
    }
    for (const poolId of quiz.poolIds ?? []) {
      if (!knownPools.has(poolId)) {
        add('error', 'pool-reference', `Quizart "${quiz.id}" verweist auf unbekannten Fragenpool "${poolId}".`, quiz.id)
      }
    }
    for (const presetId of quiz.presetIds) {
      if (!knownPresets.has(presetId)) {
        add('error', 'preset-reference', `Quizart "${quiz.id}" nennt unbekanntes Preset "${presetId}".`, quiz.id)
      } else if (audienceConfig && !audienceConfig.allowedPresetIds.includes(presetId)) {
        add(
          'error',
          'preset-reference',
          `Quizart "${quiz.id}" nennt Preset "${presetId}", das der Zielgruppe "${audienceConfig.id}" nicht offensteht.`,
          quiz.id,
        )
      }
    }
    if (quiz.defaultPresetId && !quiz.presetIds.includes(quiz.defaultPresetId)) {
      add(
        'error',
        'preset-reference',
        `Die Voreinstellung "${quiz.defaultPresetId}" der Quizart "${quiz.id}" steht nicht in ihren Schwierigkeitsgraden.`,
        quiz.id,
      )
    }
    /*
     * The artwork of the card is a reference like every other: a card whose
     * motif is missing stands in the menu as an empty area, and nobody sees in
     * the evening whether that was meant to be.
     */
    if (quiz.artworkAssetId && !assetsById.has(quiz.artworkAssetId)) {
      add(
        'error',
        'asset-reference',
        `Kartengrafik "${quiz.artworkAssetId}" der Quizart "${quiz.id}" fehlt.`,
        quiz.id,
      )
    }
    /*
     * A quiz that offers a player count twice would show the same card twice.
     * The schema keeps the values, the duplicate is a content question.
     */
    const counts = quiz.playerCounts ?? []
    if (counts.length !== new Set(counts).size) {
      add('warning', 'quiz-player-counts', `Die Quizart "${quiz.id}" nennt eine Spielerzahl mehrfach.`, quiz.id)
    }
  }

  /*
   * TWO QUIZZES IN THE SAME PLACE are not an error - the menu keeps the order
   * of the configuration for them - but they are a decision nobody made on
   * purpose, so it is reported.
   */
  const orders = (config.quizzes ?? []).map((quiz) => quiz.order).filter((order) => order !== undefined)
  if (orders.length !== new Set(orders).size) {
    add('warning', 'quiz-order', 'Zwei Quizarten stehen auf derselben Menueposition.')
  }

  /* -------- Locales -------- */

  const knownLocales = new Set((config.locales ?? []).map((locale) => locale.id))
  const checkLocales = (
    entries: Record<string, unknown> | undefined,
    art: string,
    subject: string,
  ): void => {
    for (const locale of Object.keys(entries ?? {})) {
      if (knownLocales.size > 0 && !knownLocales.has(locale)) {
        /*
         * WARNING AND NOT AN ERROR: A translation for a locale nobody can
         * choose is dead work - but it breaks nothing. The pool should not
         * become unbuildable because of it; it still has to be reported,
         * otherwise someone keeps translating into the void.
         */
        add('warning', 'locale-unknown', `${art} in nicht konfigurierter Sprache "${locale}".`, subject)
      }
    }
  }

  for (const entry of [...config.categories, ...config.difficulties, ...config.pools, ...config.presets]) {
    checkLocales(entry.labels, 'Beschriftung', entry.id)
  }
  for (const audienceConfig of config.audiences) {
    checkLocales(audienceConfig.labels, 'Beschriftung', audienceConfig.id)
    checkLocales(audienceConfig.startTitles, 'Startbild-Titel', audienceConfig.id)
  }
  checkLocales(config.interfaceStrings, 'Oberflaechentexte', 'config')

  for (const theme of config.themes) {
    if (theme.logoAssetId && !assetsById.has(theme.logoAssetId)) {
      add('error', 'asset-reference', `Logo "${theme.logoAssetId}" von Theme "${theme.id}" fehlt.`, theme.id)
    }
  }
  for (const preset of config.presets) {
    if (preset.slots.length !== config.questionsPerGame) {
      add(
        'error',
        'preset-slot-count',
        `Preset "${preset.id}" hat ${preset.slots.length} Fragenplaetze, konfiguriert sind ${config.questionsPerGame}.`,
        preset.id,
      )
    }
    for (const slot of preset.slots) {
      for (const difficultyId of slot.filters.difficultyIds ?? []) {
        if (!knownDifficulties.has(difficultyId)) {
          add('error', 'difficulty-reference', `Fragenplatz "${slot.id}" filtert auf unbekannte Schwierigkeit "${difficultyId}".`, preset.id)
        }
      }
      for (const categoryId of slot.filters.categoryIds ?? []) {
        if (!knownCategories.has(categoryId)) {
          add('error', 'category-reference', `Fragenplatz "${slot.id}" filtert auf unbekannte Kategorie "${categoryId}".`, preset.id)
        }
      }
    }
  }

  const seenIds = new Set<string>()
  for (const question of questions) {
    if (seenIds.has(question.id)) {
      add('error', 'duplicate-question-id', `Die Frage-ID "${question.id}" kommt mehrfach vor.`, question.id)
    }
    seenIds.add(question.id)

    if (!knownDifficulties.has(question.difficulty)) {
      add('error', 'difficulty-reference', `Unbekannte Schwierigkeit "${question.difficulty}".`, question.id)
    }

    checkLocales(question.translations, 'Uebersetzung', question.id)
    for (const [locale, translation] of Object.entries(question.translations ?? {})) {
      /*
       * A TRANSLATION MUST NOT SHIFT THE SCORING. Options are replaced one by
       * one by identifier; if there is an identifier the original does not
       * know, the text silently falls through - and in the worst case exactly
       * the option that is compared against is missing.
       */
      for (const option of translation.options ?? []) {
        if (!question.options?.some((entry) => entry.id === option.id)) {
          add(
            'error',
            'translation-option',
            `Uebersetzung "${locale}" nennt die Option "${option.id}", die es im Original nicht gibt.`,
            question.id,
          )
        }
      }
      for (const assetId of [translation.media?.imageAssetId, translation.media?.videoAssetId]) {
        if (assetId && !assetsById.has(assetId)) {
          add(
            'error',
            'asset-reference',
            `Uebersetzung "${locale}" verweist auf fehlendes Medium "${assetId}".`,
            question.id,
          )
        }
      }
    }
    for (const categoryId of question.categories) {
      if (!knownCategories.has(categoryId)) {
        add('error', 'category-reference', `Unbekannte Kategorie "${categoryId}".`, question.id)
      }
    }
    for (const audienceId of question.audiences) {
      if (!knownAudiences.has(audienceId)) {
        add('error', 'audience-reference', `Unbekannte Zielgruppe "${audienceId}".`, question.id)
      }
    }
    for (const poolId of question.poolIds) {
      if (!knownPools.has(poolId)) {
        add('error', 'pool-reference', `Unbekannter Fragenpool "${poolId}".`, question.id)
      }
    }

    validateAnswerModel(question, add)
    validateMedia(question, assetsById, input.assetFileExists, input.missingMediaSeverity ?? 'error', add)
    validateEditorialWarnings(question, assetsById, add)

    if (question.id !== question.id.toLowerCase()) {
      add('warning', 'id-casing', `Die ID "${question.id}" enthaelt Grossbuchstaben.`, question.id)
    }
  }

  /* -------- Duplicate detection without a shared repetition group -------- */

  const byNormalizedPrompt = new Map<string, Question[]>()
  for (const question of questions) {
    const key = normalizeText(question.prompt)
    const bucket = byNormalizedPrompt.get(key) ?? []
    bucket.push(question)
    byNormalizedPrompt.set(key, bucket)
  }
  for (const [, bucket] of byNormalizedPrompt) {
    if (bucket.length < 2) continue
    const groups = new Set(bucket.map(repetitionKey))
    if (groups.size > 1) {
      add(
        'warning',
        'similar-without-group',
        `Fast identischer Fragetext ohne gemeinsame Wiederholungsgruppe: ${bucket.map((q) => q.id).join(', ')}.`,
        bucket[0]!.id,
      )
    }
  }

  /* -------- Reachability, pool coverage, orphaned media -------- */

  const coverage = analyseCoverage(config, questions, add)

  const reachable = new Set<string>()
  for (const audienceConfig of config.audiences) {
    const pool = poolForGame(questions, { audience: audienceConfig.id })
    for (const presetId of audienceConfig.allowedPresetIds) {
      const preset = config.presets.find((entry) => entry.id === presetId)
      if (!preset) continue
      for (const slot of preset.slots) {
        for (const question of pool) {
          if (matchesSlot(question, slot)) reachable.add(question.id)
        }
      }
    }
  }
  for (const question of questions) {
    if (question.enabled && !reachable.has(question.id)) {
      add('warning', 'unreachable-question', 'Die Frage ist ueber keine Zielgruppe und kein Preset erreichbar.', question.id)
    }
  }

  const usedAssetIds = new Set<string>()
  for (const question of questions) {
    if (question.media?.imageAssetId) usedAssetIds.add(question.media.imageAssetId)
    if (question.media?.videoAssetId) usedAssetIds.add(question.media.videoAssetId)
  }
  for (const theme of config.themes) if (theme.logoAssetId) usedAssetIds.add(theme.logoAssetId)
  for (const audienceConfig of config.audiences) if (audienceConfig.startVisualAssetId) usedAssetIds.add(audienceConfig.startVisualAssetId)
  for (const quiz of config.quizzes ?? []) if (quiz.artworkAssetId) usedAssetIds.add(quiz.artworkAssetId)
  for (const asset of input.assets) {
    if (!usedAssetIds.has(asset.id)) {
      add('warning', 'orphan-asset', `Das Medium "${asset.id}" (${asset.filename}) wird nirgends verwendet.`, asset.id)
    }
  }

  const usedCategories = new Set(questions.flatMap((question) => question.categories))
  for (const category of config.categories) {
    if (!usedCategories.has(category.id)) {
      add('warning', 'unused-category', `Die Kategorie "${category.id}" wird von keiner Frage verwendet.`, category.id)
    }
  }
  const usedPools = new Set(questions.flatMap((question) => question.poolIds))
  for (const pool of config.pools) {
    if (!usedPools.has(pool.id)) {
      add('warning', 'unused-pool', `Der Fragenpool "${pool.id}" wird von keiner Frage verwendet.`, pool.id)
    }
  }

  return finish(issues, buildStatistics(questions, input.assets), coverage)
}

/* ------------------------------------------------------------------ *
 * Partial checks
 * ------------------------------------------------------------------ */

type AddIssue = (severity: IssueSeverity, code: string, message: string, subject?: string) => void

function validateAnswerModel(question: Question, add: AddIssue): void {
  const options = question.options ?? []
  const isChoiceType = presentationNeedsOptions(question.questionType)

  /*
   * A disabled question is in no question pool and cannot endanger the show.
   * It may therefore stay in the pool as an unfinished template - just like a
   * prepared medium without a file. The defect is reported but does not block
   * the build.
   */
  const structural: IssueSeverity = question.enabled ? 'error' : 'warning'
  const draftHint = question.enabled ? '' : ' Die Frage ist deaktiviert und wird nicht gespielt.'

  if (question.evaluationMode === 'option-comparison') {
    if (options.length === 0) {
      add(structural, 'missing-options', `Automatische Auswertung ohne Antwortoptionen.${draftHint}`, question.id)
    }
    if (!question.correctOptionId) {
      // The legacy assumption "option_1 is correct" no longer applies.
      add(structural, 'missing-correct-option', `Multiple Choice ohne explizite richtige Option.${draftHint}`, question.id)
    } else if (!options.some((option) => option.id === question.correctOptionId)) {
      add(
        structural,
        'correct-option-unknown',
        `"correctOptionId" verweist auf "${question.correctOptionId}", diese Option existiert nicht.${draftHint}`,
        question.id,
      )
    }
  } else if (!question.acceptedAnswerText?.length && !question.correctOptionId) {
    add(
      structural,
      'missing-answer',
      `Manuelle Bewertung ohne hinterlegte richtige Antwort - die Loesungsansicht waere leer.${draftHint}`,
      question.id,
    )
  }

  /*
   * Three options instead of four are allowed - the bars share the width
   * anyway. Below two options there is nothing to choose, above four the
   * letter is missing in the design.
   */
  if (isChoiceType && options.length < contentThresholds.minChoiceOptionCount) {
    add(
      structural,
      'option-count',
      `Fragetyp "${question.questionType}" braucht mindestens ${contentThresholds.minChoiceOptionCount} Antwortoptionen, gefunden: ${options.length}. ` +
        `Mit weniger ist es keine Auswahlfrage - dann gehoert die Loesung nach "acceptedAnswerText".${draftHint}`,
      question.id,
    )
  }
  if (isChoiceType && options.length > contentThresholds.maxChoiceOptionCount) {
    add(
      structural,
      'option-count',
      `Fragetyp "${question.questionType}" erlaubt hoechstens ${contentThresholds.maxChoiceOptionCount} Antwortoptionen, gefunden: ${options.length}.${draftHint}`,
      question.id,
    )
  }

  const optionIds = new Set<string>()
  const optionTexts = new Set<string>()
  for (const option of options) {
    if (optionIds.has(option.id)) {
      add('error', 'duplicate-option-id', `Die Options-ID "${option.id}" kommt mehrfach vor.`, question.id)
    }
    optionIds.add(option.id)
    const normalized = normalizeText(option.text)
    if (optionTexts.has(normalized)) {
      add('warning', 'duplicate-option-text', `Zwei Antwortoptionen sind identisch: "${option.text}".`, question.id)
    }
    optionTexts.add(normalized)
  }
}

function validateMedia(
  question: Question,
  assetsById: Map<string, MediaAsset>,
  assetFileExists: (asset: MediaAsset) => boolean,
  missingMediaSeverity: IssueSeverity,
  add: AddIssue,
): void {
  const requiresImage = presentationNeedsImage(question.questionType)
  const requiresVideo = question.questionType === 'video-then-question'

  const check = (assetId: string | undefined, kind: 'image' | 'video', required: boolean) => {
    if (!assetId) {
      if (required) {
        add('error', 'missing-media', `Fragetyp "${question.questionType}" verlangt ein Medium (${kind}).`, question.id)
      }
      return
    }
    const asset = assetsById.get(assetId)
    if (!asset) {
      add('error', 'asset-reference', `Unbekanntes Medium "${assetId}".`, question.id)
      return
    }
    if (asset.kind !== kind) {
      add('error', 'asset-kind', `Medium "${assetId}" ist vom Typ "${asset.kind}", erwartet wurde "${kind}".`, question.id)
    }
    if (!assetFileExists(asset)) {
      // A disabled question is in no pool and cannot endanger the show.
      // It may therefore stay in the pool as a prepared template without a media file.
      if (question.enabled) {
        add(
          missingMediaSeverity,
          'asset-file-missing',
          missingMediaSeverity === 'error'
            ? `Mediendatei "${asset.filename}" existiert nicht.`
            : `Mediendatei "${asset.filename}" fehlt. Es wird ein Ersatzbild gezeigt.`,
          question.id,
        )
      } else {
        add(
          'warning',
          'asset-file-missing-disabled',
          `Mediendatei "${asset.filename}" fehlt. Die Frage ist deaktiviert und wird nicht gespielt.`,
          question.id,
        )
      }
    }
  }

  check(question.media?.imageAssetId, 'image', requiresImage)
  check(question.media?.videoAssetId, 'video', requiresVideo)
}

function validateEditorialWarnings(question: Question, assetsById: Map<string, MediaAsset>, add: AddIssue): void {
  if (!question.explanation?.summary && !question.explanation?.details) {
    add('warning', 'missing-explanation', 'Kein Erklaerungstext hinterlegt.', question.id)
  }
  const imageId = question.media?.imageAssetId
  if (imageId) {
    const asset = assetsById.get(imageId)
    if (asset && !asset.credit) {
      add('warning', 'missing-credit', `Kein Bildnachweis fuer "${imageId}".`, question.id)
    }
  }
  if (question.prompt.length > contentThresholds.longPromptChars) {
    add('warning', 'long-prompt', `Sehr langer Fragetext (${question.prompt.length} Zeichen).`, question.id)
  }
  for (const option of question.options ?? []) {
    if (option.text.length > contentThresholds.longOptionChars) {
      add('warning', 'long-option', `Sehr langer Antworttext (${option.text.length} Zeichen).`, question.id)
    }
  }
}

/**
 * Pool coverage per audience, preset and question slot.
 *
 * "Games without repetition" is estimated conservatively: question slots with
 * an identical filter compete for the same pool. For such a group of `k`
 * slots and `g` distinct repetition groups, `floor(g / k)` games are possible;
 * the minimum over all groups is what counts.
 */
function analyseCoverage(config: QuizConfig, questions: Question[], add: AddIssue): PresetCoverage[] {
  const coverage: PresetCoverage[] = []

  for (const audienceConfig of config.audiences) {
    const pool = poolForGame(questions, { audience: audienceConfig.id })
    for (const presetId of audienceConfig.allowedPresetIds) {
      const preset = config.presets.find((entry) => entry.id === presetId)
      if (!preset) continue

      // Question slots with an identical filter share one pool.
      const signatureToSlotIds = new Map<string, string[]>()
      for (const slot of preset.slots) {
        const signature = JSON.stringify(slot.filters)
        signatureToSlotIds.set(signature, [...(signatureToSlotIds.get(signature) ?? []), slot.id])
      }

      const slots: SlotCoverage[] = preset.slots.map((slot, slotIndex) => {
        const candidates = pool.filter((question) => matchesSlot(question, slot))
        const groups = new Set(candidates.map(repetitionKey))
        const signature = JSON.stringify(slot.filters)
        const competing = (signatureToSlotIds.get(signature) ?? []).filter((id) => id !== slot.id)

        if (candidates.length === 0) {
          // An unsatisfiable question slot is a hard error.
          add(
            'error',
            'slot-unsatisfiable',
            `Zielgruppe "${audienceConfig.id}" / Preset "${preset.id}": Fragenplatz ${slotIndex + 1} ("${slot.id}") hat keinen einzigen Kandidaten.`,
            `${audienceConfig.id}/${preset.id}/${slot.id}`,
          )
        } else if (candidates.length < contentThresholds.smallPoolWarning) {
          add(
            'warning',
            'small-pool',
            `Zielgruppe "${audienceConfig.id}" / Preset "${preset.id}": Fragenplatz ${slotIndex + 1} ("${slot.id}") hat nur ${candidates.length} Kandidaten.`,
            `${audienceConfig.id}/${preset.id}/${slot.id}`,
          )
        }

        return {
          audience: audienceConfig.id,
          presetId: preset.id,
          slotIndex,
          slotId: slot.id,
          candidateCount: candidates.length,
          repetitionGroupCount: groups.size,
          competingSlotIds: competing,
        }
      })

      let gamesWithoutRepetition = Number.POSITIVE_INFINITY
      for (const [signature, slotIds] of signatureToSlotIds) {
        const filters = JSON.parse(signature) as (typeof preset.slots)[number]['filters']
        const candidates = pool.filter((question) => matchesSlot(question, { id: 'tmp', filters }))
        const groups = new Set(candidates.map(repetitionKey)).size
        gamesWithoutRepetition = Math.min(gamesWithoutRepetition, Math.floor(groups / slotIds.length))
      }
      if (!Number.isFinite(gamesWithoutRepetition)) gamesWithoutRepetition = 0

      if (gamesWithoutRepetition < contentThresholds.minGamesWithoutRepetition) {
        add(
          'warning',
          'few-games-without-repetition',
          `Zielgruppe "${audienceConfig.id}" / Preset "${preset.id}": nur ${gamesWithoutRepetition} Spiele ohne Wiederholung moeglich.`,
          `${audienceConfig.id}/${preset.id}`,
        )
      }

      coverage.push({
        audience: audienceConfig.id,
        presetId: preset.id,
        slots,
        gamesWithoutRepetition,
        selfServiceCapable: isSelfServicePreset(preset),
      })
    }
  }

  return coverage
}

/* ------------------------------------------------------------------ *
 * Helpers
 * ------------------------------------------------------------------ */

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[\s]+/g, ' ')
    .replace(/[.,;:!?"'`´()\[\]-]/g, '')
    .trim()
}

function buildStatistics(questions: Question[], assets: MediaAsset[]): ContentStatistics {
  const count = (values: string[]) => {
    const result: Record<string, number> = {}
    for (const value of values) result[value] = (result[value] ?? 0) + 1
    return result
  }
  return {
    totalQuestions: questions.length,
    enabledQuestions: questions.filter((question) => question.enabled).length,
    byAudience: count(questions.flatMap((question) => question.audiences)),
    byPool: count(questions.flatMap((question) => question.poolIds)),
    byDifficulty: count(questions.map((question) => question.difficulty)),
    byQuestionType: count(questions.map((question) => question.questionType)),
    byCategory: count(questions.flatMap((question) => question.categories)),
    repetitionGroups: new Set(questions.map(repetitionKey)).size,
    mediaAssets: assets.length,
  }
}

function emptyStatistics(): ContentStatistics {
  return {
    totalQuestions: 0,
    enabledQuestions: 0,
    byAudience: {},
    byPool: {},
    byDifficulty: {},
    byQuestionType: {},
    byCategory: {},
    repetitionGroups: 0,
    mediaAssets: 0,
  }
}

function finish(issues: ValidationIssue[], statistics: ContentStatistics, coverage: PresetCoverage[]): ValidationResult {
  const errors = issues.filter((issue) => issue.severity === 'error')
  const warnings = issues.filter((issue) => issue.severity === 'warning')
  return { issues, errors, warnings, statistics, coverage, ok: errors.length === 0 }
}
