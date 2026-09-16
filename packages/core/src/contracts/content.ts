/**
 * Content model of the quiz (specification sections 16, 15 and 7.2).
 *
 * The most important rules enforced structurally here:
 *  - Presentation type (`presentationType`), evaluation mode (`evaluationMode`)
 *    and medium are modelled separately. The legacy field `type: "image"` is gone.
 *  - The correct answer is always referenced explicitly via `correctOptionId`.
 *    The legacy assumption "option_1 is correct" is abolished.
 *  - Media are referenced by stable asset ids, never by file names.
 *  - Runtime data (such as the legacy field `playCount`) do not belong in the content.
 */
import { z } from 'zod'
import { contentThresholds, rulesConfigSchema } from './config'
import { playerCountSchema, playerCounts, type PlayerCount } from './state'

/**
 * Presentation type of a question on the stage screen.
 *
 * `person` is a choice question with an image like `image-choice` - it differs
 * only in composition: the portrait carries the view and stands large on the
 * left, question and answers stand next to it. The rules treat it the same.
 */
export const questionPresentationTypes = [
  'text-choice',
  'image-choice',
  'person',
  'image-reveal',
  'video-then-question',
] as const
export type QuestionPresentationType = (typeof questionPresentationTypes)[number]

/**
 * Does this question type need answer options?
 *
 * THE ONLY SOURCE OF THIS DECISION - validation and content maintenance ask
 * here. Whoever adds a type has to sort it in here; a forgotten enumeration
 * elsewhere would otherwise only show up in operation.
 */
export function presentationNeedsOptions(type: QuestionPresentationType): boolean {
  return type === 'text-choice' || type === 'image-choice' || type === 'person'
}

/** Does this question type need an image? */
export function presentationNeedsImage(type: QuestionPresentationType): boolean {
  return type === 'image-choice' || type === 'person' || type === 'image-reveal'
}

/** How an attempt is evaluated. */
export const evaluationModes = ['option-comparison', 'manual-correct-incorrect'] as const
export type EvaluationMode = (typeof evaluationModes)[number]

/** Identifier: lower case, so that ids do not fall apart over capitalisation. */
const idSchema = z
  .string()
  .min(1)
  .regex(/^[a-z0-9][a-z0-9._-]*$/, 'ID darf nur a-z, 0-9, Punkt, Bindestrich und Unterstrich enthalten')

export const answerOptionSchema = z.object({
  id: idSchema,
  text: z.string().min(1),
})
export type AnswerOption = z.infer<typeof answerOptionSchema>

export const questionExplanationSchema = z.object({
  /** Short version for moderator and operator. */
  summary: z.string().optional(),
  /** Detailed background. */
  details: z.string().optional(),
  /** Source reference (editorial, not public by default). */
  source: z.string().optional(),
  /** Directing notes: only for moderator and operator. */
  moderatorNotes: z.string().optional(),
})
export type QuestionExplanation = z.infer<typeof questionExplanationSchema>

export const questionMediaSchema = z.object({
  imageAssetId: idSchema.optional(),
  videoAssetId: idSchema.optional(),
})
export type QuestionMedia = z.infer<typeof questionMediaSchema>

/* ------------------------------------------------------------------ *
 * Multiple languages
 *
 * A QUESTION STAYS ONE QUESTION, even in five languages. Translations therefore
 * hang ON the question and do not stand next to it as a second corpus: the
 * selection (repetition avoidance, slots, pools) keeps working with exactly one
 * set, and switching the language can never yield a different question. What is
 * missing falls back to the base locale - a half-translated table is better
 * than an empty screen.
 * ------------------------------------------------------------------ */

/** Label per locale. If one is missing, the `label` next to it applies. */
export const translatedLabels = z.record(z.string().min(1), z.string().min(1))

/**
 * A locale the quiz can be played in.
 *
 * `label` is deliberately written IN THAT locale ("Deutsch", "English") and not
 * in the language of the interface: whoever looks for a language looks for its
 * own name.
 */
export const localeSchema = z.object({
  id: z.string().min(2),
  label: z.string().min(1),
})
export type QuizLocale = z.infer<typeof localeSchema>

/**
 * The translatable part of a question.
 *
 * The options carry the same ids as the original - scoring compares against
 * `correctOptionId`, and a translation must not shift the scoring. The medium
 * may differ: an image with a German caption is a different image in another
 * language.
 */
export const questionTranslationSchema = z.object({
  prompt: z.string().min(1).optional(),
  options: z.array(answerOptionSchema).optional(),
  acceptedAnswerText: z.array(z.string().min(1)).optional(),
  explanation: questionExplanationSchema.optional(),
  media: z
    .object({
      imageAssetId: idSchema.optional(),
      videoAssetId: idSchema.optional(),
    })
    .optional(),
})
export type QuestionTranslation = z.infer<typeof questionTranslationSchema>

export const questionSchema = z.object({
  id: idSchema,
  /**
   * Variants with the same content share a `repetitionGroupId`.
   * Repetition avoidance treats the whole group as a single question.
   */
  repetitionGroupId: idSchema.optional(),
  /**
   * Question pools the question belongs to (schema v2). A pool is a CONTENT
   * SELECTION - "Saarbruecken" is exactly that: a pool, not a mode and not a
   * category. Which pools a game draws from is decided by `START_GAME`.
   */
  poolIds: z.array(idSchema).min(1),
  /** Audiences the question suits (formerly `modeIds`). */
  audiences: z.array(idSchema).min(1),
  difficulty: idSchema,
  categories: z.array(idSchema),
  tags: z.array(idSchema),
  /** BCP-47 locale of the question content, e.g. `de-DE`. */
  locale: z.string().min(2),

  prompt: z.string().min(1),
  questionType: z.enum(questionPresentationTypes),
  evaluationMode: z.enum(evaluationModes),

  options: z.array(answerOptionSchema).optional(),
  correctOptionId: idSchema.optional(),
  /** For oral answers: expected wordings as help for the moderator. */
  acceptedAnswerText: z.array(z.string().min(1)).optional(),

  media: questionMediaSchema.optional(),
  explanation: questionExplanationSchema.optional(),
  /** Versions in other locales, by locale tag. Anything missing falls back. */
  translations: z.record(z.string().min(2), questionTranslationSchema).optional(),
  enabled: z.boolean(),
})
export type Question = z.infer<typeof questionSchema>

/**
 * Is the question a real choice question?
 *
 * THE ONLY SOURCE OF THIS DECISION. Validation, engine, command availability and
 * projection ask here - and only here - whether answer rows, letter keys and the
 * automatic comparison against `correctOptionId` make sense at all.
 *
 * Questions with fewer than two options are not a choice: a single option would
 * be the solution itself. They therefore run everywhere as a free answer - the
 * room sees no one-row choice, and the operator evaluates by hand.
 */
export function isChoiceQuestion(question: Pick<Question, 'options'>): boolean {
  return (question.options?.length ?? 0) >= contentThresholds.minChoiceOptionCount
}

/**
 * Can this question be answered without an operator?
 *
 * Only real choice questions that are compared against `correctOptionId`. An
 * oral answer needs someone to evaluate it - in the kiosk there is nobody. The
 * rule lives here because both the content validation and the state machine
 * need it, so it may exist exactly once.
 *
 * THE NUMBER OF OPTIONS IS DECIDED BY `isChoiceQuestion` and nobody else. A
 * lower bound of its own here would be a second rule: it once let a question
 * with a single option through, and the device then showed one row that was
 * also the solution - unplayable, but drawn.
 */
export function isSelfServiceAnswerable(question: Question): boolean {
  return question.evaluationMode === 'option-comparison' && isChoiceQuestion(question)
}

export const mediaAssetSchema = z.object({
  id: idSchema,
  kind: z.enum(['image', 'video', 'audio']),
  /** Path relative to the asset root of the package. Never absolute, never with "..". */
  filename: z
    .string()
    .min(1)
    .refine((value) => !value.startsWith('/') && !value.includes('..') && !/^[a-zA-Z]:/.test(value), {
      message: 'Asset-Pfade muessen relativ sein und duerfen kein ".." enthalten',
    }),
  mimeType: z.string().min(1),
  credit: z.string().optional(),
  sourceUrl: z.string().optional(),
  checksum: z.string().optional(),
})
export type MediaAsset = z.infer<typeof mediaAssetSchema>

/* ------------------------------------------------------------------ *
 * Configuration: modes, themes, difficulty presets, question slots
 * ------------------------------------------------------------------ */

export const questionSlotRuleSchema = z.object({
  id: idSchema,
  /** Free label for the operator diagnostics and the validation report. */
  label: z.string().optional(),
  /**
   * Missing filters mean "any". A special value such as the string `random` is
   * therefore deliberately unnecessary.
   */
  filters: z
    .object({
      difficultyIds: z.array(idSchema).optional(),
      questionTypes: z.array(z.enum(questionPresentationTypes)).optional(),
      /**
       * Evaluation mode. A slot for the touch device filters on
       * `option-comparison`: nobody there could resolve a question that has to
       * be evaluated orally.
       */
      evaluationModes: z.array(z.enum(evaluationModes)).optional(),
      categoryIds: z.array(idSchema).optional(),
      tags: z.array(idSchema).optional(),
    })
    .default({}),
})
export type QuestionSlotRule = z.infer<typeof questionSlotRuleSchema>

/**
 * Is this preset fit for self-service at the touch device?
 *
 * Only if EVERY slot admits evaluable questions exclusively. This is derived
 * from the filters and not declared additionally: a second statement could
 * differ from the filters, and then it would be unclear which one applies.
 */
export function isSelfServicePreset(preset: DifficultyPreset): boolean {
  return preset.slots.every(
    (slot) =>
      slot.filters.evaluationModes?.length === 1 && slot.filters.evaluationModes[0] === 'option-comparison',
  )
}

export const difficultyPresetSchema = z.object({
  id: idSchema,
  label: z.string().min(1),
  labels: translatedLabels.optional(),
  /**
   * A preset is a dramaturgical flow configuration, not a global filter.
   * `easy` may therefore contain individual medium slots.
   */
  slots: z.array(questionSlotRuleSchema).min(1),
})
export type DifficultyPreset = z.infer<typeof difficultyPresetSchema>

/**
 * Design world of a theme.
 *
 * `stage` is the dark stage of the adult quiz. `kids` is the illustrated
 * Karlchen world with drawn surfaces.
 *
 * WHY A DATA FIELD: the client must not know mode names. Without this field
 * somewhere `if (theme.id === 'kids')` would have to stand - exactly the mode
 * special-casing the specification rules out. This way the configuration picks
 * the world, and a new mode gets it without a code change.
 */
export const themeSkins = ['default', 'kids'] as const
export type ThemeSkin = (typeof themeSkins)[number]

/**
 * Since schema v2 the quiz package carries NO colours and fonts any more -
 * presentation is the host's concern (`quiz-themes`). A theme names only its
 * design world and its branding assets.
 */
export const quizThemeSchema = z.object({
  id: idSchema,
  label: z.string().min(1),
  /** Design world: `default` or `kids`. If missing, `default` applies. */
  skin: z.enum(themeSkins).optional(),
  logoAssetId: idSchema.optional(),
  presentationAnimationSetId: idSchema.optional(),
})
export type QuizTheme = z.infer<typeof quizThemeSchema>

/**
 * Audience (schema v2, formerly "quiz mode").
 *
 * The old mode conflated three things: audience, question pool and design. Now
 * they are separate - the audience carries the design and the permitted
 * presets, the pools are their own axis of content selection, and the questions
 * name both directly (`audiences`, `poolIds`). "Saarbruecken" therefore needs no
 * special mode any more: it is a pool, selectable for every audience.
 */
export const audienceConfigSchema = z.object({
  id: idSchema,
  label: z.string().min(1),
  themeId: idSchema,
  startVisualAssetId: idSchema.optional(),
  /**
   * Title above the graphic on the start visual. If missing, the start view
   * shows only the graphic - for instance when it already contains the title.
   */
  startTitle: z.string().min(1).optional(),
  /**
   * Two or three lines below the title: what this quiz is about. They are
   * promotional text and not a rule - if missing, the board simply stands
   * without them.
   */
  startDescription: z.string().min(1).optional(),
  labels: translatedLabels.optional(),
  /** Start visual title per locale. */
  startTitles: translatedLabels.optional(),
  /** Start visual description per locale. */
  startDescriptions: translatedLabels.optional(),
  allowedPresetIds: z.array(idSchema).min(1),
})
export type AudienceConfig = z.infer<typeof audienceConfigSchema>

/** A question pool is only an id and a label - the questions name it themselves. */
export const questionPoolSchema = z.object({
  id: idSchema,
  label: z.string().min(1),
  labels: translatedLabels.optional(),
})
export type QuestionPool = z.infer<typeof questionPoolSchema>

/**
 * A QUIZ TYPE - the one offer that is chosen at the desk.
 *
 * Audience, question pool, theme and the difficulty choice have been separate
 * axes since schema v2. A quiz type connects them without merging them: it
 * names each one individually, as a value, right here. "Bremen-Quiz" is thus a
 * line in the configuration and not a condition in the code - whoever moves it
 * changes the line and nothing else.
 *
 * WHY THE THEME IS HERE AND NOT ONLY ON THE AUDIENCE: two quiz types may share
 * an audience and differ in design. The audience keeps its theme for everything
 * that starts without a quiz type (device, kiosk); if a game runs WITH a quiz
 * type, that theme applies. So at any moment there is exactly one mapping, not
 * two competing ones.
 *
 * THE DIFFICULTY CHOICE IS NOT A SWITCH but follows from `presetIds`: a single
 * preset means there is nothing to choose (`quizSupportsDifficulty`). An extra
 * field "supports difficulty" could contradict the list, and then it would be
 * unclear which one applies.
 */
export const quizModeSchema = z.object({
  id: idSchema,
  label: z.string().min(1),
  labels: translatedLabels.optional(),
  /** Second line of the offer card - what this quiz is about. */
  subtitle: z.string().min(1).optional(),
  subtitles: translatedLabels.optional(),
  /** Audience this quiz plays in. */
  audienceId: idSchema,
  /** Design world of this quiz. Must exist in `themes`. */
  themeId: idSchema,
  /** Question pools. Without them all pools of the audience take part. */
  poolIds: z.array(idSchema).min(1).optional(),
  /**
   * Selectable difficulty levels, in the order they are offered. Exactly one
   * entry means: no choice, this preset applies.
   */
  presetIds: z.array(idSchema).min(1),
  /**
   * Default of the difficulty choice. Without it, the first entry.
   *
   * It is separate from the order because the two answer different questions:
   * the offer runs from easy to hard, the default is the level the house
   * usually plays.
   */
  defaultPresetId: idSchema.optional(),
  /**
   * Player counts this quiz can be played with, in the order they are offered.
   *
   * A device only one person stands at offers `[1]`, and the question about the
   * number of players falls away. WHY IN THE CONFIGURATION: it is a property of
   * the installation and of the quiz, not of the program - until now every host
   * carried it as a component property or as a list of its own.
   */
  playerCounts: z.array(playerCountSchema).min(1).optional(),
  /** Artwork of the offer card. Must exist in `assets`. */
  artworkAssetId: idSchema.optional(),
  /**
   * Weight of the card in the menu. `wide` takes two columns - for the offer a
   * house leads with.
   */
  emphasis: z.enum(['wide', 'regular']).optional(),
  /**
   * Position in the menu, ascending. Without it the order of this list applies.
   *
   * Numbers with gaps (10, 20, 30) so that one more quiz can be put in between
   * without renumbering the others.
   */
  order: z.number().int().optional(),
})
export type QuizMode = z.infer<typeof quizModeSchema>

/**
 * The player counts a quiz offers - both when it says nothing.
 *
 * ONE PLACE FOR THIS FALLBACK: menu, kiosk and validation ask here, so a quiz
 * without the entry cannot mean two different things in two hosts.
 */
export function playerCountsOf(quiz: Pick<QuizMode, 'playerCounts'>): PlayerCount[] {
  const configured = quiz.playerCounts?.filter((count, index, all) => all.indexOf(count) === index)
  return configured && configured.length > 0 ? [...configured] : [...playerCounts]
}

/**
 * The quizzes in menu order.
 *
 * Whoever states an `order` is placed by it, ascending. Everything without one
 * follows in the order of the configuration - mixing a number and a position
 * would be a guess, and the menu does not guess.
 */
export function orderedQuizzes(quizzes: QuizMode[] | undefined): QuizMode[] {
  const all = quizzes ?? []
  const placed = all.filter((quiz) => quiz.order !== undefined).sort((left, right) => left.order! - right.order!)
  return [...placed, ...all.filter((quiz) => quiz.order === undefined)]
}

/**
 * Does this quiz type offer a difficulty choice?
 *
 * THE ONLY SOURCE OF THIS DECISION - form, server and validation ask here.
 * Offering a level that exists only once would be an empty choice before the
 * start.
 */
export function quizSupportsDifficulty(quiz: Pick<QuizMode, 'presetIds'>): boolean {
  return quiz.presetIds.length > 1
}

/** The default level of a quiz type - the first one unless stated. */
export function defaultPresetIdOf(quiz: Pick<QuizMode, 'presetIds' | 'defaultPresetId'>): string {
  const named = quiz.defaultPresetId
  if (named && quiz.presetIds.includes(named)) return named
  return quiz.presetIds[0]!
}

export const categorySchema = z.object({
  id: idSchema,
  label: z.string().min(1),
  labels: translatedLabels.optional(),
})
export const difficultySchema = z.object({
  id: idSchema,
  label: z.string().min(1),
  labels: translatedLabels.optional(),
})
export type Category = z.infer<typeof categorySchema>
export type Difficulty = z.infer<typeof difficultySchema>

export const quizConfigSchema = z.object({
  /** Default number of question slots per game. Exactly one source of truth. */
  questionsPerGame: z.number().int().min(1).max(30),
  difficulties: z.array(difficultySchema).min(1),
  categories: z.array(categorySchema).min(1),
  pools: z.array(questionPoolSchema).min(1),
  themes: z.array(quizThemeSchema).min(1),
  presets: z.array(difficultyPresetSchema).min(1),
  audiences: z.array(audienceConfigSchema).min(1),
  /**
   * The quiz types offered at the desk (see `quizModeSchema`).
   *
   * OPTIONAL, because not every installation needs them: a kiosk device starts
   * with audience and preset and knows no quiz types at all. If the list is
   * missing, there is nothing to choose at the desk - and that is a statement of
   * the configuration, not a bug.
   */
  quizzes: z.array(quizModeSchema).optional(),
  /**
   * Locales the quiz can be played in.
   *
   * If the list is missing or holds one locale only, there is nothing to choose
   * and the switch does not appear. The first one is the base locale: whatever is
   * not translated comes from it.
   */
  locales: z.array(localeSchema).min(1).optional(),
  /**
   * Interface labels per locale.
   *
   * The German versions live in the code (`@hfroemmel/quiz-react`); here stand
   * only deviations and the other locales. This way a quiz runs without a single
   * entry, and whoever wants a sentence changed needs no new program version.
   */
  interfaceStrings: z.record(z.string().min(2), z.record(z.string().min(1), z.string())).optional(),
  /**
   * Rules of the house - scoring, timings, jokers, idle watch.
   *
   * OPTIONAL, and every value has the constant the engine uses today as its
   * default (`resolveRules`). A package without `rules` therefore plays exactly
   * as before. Only rules the engine already has are settable; see
   * `rulesConfigSchema`.
   */
  rules: rulesConfigSchema.optional(),
})
export type QuizConfig = z.infer<typeof quizConfigSchema>

/* ------------------------------------------------------------------ *
 * Package (section 24.3)
 * ------------------------------------------------------------------ */

/** Content profiles of the pipeline. `no-video` serves the offline apps. */
export const contentProfiles = ['full', 'no-video'] as const
export type ContentProfile = (typeof contentProfiles)[number]

export const quizPackageManifestSchema = z.object({
  schemaVersion: z.string().min(1),
  contentVersion: z.string().min(1),
  /** Content profile of the build. If missing (older packages), `full` applies. */
  profile: z.enum(contentProfiles).optional(),
  createdAt: z.string().min(1),
  sourceRevision: z.string().optional(),
  questionsFile: z.string().min(1),
  configFile: z.string().min(1),
  assets: z.array(mediaAssetSchema),
  checksum: z.string().min(1),
})
export type QuizPackageManifest = z.infer<typeof quizPackageManifestSchema>

/** The validated package loaded into memory. */
export interface QuizPackage {
  manifest: QuizPackageManifest
  config: QuizConfig
  questions: Question[]
  assetsById: Map<string, MediaAsset>
  /** Absolute path of the directory that holds `assets/`. */
  rootDir: string
}

/** Current schema version of the quiz package. Changes require a migration. */
export const QUIZ_PACKAGE_SCHEMA_VERSION = '2.0.0'

/* ------------------------------------------------------------------ *
 * Live hotfixes (section 25)
 * ------------------------------------------------------------------ */

/** Only these fields may be patched live. */
export const patchableQuestionFieldsSchema = questionSchema
  .pick({
    prompt: true,
    options: true,
    correctOptionId: true,
    acceptedAnswerText: true,
    explanation: true,
    media: true,
    enabled: true,
  })
  .partial()
export type PatchableQuestionFields = z.infer<typeof patchableQuestionFieldsSchema>

export const questionPatchSchema = z.object({
  id: z.string().min(1),
  questionId: idSchema,
  baseContentVersion: z.string().min(1),
  changes: patchableQuestionFieldsSchema,
  reason: z.string().optional(),
  createdAt: z.string().min(1),
  createdBy: z.literal('operator'),
  /**
   * `next-use`: the patch takes effect the next time the question is drawn.
   * `immediate-confirmed`: the operator has explicitly confirmed "apply now";
   * the change goes to the stage screen immediately.
   */
  applyMode: z.enum(['next-use', 'immediate-confirmed']),
})
export type QuestionPatch = z.infer<typeof questionPatchSchema>
