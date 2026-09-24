/**
 * Server-side projection of the authoritative state onto role-specific view
 * models (specification 19).
 *
 * SECURITY RULE: the stage screen receives exclusively the `PublicQuizViewModel`.
 * The correct answer, explanations, directing notes and selection rationales are
 * filtered out here and never transmitted before they may be public. Hiding by
 * CSS would not be enough.
 *
 * ONE EXCEPTION, AND IT IS CONFIGURED: the detail text of an explanation goes
 * out with the solution where `rules.showDetailsAfterSolution` says so. In a
 * hall the background is TOLD - so it stays here; at a device there is nobody
 * to tell it, and the two people at the table read it themselves. The short
 * version, the source and the directing notes stay editorial in either case,
 * and nothing travels before the solution scene.
 */
import {
  isChoiceQuestion,
  resolveRules,
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
  orderedQuizzes,
  playerCounts,
  playerCountsOf,
  type QuizMode,
  type QuizUnavailableReason,
  type StartMenuModel,
  type StartMenuOffer,
  type StartMenuOptions,
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
  /**
   * Resolution of an asset id into a servable URL - for the house's own media,
   * which are declared in `assets.json` and referenced by id from the
   * configuration: word marks, start visuals, quiz motifs.
   */
  assetUrl: (assetId: string | undefined) => string | undefined
  /**
   * Resolution of a FILE NAME into a servable URL - for the media of a
   * question, which carry their file themselves and have no id.
   */
  mediaUrl: (filename: string | undefined) => string | undefined
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
   * What the desk has set up but not yet started (`SELECT_QUIZ`). It lives in
   * the service and not in the game state: between two games there is no game
   * it could belong to.
   */
  quizSelection?: { quizId: string; presetId?: string }
  /**
   * Raw numbers of the game log from the database, per audience. The mapping to
   * readable names happens here in the projection - the same rule as for
   * category lines: raw ids do not reach the interface.
   */
  gameCounts?: { audience: string; total: number; completed: number; aborted: number; lastAtIso?: string }[]
  /** Point in time from which the log counts. */
  statisticsSinceIso?: string
  /**
   * Quizzes that cannot be started right now, with the reason.
   *
   * Only whoever can count questions knows this - the server with the content
   * service at hand. Without the entry a quiz counts as playable, exactly as
   * every host assumed before.
   */
  quizAvailability?: Record<string, QuizUnavailableReason>
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
  /*
   * THREE WAYS TO STAND ON THE START SCREEN: no game at all, an aborted one -
   * and a finished one whose result the desk has taken off the screen
   * (`SHOW_START_SCREEN`). The third is not a state of the game but of what is
   * being looked at, which is why it is a flag and not a status.
   */
  if (!state || state.status === 'aborted' || state.resultClosed) {
    return {
      scene: 'start',
      phase: state?.phase ?? 'idle',
      theme,
      quizOffers: quizOffers(ctx, localeFor(state, ctx)),
      ...(ctx.quizSelection ? { selectedQuizId: ctx.quizSelection.quizId } : {}),
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
  const showsQuestion = scene === 'question' || scene === 'feedback' || scene === 'solution' || scene === 'reveal'

  const publicQuestion: PublicQuestion | undefined =
    showsQuestion && question
      ? {
          id: question.id,
          prompt: question.prompt,
          presentationType: question.questionType,
          imageUrl: ctx.mediaUrl(question.image?.filename),
          ...(question.image?.credit ? { imageCredit: question.image.credit } : {}),
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
 * only transmitted in the solution scene, directing notes never, and of an
 * explanation at most the detail text - in the solution scene, and only where
 * the configuration asks for it (`publicSolution`). Added to that is solely the
 * list of the commands possible now, so that the touch client does not derive
 * its controls itself.
 */
export function projectPlayer(state: GameState | null, ctx: ProjectionContext): PlayerQuizViewModel {
  return {
    ...projectPublic(state, ctx),
    allowedCommands: allowedCommandsForRole(state ?? null, 'player'),
    catalog: buildPlayerCatalog(ctx, localeFor(state, ctx)),
  }
}

/**
 * Catalog for the touch device: only presets that are playable there, only
 * audiences that permit at least one of them, and only quizzes that can be
 * played through without an operator.
 *
 * That way no difficulty level is offered at the device that would need an
 * operator halfway through - and the client has to know nothing about it.
 *
 * A QUIZ WITHOUT A PLAYABLE LEVEL IS NOT AN OFFER HERE. The stage quizzes draw
 * from presets with an image-recognition slot; somebody has to judge those, and
 * at the device nobody does. Such a quiz therefore does not appear in the menu
 * instead of failing at the start.
 *
 * `supportsDifficulty` stays what the CONFIGURATION says and is deliberately
 * not recomputed from the shortened list: it decides whether the engine expects
 * a level with the start command. Whether there is anything to choose is a
 * question of the list, and the menu reads it there.
 */
function buildPlayerCatalog(ctx: ProjectionContext, locale: string): CatalogViewModel {
  const full = buildCatalog(ctx, locale)
  const playable = new Set(ctx.config.presets.filter(isSelfServicePreset).map((preset) => preset.id))

  return {
    ...full,
    presets: full.presets.filter((preset) => playable.has(preset.id)),
    quizzes: full.quizzes
      .map((quiz) => {
        const presetIds = quiz.presetIds.filter((id) => playable.has(id))
        return {
          ...quiz,
          presetIds,
          defaultPresetId: presetIds.includes(quiz.defaultPresetId) ? quiz.defaultPresetId : (presetIds[0] ?? ''),
        }
      })
      .filter((quiz) => quiz.presetIds.length > 0),
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
              resolveRules(ctx.config.rules).scoring,
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
    ...(ctx.quizSelection ? { quizSelection: ctx.quizSelection } : {}),
  }
}

/**
 * The answers a 50:50 has taken out of play - and WHEN they may be known.
 *
 * THE QUESTION CARRIES THEM, NOT THE DRAW, and that answers the "when" by
 * itself: the ids are decided with the draw and kept in the sequence, and they
 * only reach the question when the operator applies it. Nothing can therefore
 * put the outcome on the wire while the card is still turning - a client
 * cannot read what is coming, and a stage that repaints mid-flight strikes
 * nothing out early. It also survives a second draw on the same question,
 * which replaces the sequence but not the question.
 */
function eliminatedOptionIds(state: GameState): string[] {
  return state.currentQuestion?.eliminatedOptionIds ?? []
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
  /*
   * WHOSE JOKER THE DESK IS TALKING ABOUT. The player who is answering comes
   * first, then the owner of a sequence that is still on screen. The order
   * matters in the second chance: the first player's applied draw is still in
   * the state, and reading it first made the desk name that player while the
   * button was about to draw for the other one - and, where the other player
   * had already spent theirs, it reported the wrong player as spent next to the
   * sentence that named the right one.
   */
  const playerId = draw.playerId ?? activePlayerId(state) ?? active?.playerId
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
   * Hidden by the 50:50 - and only ever for the question on screen. The ids
   * hang on that question, so they cannot outlive it: the next one arrives
   * without them, and no comparison is needed to keep them apart.
   */
  const eliminated = new Set(eliminatedOptionIds(state))
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
 * Category line above the prompt: the rubric of the question, in order.
 *
 * A QUESTION MAY BE GRADED, and then the line says both: "Bremen - Geschichte"
 * - the broad subject first, the finer one behind it. The editors write them
 * in two columns of their table, and that order is the order here; the line is
 * assembled once, in the projection, so every surface that shows the rubric
 * shows the same string.
 *
 * A rubric that is not in the configuration is LEFT OUT instead of bringing a
 * raw id onto the stage - and where nothing at all remains, the line stays
 * empty rather than showing a lone dash.
 */
function categoryLabel(question: Question, ctx: ProjectionContext, locale: string): string | undefined {
  const labels = question.categories
    .map((id) => ctx.config.categories.find((category) => category.id === id))
    .filter((category): category is NonNullable<typeof category> => category !== undefined)
    .map((category) => labelFor(category, locale))
  return labels.length > 0 ? labels.join(' - ') : undefined
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
   * The solution view shows the answer - and, where the installation asks for
   * it, the background of the question.
   *
   * ON A STAGE IT DOES NOT. There the explanation belongs to the moderator, who
   * tells it; a screen that also wrote it out would compete with the person
   * speaking. That is why nothing of it used to be transmitted publicly at all.
   *
   * At a device nobody tells it. The two people at the table read it
   * themselves, so a quiz meant for that place says
   * `rules.showDetailsAfterSolution`, and then the detail text travels with the
   * solution - in the language of the question, because it comes from the same
   * translated version as prompt and options.
   *
   * ONLY `details`. The short version is written for the moderator's lead-in,
   * the source is an editorial note, and the directing notes are stage
   * directions; none of the three is meant to be read by a player.
   */
  const details = resolveRules(ctx.config.rules).showDetailsAfterSolution
    ? question.explanation?.details
    : undefined

  return {
    answerText: correctAnswerText(question),
    imageUrl: ctx.mediaUrl(question.image?.filename),
    ...(question.image?.credit ? { imageCredit: question.image.credit } : {}),
    ...(details ? { details } : {}),
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
  /*
   * A GAME THAT IS OVER NO LONGER DECIDES THE LOOK.
   *
   * The state of an ended game stays around - it carries the log, the language
   * and the sound switch - but its quiz and its audience are history. As long
   * as they still counted here, the start view wore the look of the quiz played
   * last: after the children's quiz the room's poster kept writing in its
   * handwriting until the next game of the show was started. The start view is
   * the same announcement before the first game and between two games, so it
   * gets the same answer here - the audience's look, chosen by the device
   * (`previewAudienceId`) or the first one in the configuration.
   *
   * The language is deliberately NOT part of this: whoever switched the device
   * to another language keeps it after the game, and a poster in the wrong
   * language would be an error the room can read.
   */
  const running = state && state.status !== 'aborted' ? state : null
  const audienceId = running?.audience ?? ctx.previewAudienceId
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
  const quiz = running?.quizId ? ctx.config.quizzes?.find((entry) => entry.id === running.quizId) : undefined
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
 * The quiz offers for the hall - name, subtitle and motif.
 *
 * DELIBERATELY NOT THE CATALOG: that one carries audiences, pools and presets,
 * i.e. configuration. The stage gets none of it because it must not be able to
 * derive anything; it is to write up what is on offer, nothing more.
 *
 * The motif travels along because it is content: the hall recognises a card by
 * its picture before it reads the name, and a stage that kept its own table of
 * pictures left every quiz added later without one.
 */
function quizOffers(ctx: ProjectionContext, locale: string): PublicQuizViewModel['quizOffers'] {
  return orderedQuizzes(ctx.config.quizzes).map((quiz) => {
    const subtitle = subtitleFor(quiz, locale)
    const artworkUrl = ctx.assetUrl(quiz.artworkAssetId)
    const badgeUrl = ctx.assetUrl(quiz.badgeAssetId)
    return {
      id: quiz.id,
      label: labelFor(quiz, locale),
      ...(subtitle === undefined ? {} : { subtitle }),
      ...(artworkUrl === undefined ? {} : { artworkUrl }),
      ...(badgeUrl === undefined ? {} : { badgeUrl }),
      emphasis: quiz.emphasis ?? 'regular',
    }
  })
}

function buildCatalog(ctx: ProjectionContext, locale: string): CatalogViewModel {
  const rules = resolveRules(ctx.config.rules)
  return {
    questionsPerGame: ctx.config.questionsPerGame,
    rules: {
      ...(rules.idleTimeoutMs === undefined ? {} : { idleTimeoutMs: rules.idleTimeoutMs }),
      showDetailsAfterSolution: rules.showDetailsAfterSolution,
      manualAdjustmentStep: rules.scoring.manualAdjustmentStep,
    },
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
    quizzes: orderedQuizzes(ctx.config.quizzes).map((quiz) => {
      const subtitle = subtitleFor(quiz, locale)
      const artworkUrl = ctx.assetUrl(quiz.artworkAssetId)
      const badgeUrl = ctx.assetUrl(quiz.badgeAssetId)
      const unavailable = quizUnavailableReason(quiz, ctx)
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
        playerCounts: playerCountsOf(quiz),
        emphasis: quiz.emphasis ?? 'regular',
        ...(artworkUrl === undefined ? {} : { artworkUrl }),
        ...(badgeUrl === undefined ? {} : { badgeUrl }),
        available: unavailable === undefined,
        ...(unavailable === undefined ? {} : { unavailableReason: unavailable }),
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

/**
 * Why a quiz cannot be started - or nothing, if it can.
 *
 * Two reasons, and they come from different places: a pool that is not
 * configured is visible in the configuration itself, while an empty question
 * set is only known to whoever can count questions. The server therefore hands
 * the second one in (`quizAvailability`); the first one is decided here.
 */
function quizUnavailableReason(
  quiz: QuizMode,
  ctx: ProjectionContext,
): CatalogViewModel['quizzes'][number]['unavailableReason'] {
  const missingPool = (quiz.poolIds ?? []).some((poolId) => !ctx.config.pools.some((pool) => pool.id === poolId))
  if (missingPool) return 'missing-pool'
  return ctx.quizAvailability?.[quiz.id]
}

/**
 * The start menu as one model - offers, player counts, languages.
 *
 * PURE FUNCTION ON THE CATALOG: the catalogue already carries everything
 * resolved for a locale, so kiosk, desk and stage read the same figures. What
 * the menu must not be able to do is derive configuration; hence the offers
 * name a quiz id and nothing about audiences or pools.
 */
export function deriveStartMenu(
  config: Pick<QuizConfig, 'locales' | 'interfaceStrings'>,
  catalog: CatalogViewModel,
  locale: string,
  options?: StartMenuOptions,
): StartMenuModel {
  const texts = interfaceTexts(config, locale)
  /*
   * A DEVICE BELONGS TO ONE AUDIENCE, and the menu of a device must not offer
   * the other one: which audience plays here is a fact of the setup, and a
   * foyer device where somebody taps the children's world by accident would be
   * an operating mistake with no control for it. The desk names no audience and
   * sees everything.
   */
  const audienceId = options?.audienceId
  const quizzes =
    audienceId === undefined ? catalog.quizzes : catalog.quizzes.filter((quiz) => quiz.audienceId === audienceId)
  const audiences =
    audienceId === undefined ? catalog.audiences : catalog.audiences.filter((entry) => entry.id === audienceId)
  /*
   * Without quizzes the audiences are the offer - a kiosk package without quiz
   * types is a valid package, and its menu is never empty.
   */
  const offers: StartMenuOffer[] = quizzes.length > 0 ? quizOffersOf(catalog, quizzes) : audienceOffersOf(catalog, audiences)

  /*
   * The player counts of all offers, ascending. A device that offers only solo
   * games therefore shows no choice at all - see `preselect`.
   */
  const counts = [...new Set(offers.flatMap((offer) => offer.playerCounts))].sort((left, right) => left - right)
  const playModes = counts.map((playerCount) => {
    const textKey = playerCount === 1 ? 'kiosk.solo' : 'kiosk.duo'
    const label = texts[textKey]
    return { playerCount, textKey, ...(label === undefined ? {} : { label }) }
  })

  /*
   * What is already settled because there is only one of it. A single offer
   * needs no choice, and neither does a single player count.
   */
  const single = offers.length === 1 ? offers[0] : undefined
  const preselect = {
    ...(single?.quizId === undefined ? {} : { quizId: single.quizId }),
    ...(single?.audienceId === undefined ? {} : { audienceId: single.audienceId }),
    ...(counts.length === 1 ? { playerCount: counts[0]! } : {}),
  }

  return {
    locale,
    locales: config.locales ?? catalog.locales,
    offers,
    playModes,
    ...(Object.keys(preselect).length > 0 ? { preselect } : {}),
  }
}

/**
 * Name and length of a level, out of the catalogue.
 *
 * A preset the catalogue does not know keeps its id as its name: a menu that
 * showed nothing there would hide a configuration mistake instead of naming it.
 */
function levelOf(catalog: CatalogViewModel, presetId: string): { label: string; slotCount?: number } {
  const preset = catalog.presets.find((entry) => entry.id === presetId)
  return { label: preset?.label ?? presetId, ...(preset === undefined ? {} : { slotCount: preset.slotCount }) }
}

/** The offers of a package with quiz types - the normal case. */
function quizOffersOf(catalog: CatalogViewModel, quizzes: CatalogViewModel['quizzes']): StartMenuOffer[] {
  return quizzes.map((quiz) => ({
    quizId: quiz.id,
    label: quiz.label,
    ...(quiz.subtitle === undefined ? {} : { subtitle: quiz.subtitle }),
    ...(quiz.artworkUrl === undefined ? {} : { artworkUrl: quiz.artworkUrl }),
    ...(quiz.badgeUrl === undefined ? {} : { badgeUrl: quiz.badgeUrl }),
    emphasis: quiz.emphasis,
    playerCounts: quiz.playerCounts,
    ...(quiz.supportsDifficulty
      ? {
          difficulties: quiz.presetIds.map((presetId) => ({
            presetId,
            ...levelOf(catalog, presetId),
            isDefault: presetId === quiz.defaultPresetId,
          })),
        }
      : {}),
    available: quiz.available,
    ...(quiz.unavailableReason === undefined ? {} : { unavailableReason: quiz.unavailableReason }),
  }))
}

/**
 * The offers of a package without quiz types - its audiences.
 *
 * A kiosk device needs no quiz types: it starts with audience and preset, and
 * that is a valid package. So that every host can render ONE menu, the
 * audiences become offers here - and the menu is never empty for a package
 * that plays.
 */
function audienceOffersOf(catalog: CatalogViewModel, audiences: CatalogViewModel['audiences']): StartMenuOffer[] {
  return audiences.map((audience) => ({
    audienceId: audience.id,
    label: audience.label,
    ...(audience.startVisualUrl === undefined ? {} : { artworkUrl: audience.startVisualUrl }),
    emphasis: 'regular' as const,
    playerCounts: [...playerCounts],
    /*
     * AN AUDIENCE ALWAYS CARRIES ITS LEVELS, even the single one. Without a
     * quiz type the engine expects a preset with every start command, so the
     * menu has to know its id - whether there is anything to CHOOSE is decided
     * by the length of this list, and a list of one is not a question. A quiz
     * type is the other way round: there the level belongs to the type, and one
     * sent along where it offers no choice is refused.
     */
    ...(audience.allowedPresetIds.length > 0
      ? {
          difficulties: audience.allowedPresetIds.map((presetId, index) => ({
            presetId,
            ...levelOf(catalog, presetId),
            isDefault: index === 0,
          })),
        }
      : {}),
    available: true,
  }))
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

/**
 * Display only: how many points does a first correct answer earn?
 *
 * The constant stays for hosts that read it; `maximumPointsFor(config)` is the
 * answer for a package that sets its own scoring.
 */
export const maximumPointsPerQuestion = scoringRules.firstAnswerPoints

/** The same figure for a given package. */
export function maximumPointsFor(config: QuizConfig): number {
  return resolveRules(config.rules).scoring.firstAnswerPoints
}
