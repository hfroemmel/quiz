/**
 * Eine Quizart aus der Konfiguration aufloesen - an genau einer Stelle.
 *
 * Was eine Quizart ausmacht, steht im Inhalt (`quizModeSchema`): Zielgruppe,
 * Theme, Fragenpools und die waehlbaren Schwierigkeitsgrade. Was davon
 * tatsaechlich existiert, weiss nur, wer die ganze Konfiguration hat - und die
 * Pruefung darf es genau einmal geben. Server, Inhaltsdienst und Tests fragen
 * deshalb hier, statt die Liste jeweils selbst zu durchsuchen.
 *
 * ZURUECK KOMMT ENTWEDER DIE QUIZART ODER DER GRUND. Ein blosses `null` liesse
 * den Operator raten, ob die Quizart fehlt, ihr Pool oder ihr Theme - und
 * genau das ist am Abend die Frage, die beantwortet werden muss.
 */
import { defaultPresetIdOf, type QuizConfig } from '../contracts'

/**
 * Eine Quizart, fertig aufgeloest.
 *
 * Die Engine liest hier nur Werte und schlaegt nichts mehr nach: Zielgruppe,
 * Pools, Theme und Presets sind beim Aufloesen geprueft worden.
 */
export interface ResolvedQuiz {
  id: string
  audience: string
  poolIds?: string[] | undefined
  themeId: string
  /** Waehlbare Schwierigkeitsgrade. Ein Eintrag heisst: keine Wahl. */
  presetIds: string[]
  /** Voreinstellung der Wahl - und bei nur einem Eintrag genau dieser. */
  defaultPresetId: string
}

/** Die Quizart, oder der Klartext, warum es sie nicht gibt. */
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
   * Ein Preset muss es geben UND der Zielgruppe offenstehen. Beides an einer
   * Stelle, weil die Auswahl des Operators sonst an einer Stufe haengenbliebe,
   * die der Server erst beim Ziehen der ersten Frage ablehnt.
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
