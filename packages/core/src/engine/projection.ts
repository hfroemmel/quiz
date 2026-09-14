/**
 * Server-side projection of the authoritative state onto role-specific view
 * models (specification 19).
 *
 * SECURITY RULE: the stage screen receives exclusively the `PublicQuizViewModel`.
 * The correct answer, explanations, directing notes and selection rationales are
 * filtered out here and never transmitted before they may be public. Hiding by
 * CSS would not be enough.
 */
import {
  isChoiceQuestion,
  scoringRules,
  type GameStatisticsViewModel,
  type AuditEntry,
  type CatalogViewModel,
  type ModeratorQuizViewModel,
  type OperatorQuizViewModel,
  type PublicOption,
  type PublicQuestion,
  type PublicQuizViewModel,
  type PublicScene,
  type PublicScore,
  type PublicSolution,
  type PublicTheme,
  type QuizConfig,
  type Question,
  type QuestionPresentationType,
  type GamePhase,
  type GameState,
  type PrivateSolution,
  type ActorRole,
  type PlayerQuizViewModel,
  isSelfServicePreset,
  labelFor,
  subtitleFor,
  quizSupportsDifficulty,
  defaultPresetIdOf,
  questionTextFor,
  validLocale,
  interfaceTexts,
  jokerOf,
  jokerRevealAtMs,
  type OperatorJokerControl,
  type PublicJokerDraw,
} from '../contracts'
import { activePlayerId } from './buzzer'
import { allowedCommandsForRole } from './allowedCommands'
import { attemptsForCurrentQuestion, determineResult, pendingAttempt, pointsForCorrectAnswer } from './scoring'
import { revealElapsedMs } from './reveal'
import { drawableJokerTypes, evaluateJokerDraw, gameHasJokers, questionStillOpen } from './joker'

export interface ProjectionContext {
  nowMs: number
  config: QuizConfig
  /** Resolution of an asset id into a servable URL. */
  assetUrl: (assetId: string | undefined) => string | undefined
  contentVersion: string
  eventDayId: string
  /** Rationale of the current question selection - for operator diagnostics only. */
  selectionRationale?: string
  auditSummary?: AuditEntry[]
  connectedClients?: { role: ActorRole; clientId: string }[]
  sessionCode?: string
  lanUrls?: string[]
  warnings?: string[]
  resumable?: OperatorQuizViewModel['resumable']
  /**
   * Commands that do not follow from the phase but from the operating state of
   * the server (recovery, event day, hotfix). They are added here so that the
   * operator client still only has to evaluate `allowedCommands`.
   */
  additionalOperatorCommands?: import('../contracts').CommandType[]
  /** Audience whose theme the start view shows while no game runs. */
  previewAudienceId?: string
  /** Global sound status while no game runs. */
  soundEnabled?: boolean
  /** Locale of the device while no game runs. */
  locale?: string
  /**
   * Raw numbers of the game log from the database, per audience. The mapping to
   * readable names happens here in the projection - the same rule as for
   * category lines: raw ids do not reach the interface.
   */
  gameCounts?: { audience: string; total: number; completed: number; aborted: number; lastAtIso?: string }[]
  /** Point in time from which the log counts. */
  statisticsSinceIso?: string
}

/**
 * Scene of the stage screen.
 *
 * It follows the phase - with one exception dictated by the question type: on
 * the image reveal the stage stays in the reveal scene even when a player holds
 * the buzz. The frozen picture is exactly what is being talked about now; a jump
 * into the question layout would take it off the screen.
 */
export function sceneForPhase(phase: GamePhase, presentationType?: QuestionPresentationType): PublicScene {
  if (presentationType === 'image-reveal' && phase === 'answer-locked') return 'reveal'
  return sceneForPhaseOnly(phase)
}

function sceneForPhaseOnly(phase: GamePhase): PublicScene {
  switch (phase) {
    case 'idle':
    case 'aborted':
      return 'start'
    case 'pause-screen':
      return 'pause'
    case 'question-presented':
    case 'buzzer-open':
    case 'answer-locked':
    case 'second-chance':
      return 'question'
    case 'video':
      return 'video'
    case 'reveal-ready':
    case 'reveal-running':
    case 'reveal-paused':
      return 'reveal'
    case 'attempt-feedback':
      return 'feedback'
    case 'solution':
      return 'solution'
    case 'result':
      return 'result'
  }
}

export function projectPublic(state: GameState | null, ctx: ProjectionContext): PublicQuizViewModel {
  const theme = resolveTheme(state, ctx)
  if (!state || state.status === 'aborted') {
    return {
      scene: 'start',
      phase: state?.phase ?? 'idle',
      theme,
      quizOffers: quizOffers(ctx, localeFor(state, ctx)),
      playerScores: [],
      progress: { current: 0, total: ctx.config.questionsPerGame },
      soundEnabled: state?.soundEnabled ?? ctx.soundEnabled ?? true,
      locale: localeFor(state, ctx),
      ...textsFor(state, ctx),
      serverTimeMs: ctx.nowMs,
      revision: state?.revision ?? 0,
    }
  }

  const scene = sceneForPhase(state.phase, state.currentQuestion?.question.questionType)
  const runtime = state.currentQuestion
  const locale = localeFor(state, ctx)
  /*
   * FROM HERE ON THE QUESTION IS TRANSLATED. Everything below - text, options,
   * medium, solution - reads from this one version; otherwise the question would
   * stand in one language and the answers in another.
   */
  const question = runtime ? questionTextFor(runtime.question, locale) : undefined
  const active = activePlayerId(state)
  const showsQuestion = scene === 'question' || scene === 'feedback' || scene === 'solution' || scene === 'reveal' || scene === 'video'

  const publicQuestion: PublicQuestion | undefined =
    showsQuestion && question
      ? {
          id: question.id,
          prompt: question.prompt,
          presentationType: question.questionType,
          imageUrl: ctx.assetUrl(question.media?.imageAssetId),
          videoUrl: scene === 'video' ? ctx.assetUrl(question.media?.videoAssetId) : undefined,
          categoryLabel: categoryLabel(question, ctx, locale),
        }
      : undefined

  const hasJokers = gameHasJokers(state)
  const scores: PublicScore[] = state.players.map((player) => ({
    playerId: player.id,
    label: player.label,
    score: player.score,
    active: player.id === active,
    locked: player.lockedForCurrentQuestion,
    /*
     * Only in a game that has jokers - the field stays absent otherwise, so a
     * kiosk client sees no joker anywhere and nothing in its layout moves.
     *
     * WITHOUT THE VARIANT. The stage shows one neutral card while the joker is
     * there; how it was spent is told out loud in the hall and stays legible at
     * the operator's desk.
     */
    ...(hasJokers ? { joker: { used: jokerOf(state.jokerByPlayer, player.id).status === 'used' } } : {}),
  }))

  const view: PublicQuizViewModel = {
    scene,
    phase: state.phase,
    theme,
    ...(state.quizId === undefined ? {} : { quizId: state.quizId }),
    quizOffers: quizOffers(ctx, locale),
    question: publicQuestion,
    ...(publicJokerDraw(state, question?.id) ?? {}),
    // Only the interstitial screen gets the category of the question about to follow.
    upcomingCategoryLabel: scene === 'pause' && question ? categoryLabel(question, ctx, locale) : undefined,
    /*
     * The answer options only go on the wire once the operator has opened the
     * round. While only the question stands, the moderator reads it aloud - if
     * the stage client already had the options, they could be found in the DOM
     * before anyone is supposed to see them.
     */
    visibleOptions:
      showsQuestion && state.phase !== 'question-presented' ? publicOptions(state, scene, question) : undefined,
    // The solution is transmitted exclusively in the solution scene. After a
    // wrong first answer it thus stays hidden technically, too.
    visibleSolution: scene === 'solution' ? publicSolution(ctx, question!) : undefined,
    feedback: scene === 'feedback' ? publicFeedback(state) : undefined,
    playerScores: scores,
    currentPlayer: active,
    progress: { current: state.currentSlotIndex + 1, total: state.totalQuestions },
    reveal: state.reveal
      ? {
          status: state.reveal.status,
          durationMs: state.reveal.durationMs,
          elapsedMs: revealElapsedMs(state.reveal, ctx.nowMs),
        }
      : undefined,
    /*
     * The playback request passes through unchanged - it IS the minimum
     * already. The timestamp stays in the server state: it belongs to the log,
     * and the stage decides on the id alone.
     */
    video: state.video ? { questionId: state.video.questionId, requestId: state.video.requestId } : undefined,
    result:
      scene === 'result'
        ? { ...determineResult(state), scores }
        : undefined,
    soundEnabled: state.soundEnabled,
    locale,
    ...textsFor(state, ctx),
    transition: state.lastTransition
      ? {
          id: state.lastTransition.transitionId,
          startedAtServerMs: state.lastTransition.startedAtServerMs,
          durationMs: state.lastTransition.durationMs,
        }
      : undefined,
    serverTimeMs: ctx.nowMs,
    revision: state.revision,
  }
  return view
}

/**
 * View of the players at the touch device.
 *
 * SECURITY RULE as for the stage screen: it is the public view. The solution is
 * only transmitted in the solution scene, explanations and directing notes
 * never. Added to it is solely the list of the commands possible now, so that
 * the touch client does not derive its controls itself.
 */
export function projectPlayer(state: GameState | null, ctx: ProjectionContext): PlayerQuizViewModel {
  return {
    ...projectPublic(state, ctx),
    allowedCommands: allowedCommandsForRole(state ?? null, 'player'),
    catalog: buildPlayerCatalog(ctx, localeFor(state, ctx)),
  }
}

/**
 * Catalog for the touch device: only presets that are playable there, and only
 * audiences that permit at least one of them.
 *
 * That way no difficulty level is offered at the device that would need an
 * operator halfway through - and the client has to know nothing about it.
 */
function buildPlayerCatalog(ctx: ProjectionContext, locale: string): CatalogViewModel {
  const full = buildCatalog(ctx, locale)
  const playable = new Set(ctx.config.presets.filter(isSelfServicePreset).map((preset) => preset.id))

  return {
    ...full,
    presets: full.presets.filter((preset) => playable.has(preset.id)),
    audiences: full.audiences
      .map((entry) => ({ ...entry, allowedPresetIds: entry.allowedPresetIds.filter((id) => playable.has(id)) }))
      .filter((entry) => entry.allowedPresetIds.length > 0),
  }
}

export function projectModerator(state: GameState | null, ctx: ProjectionContext): ModeratorQuizViewModel {
  const base = projectPublic(state, ctx)
  const raw = state?.currentQuestion?.question
  /*
   * The moderator reads aloud what stands in the hall - i.e. the translated
   * version. The operator, however, edits the ORIGINAL further down: a hotfix
   * writes back into the corpus, and entering a translation there would
   * overwrite the base locale.
   */
  const question = raw ? questionTextFor(raw, base.locale) : undefined
  const attempt = state ? pendingAttempt(state) : undefined

  return {
    ...base,
    questionId: question?.id,
    // Moderator and operator see the solution privately at any time - the stage screen never early.
    privateSolution: question ? privateSolution(question) : undefined,
    explanation: question?.explanation,
    allowedCommands: allowedCommandsForRole(state ?? null, 'moderator'),
    nextStepHint: nextStepHint(state),
    answering:
      state && attempt && question
        ? {
            evaluationMode: question.evaluationMode,
            loggedOptionId: attempt.loggedOptionId,
            loggedManualVerdict: attempt.loggedManualVerdict,
            attemptNumber: attempt.attemptNumber,
            pointsIfCorrect: pointsForCorrectAnswer(
              attemptsForCurrentQuestion(state).filter((entry) => entry.outcome === 'incorrect').length,
            ),
          }
        : undefined,
  }
}

export function projectOperator(state: GameState | null, ctx: ProjectionContext): OperatorQuizViewModel {
  const moderator = projectModerator(state, ctx)
  const question = state?.currentQuestion?.question
  return {
    ...moderator,
    /*
     * Basis of the live correction: prompt and answer options in editable form.
     * They are available regardless of whether the answers are already shown on
     * the stage - the operator sees the complete question anyway.
     */
    editableQuestion: question
      ? {
          prompt: question.prompt,
          options: (question.options ?? []).map((option) => ({ id: option.id, text: option.text })),
          correctOptionId: question.correctOptionId,
          acceptedAnswerText: question.acceptedAnswerText ?? [],
        }
      : undefined,
    allowedCommands: [
      ...new Set([
        ...allowedCommandsForRole(state ?? null, 'operator'),
        ...(ctx.additionalOperatorCommands ?? []),
      ]),
    ],
    ...(operatorJoker(state) ?? {}),
    auditSummary: ctx.auditSummary ?? [],
    diagnostics: {
      contentVersion: ctx.contentVersion,
      eventDayId: ctx.eventDayId,
      selectionRationale: ctx.selectionRationale,
      connectedClients: ctx.connectedClients ?? [],
      sessionCode: ctx.sessionCode,
      lanUrls: ctx.lanUrls,
      warnings: [...(ctx.warnings ?? [])],
    },
    statistics: gameStatistics(ctx),
    resumable: ctx.resumable,
    catalog: buildCatalog(ctx, localeFor(state, ctx)),
  }
}

/**
 * The answers a 50:50 has taken out of play - and WHEN they may be known.
 *
 * Only from `applied`. The ids are decided at the draw and sit in the state
 * from that moment, but transmitting them earlier would put the outcome on the
 * wire while the card is still turning: a client could read what is coming, and
 * a stage that repaints mid-flight would strike answers out before the reveal.
 */
function eliminatedOptionIds(state: GameState, questionId: string | undefined): string[] {
  const sequence = state.jokerSequence
  if (!sequence || sequence.phase !== 'applied') return []
  if (sequence.questionId !== questionId) return []
  return sequence.eliminatedOptionIds ?? []
}

/**
 * The running draw, as far as anybody watching may know.
 *
 * THE VARIANT IS WITHHELD UNTIL THE CARD HAS TURNED. During `drawing` the
 * clients learn that a draw is running, whose it is and when it started - that
 * is everything the flight needs. What came out arrives with `revealed`, at the
 * moment the card shows it anyway. A stage that knew earlier could give the
 * result away, and one that had to be trusted not to would be the wrong design.
 *
 * `startedAtServerMs` rather than the ISO string: every other clock in this
 * view model is server milliseconds, and a client that reconnects mid-flight
 * computes its position from it.
 *
 * AN APPLIED DRAW ENDS WITH THE QUESTION being decided, not with the next one:
 * once the attempt is resolved the room is no longer being asked, so the group
 * mark goes. The answers a 50:50 removed stay struck through until the question
 * changes - that is the one thing that outlives the draw, and it lives on the
 * options rather than here.
 */
function publicJokerDraw(
  state: GameState,
  questionId: string | undefined,
): { jokerDraw: PublicJokerDraw } | undefined {
  const sequence = state.jokerSequence
  if (!sequence || sequence.phase === 'idle') return undefined
  if (sequence.questionId !== questionId) return undefined
  if (sequence.phase === 'applied' && !questionStillOpen(state)) return undefined
  return {
    jokerDraw: {
      phase: sequence.phase,
      sequenceId: sequence.sequenceId,
      playerId: sequence.playerId,
      startedAtServerMs: Date.parse(sequence.startedAt),
      revealAtMs: jokerRevealAtMs,
      ...(sequence.phase === 'drawing' ? {} : { type: sequence.type }),
    },
  }
}

/**
 * The joker at the operator's desk - the one button and what it is doing.
 *
 * Every field is answered by the rule functions in `joker.ts`, the same ones
 * the engine calls when the command arrives. That is the whole point of this
 * function: the operator client renders what it is told and decides nothing, so
 * the button can neither offer a refused draw nor hide an allowed one.
 *
 * ONE control, not one per player: there is one button, and whose joker it
 * would draw follows from who holds the buzz. `playerLabel` is what the
 * operator reads to make sure.
 */
function operatorJoker(state: GameState | null): { joker: OperatorJokerControl } | undefined {
  if (!gameHasJokers(state) || !state) return undefined

  const draw = evaluateJokerDraw(state)
  const sequence = state.jokerSequence
  const active = sequence && sequence.phase !== 'idle' ? sequence : undefined
  const playerId = draw.playerId ?? active?.playerId ?? activePlayerId(state)
  const player = state.players.find((entry) => entry.id === playerId)

  return {
    joker: {
      canDraw: draw.allowed,
      ...(draw.allowed ? {} : { blockedReason: draw.message }),
      /*
       * A question that can only produce one variant - a picture question,
       * where there is nothing to halve. The desk says so BEFORE the draw, so
       * the operator can tell the player what is coming rather than explain it
       * afterwards.
       */
      ...(draw.allowed && drawableJokerTypes(state).length === 1
        ? { onlyType: drawableJokerTypes(state)[0]! }
        : {}),
      ...(player ? { playerId: player.id, playerLabel: player.label } : {}),
      /*
       * Spent is asked of the PLAYER, not of the draw: after the question has
       * moved on there is no sequence any more, but the joker stays gone, and
       * the desk has to keep saying so.
       */
      used: Boolean(playerId && jokerOf(state.jokerByPlayer, playerId).status === 'used'),
      ...(active
        ? {
            sequence: {
              phase: active.phase,
              sequenceId: active.sequenceId,
              ...(active.phase === 'drawing' ? {} : { type: active.type }),
            },
          }
        : {}),
    },
  }
}

/* ------------------------------------------------------------------ *
 * Building blocks
 * ------------------------------------------------------------------ */

function publicOptions(state: GameState, scene: PublicScene, question: Question | undefined): PublicOption[] | undefined {
  /*
   * Hidden by the 50:50 - but only while it belongs to the question on screen.
   * The sequence is set back to `idle` on every question change; this second
   * check is the belt to that braces, and it costs one comparison.
   */
  const eliminated = new Set(eliminatedOptionIds(state, question?.id))
  const runtime = state.currentQuestion
  /*
   * Without a real choice there are no answer rows. A single option would be
   * the solution on the stage - the question then runs as a free answer.
   */
  if (!runtime || !question || !isChoiceQuestion(question)) return undefined

  const byId = new Map((question.options ?? []).map((option) => [option.id, option]))
  const chosenIncorrect = new Set(
    attemptsForCurrentQuestion(state)
      .filter((attempt) => attempt.outcome === 'incorrect' && attempt.loggedOptionId)
      .map((attempt) => attempt.loggedOptionId!),
  )

  return runtime.optionOrder
    .map((optionId) => byId.get(optionId))
    .filter((option): option is NonNullable<typeof option> => Boolean(option))
    .map((option) => {
      const entry: PublicOption = { id: option.id, text: option.text }
      if (eliminated.has(option.id)) entry.eliminated = true
      // Whether an option is correct is only transmitted in the solution scene.
      if (scene === 'solution' && option.id === question.correctOptionId) {
        entry.state = 'correct'
      } else if (chosenIncorrect.has(option.id)) {
        /*
         * An option already evaluated as wrong is used up. It is marked so at
         * once - not only in the solution scene -, so that the second chance
         * visibly excludes it. The room heard the verdict anyway.
         */
        entry.state = 'chosen-incorrect'
      } else if (option.id === pendingAttempt(state)?.loggedOptionId) {
        // The logged answer is public - but only as a commitment,
        // not as a verdict.
        entry.state = 'chosen'
      }
      return entry
    })
}

/**
 * Game log: every configured audience appears, even with zero games.
 *
 * A missing entry would be ambiguous - "never played" would then look like
 * "this audience no longer exists".
 */
function gameStatistics(ctx: ProjectionContext): GameStatisticsViewModel {
  const byAudience = new Map((ctx.gameCounts ?? []).map((entry) => [entry.audience, entry]))
  return {
    countingSinceIso: ctx.statisticsSinceIso,
    audiences: ctx.config.audiences.map((audienceConfig) => {
      const counts = byAudience.get(audienceConfig.id)
      return {
        audience: audienceConfig.id,
        label: audienceConfig.label,
        total: counts?.total ?? 0,
        completed: counts?.completed ?? 0,
        aborted: counts?.aborted ?? 0,
        lastPlayedIso: counts?.lastAtIso,
      }
    }),
  }
}

function correctAnswerText(question: Question | undefined): string {
  if (!question) return ''
  if (question.correctOptionId) {
    const option = question.options?.find((entry) => entry.id === question.correctOptionId)
    if (option) return option.text
  }
  return question.acceptedAnswerText?.[0] ?? ''
}

/**
 * Category line above the prompt: label of the FIRST category of the question.
 *
 * The order of the categories is set editorially; the first one leads. If it
 * is not in the configuration, the line stays empty instead of bringing a raw
 * id onto the stage.
 */
function categoryLabel(question: Question, ctx: ProjectionContext, locale: string): string | undefined {
  const first = question.categories[0]
  if (!first) return undefined
  const category = ctx.config.categories.find((category) => category.id === first)
  return category ? labelFor(category, locale) : undefined
}

/**
 * Which language is this view in?
 *
 * A running game keeps the language it was started in; without a game the
 * device's applies. What the content does not know falls back to the base
 * locale - a typo in the config file must not disable a device.
 */
function localeFor(state: GameState | null, ctx: ProjectionContext): string {
  return validLocale(ctx.config, state?.locale ?? ctx.locale)
}

/**
 * The interface texts - only if the content brings any.
 *
 * Without entries the field is left out instead of carrying an empty object
 * through every message: the client keeps its German versions itself anyway.
 */
function textsFor(state: GameState | null, ctx: ProjectionContext): { texts?: Record<string, string> } {
  const texts = interfaceTexts(ctx.config, localeFor(state, ctx))
  return Object.keys(texts).length > 0 ? { texts: texts } : {}
}

function publicSolution(ctx: ProjectionContext, question: Question): PublicSolution {
  /*
   * The solution view shows the answer - nothing more. The explanation stays
   * reserved for operator and moderator; on the stage it is told, not read. So
   * it is not transmitted publicly in the first place.
   */
  return {
    answerText: correctAnswerText(question),
    imageUrl: ctx.assetUrl(question.media?.imageAssetId),
  }
}

function privateSolution(question: Question): PrivateSolution {
  return {
    answerText: correctAnswerText(question),
    correctOptionId: question.correctOptionId,
    acceptedAnswerText: question.acceptedAnswerText,
  }
}

function publicFeedback(state: GameState): PublicQuizViewModel['feedback'] {
  const attempts = attemptsForCurrentQuestion(state)
  const last = attempts.filter((attempt) => attempt.outcome !== undefined).at(-1)
  if (!last) return undefined
  return { outcome: last.outcome!, playerId: last.playerId, awardedPoints: last.awardedPoints }
}

function resolveTheme(state: GameState | null, ctx: ProjectionContext): PublicTheme {
  const locale = localeFor(state, ctx)
  const audienceId = state?.audience ?? ctx.previewAudienceId
  const audienceConfig =
    ctx.config.audiences.find((entry) => entry.id === audienceId) ?? ctx.config.audiences[0]!
  /*
   * THE QUIZ TYPE DECIDES, IF THERE IS ONE - otherwise the audience.
   *
   * That way exactly one mapping applies at any moment: a game started through
   * a quiz type carries that type's theme; a device that starts without a quiz
   * type carries the audience's. No condition on a mode name stands here - the
   * id comes from the configuration.
   */
  const quiz = state?.quizId ? ctx.config.quizzes?.find((entry) => entry.id === state.quizId) : undefined
  const themeId = quiz?.themeId ?? audienceConfig.themeId
  const theme = ctx.config.themes.find((entry) => entry.id === themeId) ?? ctx.config.themes[0]!
  // Colours and fonts are deliberately not in the view model - presentation is
  // the host's concern and comes from its theme layer.
  return {
    id: theme.id,
    skin: theme.skin,
    logoUrl: ctx.assetUrl(theme.logoAssetId),
    startVisualUrl: ctx.assetUrl(audienceConfig.startVisualAssetId ?? theme.logoAssetId),
    // The title above the start visual speaks the language of the quiz, too.
    startTitle: audienceConfig.startTitles?.[locale] ?? audienceConfig.startTitle,
    startDescription: audienceConfig.startDescriptions?.[locale] ?? audienceConfig.startDescription,
    presentationAnimationSetId: theme.presentationAnimationSetId,
  }
}

/**
 * The quiz offers for the hall - name and subtitle, nothing else.
 *
 * DELIBERATELY NOT THE CATALOG: that one carries audiences, pools and presets,
 * i.e. configuration. The stage gets none of it because it must not be able to
 * derive anything; it is to write up the names, nothing more.
 */
function quizOffers(ctx: ProjectionContext, locale: string): PublicQuizViewModel['quizOffers'] {
  return (ctx.config.quizzes ?? []).map((quiz) => {
    const subtitle = subtitleFor(quiz, locale)
    return { id: quiz.id, label: labelFor(quiz, locale), ...(subtitle === undefined ? {} : { subtitle }) }
  })
}

function buildCatalog(ctx: ProjectionContext, locale: string): CatalogViewModel {
  return {
    questionsPerGame: ctx.config.questionsPerGame,
    audiences: ctx.config.audiences.map((audienceConfig) => {
      const theme = ctx.config.themes.find((entry) => entry.id === audienceConfig.themeId)
      return {
        id: audienceConfig.id,
        label: labelFor(audienceConfig, locale),
        themeId: audienceConfig.themeId,
        ...(theme?.skin ? { skin: theme.skin } : {}),
        startVisualUrl: ctx.assetUrl(audienceConfig.startVisualAssetId),
        allowedPresetIds: audienceConfig.allowedPresetIds,
      }
    }),
    /*
     * The quiz types, fully resolved. `supportsDifficulty` is derived HERE from
     * `presetIds` and not once more in the client: there is one rule for it
     * (`quizSupportsDifficulty`), and it lives in the core.
     */
    quizzes: (ctx.config.quizzes ?? []).map((quiz) => {
      const subtitle = subtitleFor(quiz, locale)
      return {
        id: quiz.id,
        label: labelFor(quiz, locale),
        ...(subtitle === undefined ? {} : { subtitle }),
        audienceId: quiz.audienceId,
        themeId: quiz.themeId,
        ...(quiz.poolIds ? { poolIds: quiz.poolIds } : {}),
        presetIds: quiz.presetIds,
        supportsDifficulty: quizSupportsDifficulty(quiz),
        defaultPresetId: defaultPresetIdOf(quiz),
      }
    }),
    pools: ctx.config.pools.map((pool) => ({ id: pool.id, label: labelFor(pool, locale) })),
    presets: ctx.config.presets.map((preset) => ({
      id: preset.id,
      label: labelFor(preset, locale),
      slotCount: preset.slots.length,
    })),
    /*
     * The locales carry their OWN name and are therefore not translated:
     * whoever looks for English looks for "English" and not "Englisch".
     */
    locales: ctx.config.locales ?? [],
  }
}

/** Plain-text hint of what happens next - helps moderator and operator. */
function nextStepHint(state: GameState | null): string {
  if (!state) return 'Quizart wählen, beim Bundestagsquiz die Schwierigkeit, dann "Spiel starten".'
  if (state.status === 'aborted') return 'Spiel abgebrochen. Zurück zur Startansicht.'
  if (state.status === 'completed') return 'Ergebnis sichtbar. Punkte können noch korrigiert werden.'

  const isLast = state.currentSlotIndex + 1 >= state.totalQuestions
  switch (state.phase) {
    case 'pause-screen':
      return 'Pausenscreen läuft, danach erscheint die nächste Frage automatisch.'
    case 'question-presented':
      return 'Frage steht. Vorlesen, dann "Antworten einblenden".'
    case 'reveal-ready':
      return 'Bild steht unscharf. Vorlesen, dann "Enthüllung starten".'
    case 'video':
      return 'Videofrage: "Video starten" spielt es auf der Bühne ab, "Frage einblenden" geht weiter. Buzzern ist erst nach dem Video möglich.'
    case 'buzzer-open':
      return 'Buzzer offen. Wer zuerst drückt, antwortet.'
    case 'reveal-running':
      return 'Enthüllung läuft. Buzzern bleibt auch nach Ablauf erlaubt.'
    case 'reveal-paused':
      return 'Enthüllung pausiert. Fortsetzen oder Antwort aufnehmen.'
    case 'answer-locked':
      return 'Antwort einloggen und anschließend auflösen.'
    case 'second-chance':
      return 'Zweite Chance: 50 Punkte bei richtiger Antwort, kein erneutes Buzzern nötig.'
    case 'attempt-feedback':
      return 'Feedback läuft, der Wechsel erfolgt automatisch.'
    case 'solution':
      return isLast ? 'Letzte Frage. "Weiter" zeigt das Ergebnis.' : '"Weiter" startet die nächste Frage.'
    default:
      return ''
  }
}

/** Display only: how many points would a correct answer earn right now? */
export const maximumPointsPerQuestion = scoringRules.firstAnswerPoints
