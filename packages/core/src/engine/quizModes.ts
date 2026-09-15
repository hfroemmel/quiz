/**
 * Resolve a quiz type from the configuration - in exactly one place.
 *
 * What makes a quiz type is in the content (`quizModeSchema`): audience, theme,
 * question pools and the selectable difficulty levels. Which of those actually
 * exist is known only to whoever holds the whole configuration - and the check
 * may exist exactly once. Server, content service and tests therefore ask here
 * instead of searching the list themselves.
 *
 * WHAT COMES BACK IS EITHER THE QUIZ TYPE OR THE REASON. A bare `null` would
 * leave the operator guessing whether the quiz type is missing, its pool or its
 * theme - and that is exactly the question that has to be answered on the
 * evening.
 */
import { defaultPresetIdOf, type QuizConfig } from '../contracts'

/**
 * A quiz type, fully resolved.
 *
 * The engine only reads values here and looks nothing up any more: audience,
 * pools, theme and presets were checked while resolving.
 */
export interface ResolvedQuiz {
  id: string
  audience: string
  poolIds?: string[] | undefined
  themeId: string
  /** Selectable difficulty levels. One entry means: no choice. */
  presetIds: string[]
  /** Default of the choice - and with a single entry exactly that one. */
  defaultPresetId: string
}

/** The quiz type, or the plain-text reason why it does not exist. */
export type QuizLookup = { ok: true; quiz: ResolvedQuiz } | { ok: false; message: string }

export function resolveQuizMode(config: QuizConfig, quizId: string): QuizLookup {
  const quiz = config.quizzes?.find((entry) => entry.id === quizId)
  if (!quiz) return { ok: false, message: `Die Quizart "${quizId}" ist nicht konfiguriert.` }

  const audienceConfig = config.audiences.find((entry) => entry.id === quiz.audienceId)
  if (!audienceConfig) {
    return { ok: false, message: `Das Quiz "${quiz.id}" nennt die unbekannte Zielgruppe "${quiz.audienceId}".` }
  }
  if (!config.themes.some((entry) => entry.id === quiz.themeId)) {
    return { ok: false, message: `Das Quiz "${quiz.id}" nennt das unbekannte Theme "${quiz.themeId}".` }
  }
  const unknownPool = quiz.poolIds?.find((poolId) => !config.pools.some((pool) => pool.id === poolId))
  if (unknownPool) {
    return { ok: false, message: `Der Fragenpool "${unknownPool}" des Quiz "${quiz.id}" ist nicht verfügbar.` }
  }
  /*
   * A preset must exist AND be open to the audience. Both in one place,
   * because otherwise the operator's choice would get stuck on a level the
   * server only refuses when drawing the first question.
   */
  const unknownPreset = quiz.presetIds.find(
    (presetId) =>
      !config.presets.some((preset) => preset.id === presetId) || !audienceConfig.allowedPresetIds.includes(presetId),
  )
  if (unknownPreset) {
    return {
      ok: false,
      message: `Der Schwierigkeitsgrad "${unknownPreset}" des Quiz "${quiz.id}" steht der Zielgruppe "${audienceConfig.id}" nicht offen.`,
    }
  }

  return {
    ok: true,
    quiz: {
      id: quiz.id,
      audience: quiz.audienceId,
      ...(quiz.poolIds === undefined ? {} : { poolIds: quiz.poolIds }),
      themeId: quiz.themeId,
      presetIds: [...quiz.presetIds],
      defaultPresetId: defaultPresetIdOf(quiz),
    },
  }
}
