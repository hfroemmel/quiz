/**
 * Authoritative state machine (specification 18).
 *
 * This file is the only place where phase changes happen. It is pure: time,
 * randomness, ids and the access to the question pool are injected through
 * `EngineContext`. That way all rule tests run without Electron, React, network
 * or real system time.
 *
 * Contract:
 *   reduce(state, command, ctx) -> accepted (new state + events + effects)
 *                                | rejected (reason + plain-text message)
 *
 * The engine increments `revision` on every acceptance. Idempotency against
 * duplicate network commands is ensured by the server through the `commandId`
 * (specification 18.4); in addition the engine protects structurally, because
 * an attempt already evaluated cannot be evaluated again.
 */
import {
  createJokerStates,
  gameTiming,
  isChoiceQuestion,
  isImageReveal,
  isSelfServiceAnswerable,
  jokerRevealAtMs,
  jokerTypeLabel,
  playerIds,
  scoringRules,
  selfServiceTiming,
  type AnswerAttempt,
  type Command,
  type CommandRejection,
  type CommandType,
  type FlowProfile,
  type GamePhase,
  type GameState,
  type PlayerCount,
  type PlayerId,
  type PlayerState,
  type RuntimeQuestion,
  type GameTiming,
  type ScoringRules,
  type SelfServiceTiming,
} from '../contracts'
import { eligibleOpponent, evaluateBuzz } from './buzzer'
import {
  applyScoreDelta,
  attemptsForCurrentQuestion,
  countFailedAttemptsForCurrentQuestion,
  pendingAttempt,
  pointsForCorrectAnswer,
} from './scoring'
import {
  completeReveal,
  createRevealClock,
  pauseReveal,
  resetReveal,
  resumeReveal,
} from './reveal'
import {
  JOKER_REVEAL_TRANSITION,
  drawJokerType,
  drawableJokerTypes,
  drawableOptionIds,
  evaluateJokerContinue,
  evaluateJokerDraw,
  isJokerRevealTransition,
  jokerBlockedCommands,
  jokerSequenceHoldsQuestion,
  pickEliminatedOptions,
} from './joker'
import type { QuizLookup } from './quizModes'

/* ------------------------------------------------------------------ *
 * Ports and result structure
 * ------------------------------------------------------------------ */

/** Request of the engine to the application layer: draw a question for a slot. */
export interface SlotRequest {
  audience: string
  poolIds?: string[] | undefined
  presetId: string
  slotIndex: number
  excludeQuestionIds: string[]
  excludeRepetitionGroupIds: string[]
}

export type SlotResponse =
  | { ok: true; runtimeQuestion: RuntimeQuestion; rationale: string }
  | { ok: false; message: string }

/**
 * Access to content and usage history. The engine knows neither file system nor
 * SQLite; the server implements this port (dependency direction, specification 20.4).
 */
export interface QuestionSource {
  /** Number of slots of the combination, or `null` if it does not exist. */
  slotCountFor(audience: string, presetId: string): number | null
  /**
   * The quiz type from the configuration, with audience, pools, theme and
   * difficulty levels - fully checked.
   */
  quizFor(quizId: string): QuizLookup
  selectForSlot(request: SlotRequest): SlotResponse
}

export interface EngineContext {
  nowMs: number
  eventDayId: string
  /** Creates stable ids (game, attempt, transition). */
  newId: (prefix: string) => string
  questionSource: QuestionSource
  timing?: GameTiming
  selfServiceTiming?: SelfServiceTiming
  /** Scoring of this package (`config.rules.scoring`); without it the constants. */
  scoring?: ScoringRules
  /**
   * Do operated games of this package have jokers? (`config.rules.jokers`)
   *
   * Without a statement they do - that is how every game played so far began.
   * A self-service game never has them, whatever this says.
   */
  jokersEnabled?: boolean
  /** Global sound status a newly started game takes over. */
  initialSoundEnabled?: boolean
  /** Locale of the device a newly started game takes over. */
  initialLocale?: string
  /**
   * Source of chance for decisions the engine itself makes - currently only the
   * one wrong answer a 50:50 leaves standing. Injected so a test can hand in a
   * fixed sequence instead of luck.
   */
  random?: () => number
}

export interface DomainEvent {
  category: 'game' | 'buzzer' | 'answer' | 'score' | 'phase' | 'content' | 'system'
  message: string
  data?: Record<string, unknown>
}

/** Score booking the server has to persist in the same transaction. */
export interface ScoreTransaction {
  playerId: PlayerId
  delta: number
  newScore: number
  reason: string
  attemptId?: string
}

/** Usage entry of the global repetition history (specification 17.3). */
export interface QuestionUsageRecord {
  questionId: string
  repetitionGroupId?: string
  slotId: string
  slotIndex: number
}

export interface EngineEffects {
  scoreTransactions: ScoreTransaction[]
  questionUsages: QuestionUsageRecord[]
}

export type EngineResult =
  | { ok: true; state: GameState; events: DomainEvent[]; effects: EngineEffects }
  | { ok: false; rejection: CommandRejection }

/* ------------------------------------------------------------------ *
 * Reduce
 * ------------------------------------------------------------------ */

export function reduce(state: GameState | null, command: Command, ctx: EngineContext): EngineResult {
  const timing = ctx.timing ?? gameTiming
  const work = new Draft(
    state,
    ctx,
    timing,
    ctx.selfServiceTiming ?? selfServiceTiming,
    ctx.scoring ?? scoringRules,
  )

  /*
   * WHILE THE CARD IS IN THE AIR, THE QUESTION WAITS.
   *
   * A draw covers the whole screen and takes a couple of seconds; logging an
   * answer or resolving the attempt underneath it would decide the question
   * behind a card nobody can see past. One guard here rather than a condition
   * in six handlers - and the operator's buttons follow the same rule, because
   * `availableCommands` asks it too.
   */
  const blocked = jokerSequenceBlocks(work.state, command.type)
  if (blocked) return blocked

  switch (command.type) {
    case 'START_GAME':
      return startGame(work, command)

    case 'SET_SOUND_ENABLED': {
      if (!work.state) return reject('no-active-game', 'Es läuft gerade kein Spiel.')
      work.mutate((draft) => {
        draft.soundEnabled = command.enabled
      })
      work.log('system', `Sound ${command.enabled ? 'eingeschaltet' : 'stummgeschaltet'}.`)
      return work.commit()
    }

    case 'SET_LOCALE': {
      /*
       * As with the sound: if a game runs, it switches along - the questions
       * are the same, only the language differs. If none runs, there is
       * nothing the command could be recorded in; then the application layer
       * carries it (see `QuizService`).
       */
      if (!work.state) return reject('no-active-game', 'Es läuft gerade kein Spiel.')
      work.mutate((draft) => {
        draft.locale = command.locale
      })
      work.log('system', `Sprache auf ${command.locale} umgestellt.`)
      return work.commit()
    }

    case 'ABORT_GAME': {
      const guard = work.requireActiveGame()
      if (guard) return guard
      work.mutate((draft) => {
        draft.status = 'aborted'
        draft.phase = 'aborted'
        draft.buzzer = { open: false }
        draft.pendingTransition = undefined
      })
      // An aborted game deliberately shows no automatic winner view.
      work.log('game', 'Spiel abgebrochen. Es wird kein Ergebnis angezeigt.')
      return work.commit()
    }

    /*
     * THE RESULT GOES, THE GAME STAYS. Only for a game that is actually
     * finished: while one runs there is a result nobody has seen yet, and an
     * aborted game never put one on the screen.
     */
    case 'SHOW_START_SCREEN': {
      if (!work.state) return reject('no-active-game', 'Es liegt kein beendetes Spiel vor.')
      if (work.state.status !== 'completed') {
        return reject('invalid-phase', 'Die Startansicht kann erst nach dem Ergebnis eingeblendet werden.')
      }
      if (work.state.resultClosed) {
        return reject('invalid-phase', 'Die Startansicht steht bereits.')
      }
      work.mutate((draft) => {
        draft.resultClosed = true
      })
      work.log('game', 'Ergebnis ausgeblendet. Die Buehne zeigt wieder die Angebotsuebersicht.')
      return work.commit()
    }

    case 'OPEN_BUZZER': {
      const guard = work.requireActiveGame()
      if (guard) return guard
      if (work.phase !== 'question-presented') {
        return reject('invalid-phase', 'Der Buzzer kann nur freigegeben werden, wenn die Frage sichtbar ist.')
      }
      work.mutate((draft) => {
        draft.phase = 'buzzer-open'
        draft.buzzer = { open: true }
      })
      work.log('buzzer', 'Buzzer freigegeben.')
      return work.commit()
    }

    case 'BUZZ':
    case 'SELECT_PLAYER_MANUALLY':
      return acceptPlayer(work, command.playerId, command.type === 'BUZZ' ? 'hardware' : 'manual')

    case 'LOG_OPTION_ANSWER':
      return logAnswer(work, { optionId: command.optionId })

    case 'MARK_MANUAL_ANSWER':
      return logAnswer(work, { verdict: command.verdict })

    case 'RESOLVE_ATTEMPT':
      return resolveAttempt(work)

    case 'RESOLVE_WITHOUT_ANSWER':
      return resolveWithoutAnswer(work, 'resolve-without-answer')

    case 'PASS_SECOND_CHANCE':
      return resolveWithoutAnswer(work, 'pass')

    case 'RESET_BUZZER':
      return resetBuzzer(work)

    case 'START_IMAGE_REVEAL': {
      const guard = work.requireRevealQuestion()
      if (guard) return guard
      if (work.phase !== 'reveal-ready') {
        return reject('invalid-phase', 'Die Enthüllung wurde bereits gestartet.')
      }
      /*
       * Only here does the buzzer open. Before, the picture stands blurred so
       * that the moderator can read the question in peace - a buzz would
       * otherwise be a lucky hit on a picture nobody has seen yet.
       */
      work.mutate((draft) => {
        draft.reveal = resumeReveal(draft.reveal ?? createRevealClock(work.timing.imageRevealDurationMs), ctx.nowMs)
        draft.phase = 'reveal-running'
        draft.buzzer = { open: true }
      })
      work.log('phase', 'Enthüllung gestartet, Buzzer freigegeben.')
      return work.commit()
    }

    case 'PAUSE_IMAGE_REVEAL': {
      const guard = work.requireRevealQuestion()
      if (guard) return guard
      if (work.phase !== 'reveal-running') {
        return reject('invalid-phase', 'Die Enthüllung läuft gerade nicht.')
      }
      work.mutate((draft) => {
        draft.reveal = pauseReveal(draft.reveal!, ctx.nowMs)
        draft.phase = 'reveal-paused'
      })
      work.log('phase', 'Enthüllung pausiert.')
      return work.commit()
    }

    case 'RESUME_IMAGE_REVEAL': {
      const guard = work.requireRevealQuestion()
      if (guard) return guard
      if (work.phase !== 'reveal-paused') {
        return reject('invalid-phase', 'Die Enthüllung ist gerade nicht pausiert.')
      }
      work.mutate((draft) => {
        draft.reveal = resumeReveal(draft.reveal!, ctx.nowMs)
        draft.phase = 'reveal-running'
      })
      work.log('phase', 'Enthüllung fortgesetzt.')
      return work.commit()
    }

    case 'REVEAL_IMAGE_COMPLETELY': {
      const guard = work.requireRevealQuestion()
      if (guard) return guard
      if (!['reveal-running', 'reveal-paused', 'answer-locked'].includes(work.phase)) {
        return reject('invalid-phase', 'Das Bild kann in dieser Phase nicht aufgedeckt werden.')
      }
      work.mutate((draft) => {
        draft.reveal = completeReveal(draft.reveal!)
        // A complete reveal explicitly does NOT lock the buzzer.
        if (draft.phase === 'reveal-paused') draft.phase = 'reveal-running'
      })
      work.log('phase', 'Bild vollständig aufgedeckt. Buzzern bleibt erlaubt.')
      return work.commit()
    }

    case 'RESET_IMAGE_REVEAL': {
      const guard = work.requireRevealQuestion()
      if (guard) return guard
      if (!['reveal-running', 'reveal-paused'].includes(work.phase)) {
        return reject('invalid-phase', 'Die Enthüllung kann in dieser Phase nicht zurückgesetzt werden.')
      }
      work.mutate((draft) => {
        draft.reveal = resumeReveal(resetReveal(draft.reveal!), ctx.nowMs)
        draft.phase = 'reveal-running'
      })
      // Technical correction, deliberately separate from "reset buzzer".
      work.log('system', 'Enthüllung technisch auf den Anfang zurückgesetzt.')
      return work.commit()
    }

    case 'DRAW_JOKER':
      return drawJoker(work)

    case 'CONTINUE_JOKER':
      return continueJoker(work, command.sequenceId)

    case 'ADJUST_SCORE': {
      if (!work.state) return reject('no-active-game', 'Es läuft gerade kein Spiel.')
      if (work.state.status === 'aborted') {
        return reject('invalid-phase', 'Ein abgebrochenes Spiel kann nicht mehr korrigiert werden.')
      }
      const step =
        command.direction === 'increase' ? work.scoring.manualAdjustmentStep : -work.scoring.manualAdjustmentStep
      const player = work.state.players.find((entry) => entry.id === command.playerId)
      if (!player) return reject('invalid-payload', 'Unbekannter Spieler.')
      const { score, effectiveDelta } = applyScoreDelta(player.score, step, work.scoring)
      if (effectiveDelta === 0) {
        return reject('invalid-payload', `Der Punktestand von ${player.label} liegt bereits bei 0.`)
      }
      work.mutate((draft) => {
        const target = draft.players.find((entry) => entry.id === command.playerId)!
        target.score = score
      })
      const reason = command.reason ?? 'manuelle Korrektur'
      work.score({ playerId: command.playerId, delta: effectiveDelta, newScore: score, reason })
      work.log('score', `${player.label} - ${formatDelta(effectiveDelta)} - ${reason}`)
      return work.commit()
    }

    case 'CONTINUE':
      return handleContinue(work)

    case 'SKIP_QUESTION':
      return skipQuestion(work, command.reason)

    case 'ADVANCE_TIMED_PHASE':
      return advanceTimedPhase(work, command.transitionId)

    case 'SELECT_QUIZ':
    case 'RESUME_GAME':
    case 'DISCARD_RESUMABLE_GAME':
    case 'START_NEW_EVENT_DAY':
    case 'RESET_GAME_STATISTICS':
    case 'APPLY_QUESTION_PATCH':
      /*
       * `SELECT_QUIZ` is in this list for the same reason as the rest: what the
       * desk is setting up is not a move in a game. It is answered by the
       * service, which keeps the choice between two games - the engine has no
       * state for a game that has not started.
       */
      // Operating and recovery commands are deliberately not game rules.
      // They are handled in the application layer (`@quiz/runtime`) because they
      // concern content, database and event day - not the game flow.
      return reject('unknown-command', 'Dieser Befehl wird nicht von der Spiel-Engine verarbeitet.')

    default: {
      const exhaustive: never = command
      void exhaustive
      return reject('unknown-command', 'Unbekannter Befehl.')
    }
  }
}

/* ------------------------------------------------------------------ *
 * Command implementations
 * ------------------------------------------------------------------ */

/**
 * The start configuration the server commits to.
 *
 * It is created in exactly ONE place - `resolveStartConfig` - and afterwards
 * only written into the game state. Neither desk nor stage derive anything
 * from it: what stands here, the server has confirmed.
 */
interface StartConfig {
  quizId?: string
  audience: string
  poolIds?: string[] | undefined
  presetId: string
}

/**
 * Turn the command into the binding start configuration - or refuse.
 *
 * TWO WAYS, ONE RESULT: the desk names a quiz type, a device names audience
 * and preset. Both together are a contradiction and are refused, not silently
 * weighed.
 */
function resolveStartConfig(
  work: Draft,
  command: { quizId?: string; audience?: string; poolIds?: string[]; presetId?: string },
): { ok: true; config: StartConfig } | { ok: false; rejection: EngineResult } {
  const { quizId, audience, poolIds, presetId } = command

  if (quizId === undefined) {
    if (!audience || !presetId) {
      return {
        ok: false,
        rejection: reject('invalid-payload', 'Zum Start fehlt die Quizart beziehungsweise Zielgruppe und Preset.'),
      }
    }
    return { ok: true, config: { audience, ...(poolIds === undefined ? {} : { poolIds }), presetId } }
  }

  if (audience !== undefined || poolIds !== undefined) {
    return {
      ok: false,
      rejection: reject(
        'invalid-payload',
        'Eine Quizart bringt Zielgruppe und Fragenpool schon mit. Beides zusätzlich zu senden wäre eine zweite Angabe.',
      ),
    }
  }

  const lookup = work.ctx.questionSource.quizFor(quizId)
  if (!lookup.ok) return { ok: false, rejection: reject('unknown-quiz', lookup.message) }
  const quiz = lookup.quiz

  /*
   * THE DIFFICULTY BELONGS ONLY TO A QUIZ TYPE THAT OFFERS IT. A form that
   * leaves the old level standing on a change is caught here - as a refusal
   * and not as a silently played other quiz.
   */
  const hasChoice = quiz.presetIds.length > 1
  if (!hasChoice) {
    if (presetId !== undefined) {
      return {
        ok: false,
        rejection: reject(
          'invalid-difficulty',
          `Das Quiz "${quiz.id}" kennt keine Schwierigkeitswahl. Ein Schwierigkeitsgrad darf dazu nicht mitgeschickt werden.`,
        ),
      }
    }
    return { ok: true, config: { quizId: quiz.id, audience: quiz.audience, poolIds: quiz.poolIds, presetId: quiz.defaultPresetId } }
  }

  if (presetId === undefined) {
    return {
      ok: false,
      rejection: reject('invalid-difficulty', `Für das Quiz "${quiz.id}" fehlt der Schwierigkeitsgrad.`),
    }
  }
  if (!quiz.presetIds.includes(presetId)) {
    return {
      ok: false,
      rejection: reject(
        'invalid-difficulty',
        `Den Schwierigkeitsgrad "${presetId}" gibt es im Quiz "${quiz.id}" nicht.`,
      ),
    }
  }
  return { ok: true, config: { quizId: quiz.id, audience: quiz.audience, poolIds: quiz.poolIds, presetId } }
}

function startGame(
  work: Draft,
  command: {
    quizId?: string
    audience?: string
    poolIds?: string[]
    presetId?: string
    playerCount?: PlayerCount
    playerLabels?: string[]
    flowProfile?: FlowProfile
  },
): EngineResult {
  const { playerLabels } = command
  if (work.state && work.state.status === 'active') {
    return reject('invalid-phase', 'Es läuft bereits ein Spiel. Bitte zuerst beenden.')
  }

  const resolved = resolveStartConfig(work, command)
  if (!resolved.ok) return resolved.rejection
  const { quizId, audience, poolIds, presetId } = resolved.config

  const slotCount = work.ctx.questionSource.slotCountFor(audience, presetId)
  if (slotCount === null) {
    return reject('invalid-payload', 'Diese Kombination aus Zielgruppe und Schwierigkeits-Preset gibt es nicht.')
  }

  // Without it a game is a duel. The stage operation thus stays
  // unchanged without having to send the player count.
  const playerCount: PlayerCount = command.playerCount ?? 2
  // Without it a human is in control - the stage operation thus stays unchanged.
  const flowProfile: FlowProfile = command.flowProfile ?? 'operated'
  const players: PlayerState[] = playerIds
    .slice(0, playerCount)
    .map((id, index) => createPlayer(id, playerLabels?.[index] ?? `Spieler ${index + 1}`))
  const fresh: GameState = {
    gameId: work.ctx.newId('game'),
    eventDayId: work.ctx.eventDayId,
    status: 'active',
    phase: 'pause-screen',
    revision: 0,
    ...(quizId === undefined ? {} : { quizId }),
    audience,
    ...(poolIds === undefined ? {} : { poolIds }),
    presetId,
    flowProfile,
    totalQuestions: slotCount,
    currentSlotIndex: 0,
    selectedQuestionIds: [],
    selectedRepetitionGroupIds: [],
    players,
    buzzer: { open: false },
    attempts: [],
    /*
     * JOKERS EXIST IN AN OPERATED GAME AND NOWHERE ELSE.
     *
     * They are spent by the operator on a player's request, out loud, in a hall
     * - a situation that only the live quiz has. The kiosk and the touch device
     * run `self-service`: nobody there could authorise a joker, so the supply is
     * not created, and the absent field is what every reader asks about. That
     * keeps the rule in ONE place instead of a configuration flag that each host
     * would have to set correctly.
     */
    ...(flowProfile === 'operated' && (work.ctx.jokersEnabled ?? true)
      ? {
          jokerByPlayer: createJokerStates(players.map((player) => player.id)),
          jokerSequence: { phase: 'idle' as const },
        }
      : {}),
    // The global sound status is kept across games.
    soundEnabled: work.ctx.initialSoundEnabled ?? work.state?.soundEnabled ?? true,
    // Likewise the locale: it belongs to the device and outlives the single game.
    ...(work.ctx.initialLocale ?? work.state?.locale
      ? { locale: work.ctx.initialLocale ?? work.state?.locale }
      : {}),
    updatedAtMs: work.ctx.nowMs,
  }

  work.replaceState(fresh)
  const poolNote = poolIds?.length ? `, Pools ${poolIds.join('+')}` : ''
  const quizNote = quizId ? `Quiz "${quizId}", ` : ''
  work.log(
    'game',
    `Spiel gestartet: ${quizNote}Zielgruppe "${audience}"${poolNote}, Preset "${presetId}", ${slotCount} Fragen.`,
  )

  const selection = drawQuestionForCurrentSlot(work, [])
  if (!selection.ok) return selection.rejection

  // The pause/logo screen starts as a short presentation phase of its own; then
  // the same path takes over as between two questions (no second flow logic).
  work.scheduleTimedTransition(questionEntryPhase(work.state!), work.timing.pauseScreenMs, 'pause-to-question')
  return work.commit()
}

/** The guard itself - the list and the predicate live in `joker.ts`. */
function jokerSequenceBlocks(state: GameState | null, type: CommandType): EngineResult | null {
  if (!jokerSequenceHoldsQuestion(state) || !jokerBlockedCommands.includes(type)) return null
  return reject(
    'joker-sequence-active',
    'Es läuft gerade eine Jokerziehung. Erst danach geht es mit der Frage weiter.',
  )
}

/* ------------------------------------------------------------------ *
 * The joker
 *
 * Two commands, one sequence. `DRAW_JOKER` flips the coin and starts the card
 * on its way; a timed transition turns the card over; `CONTINUE_JOKER` applies
 * what came out. The rules live in `joker.ts` because the operator's view asks
 * them too - a disabled button and a refused command must never disagree.
 *
 * THE DRAW IS FINAL FROM ITS FIRST MOMENT. The player's joker is marked used
 * before the card has even left the scoreboard, and there is no command that
 * hands it back: a reload during the flight, a reconnect, a repeated click -
 * none of them can produce a second draw.
 * ------------------------------------------------------------------ */

function drawJoker(work: Draft): EngineResult {
  const decision = evaluateJokerDraw(work.state)
  if (!decision.allowed) return reject(decision.reason, decision.message)

  const state = work.state!
  const playerId = decision.playerId!
  const label = state.players.find((player) => player.id === playerId)!.label
  const questionId = state.currentQuestion!.question.id

  /*
   * THE COIN AND THE ANSWERS ARE DRAWN HERE, ONCE, before anything is written.
   * Both results are stored with the sequence, so no later step - and no
   * client - ever draws again. The eliminated ids exist from this moment even
   * though nobody may see them until the card has turned.
   */
  const type = drawJokerType(work.ctx.random ?? Math.random, drawableJokerTypes(state))
  const eliminatedOptionIds =
    type === 'fiftyFifty'
      ? pickEliminatedOptions({
          correctOptionId: state.currentQuestion!.question.correctOptionId!,
          drawableOptionIds: drawableOptionIds(state),
          random: work.ctx.random ?? Math.random,
        })
      : []

  const startedAt = new Date(work.ctx.nowMs).toISOString()
  const sequenceId = work.ctx.newId('joker')

  work.mutate((draft) => {
    draft.jokerByPlayer = {
      ...draft.jokerByPlayer,
      [playerId]: { status: 'used', type, usedAtQuestionId: questionId, usedAt: startedAt },
    }
    draft.jokerSequence = {
      phase: 'drawing',
      sequenceId,
      playerId,
      questionId,
      type,
      startedAt,
      ...(type === 'fiftyFifty' ? { eliminatedOptionIds } : {}),
    }
  })

  /*
   * The turn of the card is a SERVER step, not an animation the stage finishes
   * on its own: `revealed` is what makes the operator's "Weiter" appear, and a
   * client that reconnects mid-flight has to find the same phase everybody else
   * is in. `still` keeps the scene from rebuilding - the draw happens in the
   * overlay above it, and the question underneath must stay exactly as it was.
   */
  work.scheduleTimedTransition(work.phase, jokerRevealAtMs, JOKER_REVEAL_TRANSITION, { still: true })

  /*
   * `event` NAMES the domain event; the rest is its payload. There is no event
   * channel to the clients - they receive whole snapshots - so the record in
   * the audit log IS the event: it is what the operator's log shows, and it is
   * where the draw stays traceable after the evening.
   */
  work.log('game', `${label} zieht den Joker: ${jokerTypeLabel(type)}.`, {
    event: 'jokerDrawn',
    playerId,
    jokerType: type,
    questionId,
    sequenceId,
    ...(type === 'fiftyFifty' ? { eliminatedOptionIds } : {}),
  })
  return work.commit()
}

/**
 * The operator has seen the card and lets the game go on.
 *
 * This is where a 50:50 becomes visible - the ids were decided at the draw,
 * they only reach the clients now (see `projection.ts`). And this is NOT the
 * general "next question": it advances the joker sequence and nothing else.
 */
function continueJoker(work: Draft, sequenceId: string): EngineResult {
  const decision = evaluateJokerContinue(work.state, sequenceId)
  if (!decision.allowed) return reject(decision.reason, decision.message)

  const sequence = work.state!.jokerSequence!
  if (sequence.phase === 'idle') return reject('joker-no-sequence', 'Es läuft gerade keine Jokerziehung.')

  work.mutate((draft) => {
    draft.jokerSequence = { ...sequence, phase: 'applied' }
    /*
     * THE STRUCK ANSWERS MOVE TO THE QUESTION, and this is the moment: from
     * here they are on screen, and from here they have to survive a SECOND
     * draw on the same question - the second chance of a wrong answer is the
     * everyday case, and the next card replaces this sequence. On the question
     * they die with it and nothing has to clear them.
     */
    const struck = sequence.eliminatedOptionIds ?? []
    if (struck.length > 0 && draft.currentQuestion) {
      const known = draft.currentQuestion.eliminatedOptionIds ?? []
      draft.currentQuestion = {
        ...draft.currentQuestion,
        eliminatedOptionIds: [...known, ...struck.filter((id) => !known.includes(id))],
      }
    }
  })
  work.log('game', `${jokerTypeLabel(sequence.type)} wird angewendet.`, {
    event: 'jokerApplied',
    playerId: sequence.playerId,
    jokerType: sequence.type,
    sequenceId: sequence.sequenceId,
  })
  return work.commit()
}

function acceptPlayer(work: Draft, playerId: PlayerId, via: 'hardware' | 'manual'): EngineResult {
  if (!work.state) return reject('no-active-game', 'Es läuft gerade kein Spiel.')
  const decision = evaluateBuzz(work.state, playerId)
  if (!decision.allowed) {
    // Refused events are logged - including the keyboard's auto-repeat.
    return reject(decision.reason ?? 'buzzer-closed', decision.message ?? 'Buzzer nicht möglich.')
  }

  claimPlayer(work, playerId, via)
  return work.commit()
}

/**
 * The buzz itself - without commit, separate from the eligibility check.
 * Whether the buzz is allowed is checked in `evaluateBuzz`, and that happens
 * BEFORE this call.
 */
function claimPlayer(work: Draft, playerId: PlayerId, via: 'hardware' | 'manual'): void {
  const label = work.state!.players.find((player) => player.id === playerId)!.label
  const wasRevealRunning = work.phase === 'reveal-running'

  work.mutate((draft) => {
    draft.buzzer = { open: false, acceptedPlayerId: playerId, acceptedAtMs: work.ctx.nowMs, acceptedVia: via }
    // A valid buzz freezes the reveal immediately, so that the other player
    // gets no information advantage during the answer.
    if (wasRevealRunning && draft.reveal) {
      draft.reveal = pauseReveal(draft.reveal, work.ctx.nowMs)
    }
    draft.phase = 'answer-locked'
    draft.attempts.push(createAttempt(work, draft, playerId))
  })
  work.log('buzzer', `${label} hat den Zuschlag (${describeVia(via)}).`, { playerId, via })
}

function describeVia(via: 'hardware' | 'manual'): string {
  return via === 'hardware' ? 'Buzzer' : 'manuell'
}

function logAnswer(work: Draft, input: { optionId?: string; verdict?: 'correct' | 'incorrect' }): EngineResult {
  if (!work.state) return reject('no-active-game', 'Es läuft gerade kein Spiel.')
  if (!['answer-locked', 'second-chance'].includes(work.phase)) {
    return reject('invalid-phase', 'In dieser Phase kann keine Antwort eingeloggt werden.')
  }
  const attempt = pendingAttempt(work.state)
  if (!attempt) return reject('no-pending-attempt', 'Es gibt gerade keinen offenen Versuch.')

  const question = work.state.currentQuestion!.question
  if (input.optionId !== undefined) {
    if (!isChoiceQuestion(question)) {
      return reject('invalid-payload', 'Diese Frage hat keine Antwortoptionen zum Einloggen.')
    }
    const known = question.options?.some((option) => option.id === input.optionId)
    if (!known) return reject('invalid-payload', 'Diese Antwortoption gehört nicht zur Frage.')
    /*
     * An option already evaluated as wrong is used up. Logging it again in the
     * second chance could only lead to a second "wrong" - the operator
     * therefore sees it locked, and the server holds the rule.
     */
    const alreadyWrong = attemptsForCurrentQuestion(work.state).some(
      (attempt) => attempt.outcome === 'incorrect' && attempt.loggedOptionId === input.optionId,
    )
    if (alreadyWrong) {
      return reject('option-already-answered', 'Diese Antwort wurde bereits als falsch bewertet.')
    }
  }

  /*
   * THE SAME KEY AGAIN TAKES THE ANSWER BACK OUT.
   *
   * Logging in is a note, not a decision - the decision is `RESOLVE_ATTEMPT`.
   * A mis-hit at the desk had no way back before: the operator could move the
   * note to another answer, but not remove it, and a question where nothing
   * was meant to be logged had to be resolved with something in it. The key
   * that set the note therefore clears it, which is also what the pressed
   * button at the desk looks like it would do.
   *
   * WHAT THAT GIVES BACK is everything that hangs on "nothing is committed
   * yet": the resolve button goes dark again, and the joker can be drawn -
   * `evaluateJokerDraw` asks the same field ("Antwort eingeloggt. Joker kommt
   * davor.").
   */
  const undo =
    input.optionId !== undefined
      ? attempt.loggedOptionId === input.optionId
      : attempt.loggedManualVerdict === input.verdict

  work.mutate((draft) => {
    const target = draft.attempts.find((entry) => entry.id === attempt.id)!
    if (input.optionId !== undefined) {
      target.loggedOptionId = undo ? undefined : input.optionId
      target.loggedManualVerdict = undefined
    }
    if (input.verdict !== undefined) {
      target.loggedManualVerdict = undo ? undefined : input.verdict
      target.loggedOptionId = undefined
    }
  })
  const optionText = () =>
    question.options?.find((option) => option.id === input.optionId)?.text ?? input.optionId
  const verdictText = () => (input.verdict === 'correct' ? 'richtig' : 'falsch')
  const description =
    input.optionId !== undefined
      ? undo
        ? `Option "${optionText()}" wieder ausgeloggt.`
        : `Option "${optionText()}" eingeloggt.`
      : undo
        ? `Manuelle Bewertung "${verdictText()}" zurückgenommen.`
        : `Manuelle Bewertung "${verdictText()}" vorgemerkt.`
  work.log('answer', description)
  return work.commit()
}

function resolveAttempt(work: Draft): EngineResult {
  if (!work.state) return reject('no-active-game', 'Es läuft gerade kein Spiel.')
  if (!['answer-locked', 'second-chance'].includes(work.phase)) {
    return reject('invalid-phase', 'In dieser Phase gibt es nichts auszuwerten.')
  }
  const attempt = pendingAttempt(work.state)
  if (!attempt) return reject('no-pending-attempt', 'Es gibt gerade keinen offenen Versuch.')
  if (attempt.resolvedAtMs !== undefined) {
    return reject('attempt-already-resolved', 'Dieser Versuch wurde bereits ausgewertet.')
  }

  const question = work.state.currentQuestion!.question
  let outcome: 'correct' | 'incorrect'
  if (attempt.loggedManualVerdict) {
    outcome = attempt.loggedManualVerdict
  } else if (attempt.loggedOptionId !== undefined) {
    // Explicit correct answer: the comparison is always against `correctOptionId`,
    // never against a position in the option list.
    outcome = attempt.loggedOptionId === question.correctOptionId ? 'correct' : 'incorrect'
  } else {
    return reject(
      'answer-not-logged',
      'Zuerst die genannte Antwort einloggen oder "Ohne Antwort auflösen" verwenden.',
    )
  }

  return finishAttempt(work, attempt, outcome)
}

function resolveWithoutAnswer(work: Draft, mode: 'resolve-without-answer' | 'pass'): EngineResult {
  if (!work.state) return reject('no-active-game', 'Es läuft gerade kein Spiel.')
  const allowedPhases: GamePhase[] = [
    'question-presented',
    'buzzer-open',
    'answer-locked',
    'second-chance',
    'reveal-ready',
    'reveal-running',
    'reveal-paused',
  ]
  if (!allowedPhases.includes(work.phase)) {
    return reject('invalid-phase', 'In dieser Phase kann nicht aufgelöst werden.')
  }
  if (mode === 'pass' && work.phase !== 'second-chance') {
    return reject('invalid-phase', 'Passen ist nur in der zweiten Chance möglich.')
  }

  const existing = pendingAttempt(work.state)
  if (existing) {
    // An attempt already running (e.g. second chance) counts as "passed".
    return finishAttempt(work, existing, 'passed')
  }

  // Without buzz and without answer: neutral attempt without a player, no points.
  let created: AnswerAttempt | undefined
  work.mutate((draft) => {
    created = createAttempt(work, draft, null)
    draft.attempts.push(created)
  })
  return finishAttempt(work, created!, 'no-answer')
}

/**
 * Evaluates an attempt for good, books points if due and starts the feedback
 * sequence (specification 13.1).
 *
 * Points are awarded here exactly once: `outcome` is set afterwards and
 * `pendingAttempt` no longer finds the attempt, so a second call is refused
 * before any booking.
 */
function finishAttempt(
  work: Draft,
  attempt: AnswerAttempt,
  outcome: 'correct' | 'incorrect' | 'passed' | 'no-answer',
): EngineResult {
  const state = work.state!
  const question = state.currentQuestion!.question
  const imageReveal = isImageReveal(question.questionType)
  const previousFailures = countFailedAttemptsForCurrentQuestion(state)
  const points = outcome === 'correct' ? pointsForCorrectAnswer(previousFailures, work.scoring) : work.scoring.noPoints

  const playerLabel = attempt.playerId
    ? state.players.find((player) => player.id === attempt.playerId)!.label
    : 'ohne Spieler'

  work.mutate((draft) => {
    const target = draft.attempts.find((entry) => entry.id === attempt.id)!
    target.outcome = outcome
    target.awardedPoints = points
    target.resolvedAtMs = work.ctx.nowMs

    if (points > 0 && attempt.playerId) {
      const player = draft.players.find((entry) => entry.id === attempt.playerId)!
      const { score } = applyScoreDelta(player.score, points, work.scoring)
      player.score = score
    }

    // On normal questions the player is locked for this question after a wrong
    // first answer. On the image reveal nobody is ever locked - there any number
    // of failed attempts is allowed and both may buzz again.
    if (outcome === 'incorrect' && !imageReveal && attempt.playerId) {
      const player = draft.players.find((entry) => entry.id === attempt.playerId)!
      player.lockedForCurrentQuestion = true
    }
    draft.buzzer = { open: false }
  })

  if (points > 0 && attempt.playerId) {
    const newScore = work.state!.players.find((player) => player.id === attempt.playerId)!.score
    work.score({
      playerId: attempt.playerId,
      delta: points,
      newScore,
      reason: previousFailures === 0 ? 'richtige Antwort' : 'richtige Antwort nach Fehlversuch',
      attemptId: attempt.id,
    })
    work.log('score', `${playerLabel} - ${formatDelta(points)} - richtige Antwort`)
  }
  work.log('answer', `Versuch ${attempt.attemptNumber} von ${playerLabel}: ${describeOutcome(outcome)}.`, {
    attemptId: attempt.id,
    outcome,
    points,
  })

  // Determine the next phase and start the feedback sequence with a defined fallback time.
  const nextPhase = nextPhaseAfterAttempt(work, outcome, attempt, imageReveal)
  if (outcome === 'correct' || outcome === 'incorrect') {
    const feedbackMs = outcome === 'correct' ? work.timing.correctFeedbackMs : work.timing.incorrectFeedbackMs
    const extra = nextPhase === 'solution' ? work.timing.solutionDelayMs : 0
    work.mutate((draft) => {
      draft.phase = 'attempt-feedback'
    })
    work.scheduleTimedTransition(nextPhase, feedbackMs + extra, `feedback-${outcome}`)
  } else {
    // Passing and resolving without an answer need no correct/wrong animation.
    applyPhase(work, nextPhase)
  }
  return work.commit()
}

function nextPhaseAfterAttempt(
  work: Draft,
  outcome: 'correct' | 'incorrect' | 'passed' | 'no-answer',
  attempt: AnswerAttempt,
  imageReveal: boolean,
): GamePhase {
  if (outcome !== 'incorrect') return 'solution'
  // Image reveal: the solution stays hidden, the reveal continues at the same
  // spot, both players may buzz again.
  if (imageReveal) return 'reveal-running'
  // Normal question: after the first failed attempt the other player gets the
  // second chance; after the second failed attempt the solution follows.
  // In a solo game there is no other player - there the solution follows at once.
  const opponent = eligibleOpponent(work.state!, attempt.playerId)
  return attempt.attemptNumber === 1 && opponent ? 'second-chance' : 'solution'
}

function resetBuzzer(work: Draft): EngineResult {
  if (!work.state) return reject('no-active-game', 'Es läuft gerade kein Spiel.')
  const question = work.state.currentQuestion
  if (!question) return reject('invalid-phase', 'Es ist gerade keine Frage aktiv.')

  if (work.phase === 'second-chance') {
    // In the second chance there is no buzzer assignment; only the answer already
    // logged is reset.
    const attempt = pendingAttempt(work.state)
    if (!attempt) return reject('no-pending-attempt', 'Es gibt nichts zurückzusetzen.')
    work.mutate((draft) => {
      const target = draft.attempts.find((entry) => entry.id === attempt.id)!
      target.loggedOptionId = undefined
      target.loggedManualVerdict = undefined
    })
    work.log('buzzer', 'Eingeloggte Antwort der zweiten Chance verworfen.')
    return work.commit()
  }

  if (!['answer-locked', 'buzzer-open', 'reveal-running', 'reveal-paused'].includes(work.phase)) {
    return reject('invalid-phase', 'In dieser Phase gibt es keine Buzzer-Zuordnung.')
  }

  work.mutate((draft) => {
    // Discard the open, not yet evaluated attempt.
    const open = draft.attempts.findIndex((entry) => entry.outcome === undefined)
    if (open >= 0) draft.attempts.splice(open, 1)
    draft.buzzer = { open: true }
    // Locks from failed attempts already evaluated remain - they are a game
    // rule, not a buzzer assignment.
    draft.phase = isImageReveal(question.question.questionType)
      ? draft.reveal?.status === 'paused'
        ? 'reveal-paused'
        : 'reveal-running'
      : 'buzzer-open'
  })
  work.log('buzzer', 'Buzzer zurückgesetzt und erneut freigegeben.')
  return work.commit()
}

function handleContinue(work: Draft): EngineResult {
  const guard = work.requireActiveGame()
  if (guard) return guard

  if (work.phase === 'result') {
    return reject('invalid-phase', 'Das Spiel ist beendet. Ueber "Beenden" geht es zurück zur Startansicht.')
  }
  if (work.phase !== 'solution') {
    // `Weiter` always means the same and must never mean "evaluate answer" or
    // "open for the second player" - there are commands of their own for that.
    return reject('invalid-phase', '"Weiter" ist erst nach der Lösung möglich.')
  }

  const state = work.state!
  const isLastQuestion = state.currentSlotIndex + 1 >= state.totalQuestions
  if (isLastQuestion) {
    work.mutate((draft) => {
      draft.phase = 'result'
      draft.status = 'completed'
      draft.buzzer = { open: false }
      draft.pendingTransition = undefined
    })
    work.log('game', 'Letzte Frage abgeschlossen, Ergebnisansicht angezeigt.')
    return work.commit()
  }

  work.mutate((draft) => {
    draft.currentSlotIndex += 1
  })
  const selection = drawQuestionForCurrentSlot(work, [])
  if (!selection.ok) {
    /*
     * Without an operator there is nobody who could react to a failed
     * selection. A stuck screen would be the worst result, so the game ends
     * here with what was played.
     */
    if (state.flowProfile === 'self-service') return finishGameEarly(work)
    return selection.rejection
  }

  work.mutate((draft) => {
    draft.phase = 'pause-screen'
  })
  work.scheduleTimedTransition(questionEntryPhase(work.state!), work.timing.pauseScreenMs, 'pause-to-question')
  return work.commit()
}

/**
 * Ends a self-service game for which no answerable question was found any
 * more. What was played is scored.
 *
 * `totalQuestions` stays the number of slots of the preset; how many questions
 * were actually asked, the result derives from the attempts.
 */
function finishGameEarly(work: Draft): EngineResult {
  const played = work.state!.currentSlotIndex
  work.mutate((draft) => {
    draft.currentSlotIndex = Math.max(0, played - 1)
    draft.phase = 'result'
    draft.status = 'completed'
    draft.buzzer = { open: false }
    draft.pendingTransition = undefined
  })
  work.log(
    'content',
    `Keine weitere Frage verfügbar, die ohne Operator beantwortet werden kann. Das Spiel endet nach ${played} Fragen.`,
    { playedQuestions: played },
  )
  return work.commit()
}

function skipQuestion(work: Draft, reason: string | undefined): EngineResult {
  const guard = work.requireActiveGame()
  if (guard) return guard
  const current = work.state!.currentQuestion
  if (!current) return reject('invalid-phase', 'Es ist gerade keine Frage aktiv.')
  const skippablePhases: GamePhase[] = [
    'pause-screen',
    'question-presented',
    'buzzer-open',
    'answer-locked',
    'second-chance',
    'reveal-ready',
    'reveal-running',
    'reveal-paused',
  ]
  if (!skippablePhases.includes(work.phase)) {
    return reject('invalid-phase', 'Eine bereits aufgelöste Frage kann nicht mehr übersprungen werden.')
  }

  const skippedId = current.question.id
  const selection = drawQuestionForCurrentSlot(work, [skippedId])
  if (!selection.ok) return selection.rejection

  work.log('content', `Frage ${skippedId} übersprungen${reason ? ` (${reason})` : ''}.`, { skippedId, reason })
  work.mutate((draft) => {
    draft.phase = 'pause-screen'
  })
  work.scheduleTimedTransition(questionEntryPhase(work.state!), work.timing.pauseScreenMs, 'pause-to-question')
  return work.commit()
}

function advanceTimedPhase(work: Draft, transitionId: string): EngineResult {
  if (!work.state) return reject('no-active-game', 'Es läuft gerade kein Spiel.')
  const pending = work.state.pendingTransition
  if (!pending || pending.transitionId !== transitionId) {
    // Duplicate or late reports run into the void here - a quick double click
    // cannot trigger a transition twice.
    return reject('invalid-phase', 'Dieser Uebergang ist bereits abgeschlossen.')
  }
  /*
   * THE TURN OF THE CARD IS NOT A PHASE CHANGE. It is the one transition that
   * leaves the question exactly where it was and only advances the draw - which
   * is why it was scheduled onto the phase it is already in.
   */
  if (isJokerRevealTransition(work.state, pending.transitionId)) {
    const sequence = work.state.jokerSequence!
    if (sequence.phase !== 'drawing') return reject('invalid-phase', 'Diese Ziehung ist nicht mehr offen.')
    work.mutate((draft) => {
      draft.jokerSequence = { ...sequence, phase: 'revealed' }
      draft.pendingTransition = undefined
    })
    return work.commit()
  }

  // Out of the solution the due transition is no phase change but the same
  // decision as "continue": draw the next question or show the result.
  if (work.phase === 'solution') return handleContinue(work)

  applyPhase(work, pending.nextPhase)
  return work.commit()
}

/* ------------------------------------------------------------------ *
 * Phase transitions
 * ------------------------------------------------------------------ */

/**
 * Emergency brake for the search for an answerable question in self-service
 * operation. Normally the search ends by itself, because questions already
 * drawn are excluded and the slots run out.
 */
const MAX_SELF_SERVICE_DRAWS = 200

/** In which phase does the current question start after the pause screen? */
function questionEntryPhase(state: GameState): GamePhase {
  const current = state.currentQuestion?.question
  const type = current?.questionType
  /*
   * In self-service there is nobody who reads the question aloud and then
   * opens it. The question therefore still stands alone at first - only it is
   * not the operator who opens it but a fixed deadline (`questionLeadInMs`).
   * The phases are the same; only the trigger is replaced.
   *
   * The reveal, by contrast, starts at once: there the picture IS the question,
   * and a wait before it would only show a covered picture without a task.
   */
  const selfService = state.flowProfile === 'self-service'
  if (type === 'image-reveal') return selfService ? 'reveal-running' : 'reveal-ready'
  return 'question-presented'
}

/**
 * Applies the target phase of a timed transition.
 *
 * Important: this function resets no per-question data. The per-question reset
 * happens exclusively in `drawQuestionForCurrentSlot`, so that "resume reveal
 * after a failed attempt" and "begin new picture question" can share the same
 * code without the progress getting lost by accident.
 */
function applyPhase(work: Draft, phase: GamePhase): void {
  applyPhaseMutation(work, phase)
}

function applyPhaseMutation(work: Draft, phase: GamePhase): void {
  work.mutate((draft) => {
    draft.pendingTransition = undefined
    switch (phase) {
      case 'solution': {
        draft.phase = 'solution'
        draft.buzzer = { open: false }
        // After a correct answer or a manual resolve the picture is completely sharp.
        if (draft.reveal) draft.reveal = completeReveal(draft.reveal)
        break
      }
      case 'second-chance': {
        draft.phase = 'second-chance'
        draft.buzzer = { open: false }
        break
      }
      case 'reveal-running': {
        // Both "picture question begins" and "resume reveal after a failed attempt".
        draft.phase = 'reveal-running'
        draft.reveal = resumeReveal(draft.reveal ?? createRevealClock(work.timing.imageRevealDurationMs), work.ctx.nowMs)
        draft.buzzer = { open: true }
        break
      }
      case 'reveal-ready': {
        // The picture stands blurred, the clock is not running yet - and the buzzer is closed.
        draft.phase = 'reveal-ready'
        draft.reveal = draft.reveal ?? createRevealClock(work.timing.imageRevealDurationMs)
        draft.buzzer = { open: false }
        break
      }
      case 'buzzer-open': {
        // In self-service this phase is entered automatically; the buzzer has to
        // open there exactly as it does on the operator's command.
        draft.phase = 'buzzer-open'
        draft.buzzer = { open: true }
        break
      }
      case 'question-presented': {
        draft.phase = 'question-presented'
        draft.buzzer = { open: false }
        break
      }
      default:
        draft.phase = phase
    }
  })

  // The second chance immediately gets an open attempt for the player not yet
  // locked - buzzing again is not required for that.
  if (phase === 'second-chance') {
    const state = work.state!
    const eligible = state.players.find((player) => !player.lockedForCurrentQuestion)
    if (eligible) {
      work.mutate((draft) => {
        draft.attempts.push(createAttempt(work, draft, eligible.id))
      })
      work.log('phase', `Zweite Chance für ${eligible.label}. Kein erneutes Buzzern nötig.`)
    }
  } else {
    work.log('phase', `Phase: ${phase}.`)
  }

  scheduleSelfServiceFollowUp(work, phase)
}

/**
 * Transitions nobody triggers by hand in the self-service profile.
 *
 * No new mechanism arises: these are the same timed transitions with a
 * server-side fallback time that already exist for feedback and pause screen.
 * Only the trigger is missing - so the server schedules it.
 */
function scheduleSelfServiceFollowUp(work: Draft, phase: GamePhase): void {
  const state = work.state
  if (!state || state.flowProfile !== 'self-service' || state.status !== 'active') return

  if (phase === 'question-presented') {
    /*
     * First the question, then the answers. The server does not even send the
     * options during this deadline (`projection.ts`), and the buzzer is closed
     * - so there is nothing to hit before somebody has read.
     */
    work.scheduleTimedTransition('buzzer-open', work.selfServiceTiming.questionLeadInMs, 'question-to-answers')
    return
  }

  /*
   * AFTER THE SOLUTION THE SERVER SCHEDULES NOTHING. It only goes on through a
   * player's `CONTINUE` - the same decision as the operator's "continue". A
   * scheduled transition would take the picture away from whoever is reading
   * why their answer was wrong.
   */
}

/**
 * Draws the question for the current slot and resets all per-question runtime
 * data (locks, buzzer, reveal).
 */
function drawQuestionForCurrentSlot(
  work: Draft,
  additionalExclusions: string[],
): { ok: true } | { ok: false; rejection: EngineResult } {
  const state = work.state!
  const selfService = state.flowProfile === 'self-service'
  const exclusions = [...additionalExclusions]

  const draw = () =>
    work.ctx.questionSource.selectForSlot({
      audience: state.audience,
      ...(state.poolIds === undefined ? {} : { poolIds: state.poolIds }),
      presetId: state.presetId,
      slotIndex: state.currentSlotIndex,
      excludeQuestionIds: [...state.selectedQuestionIds, ...exclusions],
      excludeRepetitionGroupIds: [...state.selectedRepetitionGroupIds],
    })

  let response = draw()

  /*
   * Self-service: a question only a human can evaluate - an oral answer -
   * cannot be resolved at the touch device. It would stop the flow because
   * nobody is there to end it.
   *
   * So it is treated like a skipped question. If the whole slot is unfit - a
   * preset with a pure image-reveal slot is exactly that case - the slot is
   * skipped and the next one tried.
   *
   * Both are meant to be prevented by the content validation: a kiosk preset
   * filters on evaluable questions. This place is the safety net, not the plan
   * - and it does not stay silent but writes every case into the log.
   */
  if (selfService) {
    let guard = 0
    for (;;) {
      if (response.ok && isSelfServiceAnswerable(response.runtimeQuestion.question)) break
      if ((guard += 1) > MAX_SELF_SERVICE_DRAWS) {
        return { ok: false, rejection: reject('no-candidate-question', 'Die Fragenauswahl kommt zu keinem Ergebnis.') }
      }

      if (response.ok) {
        const unusable = response.runtimeQuestion.question.id
        exclusions.push(unusable)
        work.log(
          'content',
          `Frage ${unusable} braucht eine Bewertung durch einen Menschen und wurde im Selbstbedienungsbetrieb übersprungen.`,
          { questionId: unusable, reason: 'not-self-service-answerable' },
        )
        response = draw()
        continue
      }

      // The whole slot is unfit. If there is no further one, the caller decides
      // what that means: no game start or an early end.
      if (state.currentSlotIndex + 1 >= state.totalQuestions) {
        return {
          ok: false,
          rejection: reject(
            'no-candidate-question',
            'Für diesen Fragenplatz gibt es keine Frage, die ohne Operator beantwortet werden kann. ' +
              'Bitte das Preset auf auswertbare Fragen einschränken.',
          ),
        }
      }
      const skipped = state.currentSlotIndex + 1
      work.mutate((draft) => {
        draft.currentSlotIndex += 1
      })
      work.log(
        'content',
        `Fragenplatz ${skipped} enthält keine Frage, die ohne Operator beantwortet werden kann, und wurde übersprungen.`,
        { slotIndex: skipped - 1, reason: 'slot-not-self-service-answerable' },
      )
      response = draw()
    }
  }

  if (!response.ok) {
    return { ok: false, rejection: reject('no-candidate-question', response.message) }
  }

  const runtime = response.runtimeQuestion
  work.mutate((draft) => {
    // A skipped question stays locked for this game, so that it is not
    // drawn again right away.
    for (const excluded of exclusions) {
      if (!draft.selectedQuestionIds.includes(excluded)) draft.selectedQuestionIds.push(excluded)
    }
    draft.currentQuestion = runtime
    draft.selectedQuestionIds.push(runtime.question.id)
    const groupId = runtime.question.repetitionGroupId
    if (groupId && !draft.selectedRepetitionGroupIds.includes(groupId)) {
      draft.selectedRepetitionGroupIds.push(groupId)
    }
    // Per-question reset - exactly one place.
    for (const player of draft.players) player.lockedForCurrentQuestion = false
    /*
     * The draw dies with the question - here, at the one place a new question
     * arrives. With it go the eliminated answers, which belonged to that
     * question. The SPENT joker is not touched: it lives in `jokerByPlayer`
     * and survives until a new game starts.
     */
    if (draft.jokerSequence) draft.jokerSequence = { phase: 'idle' }
    draft.buzzer = { open: false }
    draft.reveal = isImageReveal(runtime.question.questionType)
      ? createRevealClock(work.timing.imageRevealDurationMs)
      : undefined
  })

  work.usage({
    questionId: runtime.question.id,
    repetitionGroupId: runtime.question.repetitionGroupId,
    slotId: runtime.slotId,
    slotIndex: runtime.slotIndex,
  })
  work.log(
    'content',
    `Frage ${state.currentSlotIndex + 1}/${state.totalQuestions} gewählt: ${runtime.question.id} - ${response.rationale}`,
    { questionId: runtime.question.id, rationale: response.rationale },
  )
  return { ok: true }
}

/* ------------------------------------------------------------------ *
 * Helpers
 * ------------------------------------------------------------------ */

function createPlayer(id: PlayerId, label: string): PlayerState {
  return { id, label, score: 0, lockedForCurrentQuestion: false }
}

function createAttempt(work: Draft, draft: GameState, playerId: PlayerId | null): AnswerAttempt {
  const question = draft.currentQuestion!
  const attemptNumber =
    draft.attempts.filter(
      (entry) => entry.questionId === question.question.id && entry.slotIndex === draft.currentSlotIndex,
    ).length + 1
  return {
    id: work.ctx.newId('attempt'),
    questionId: question.question.id,
    slotIndex: draft.currentSlotIndex,
    playerId,
    attemptNumber,
    awardedPoints: 0,
    createdAtMs: work.ctx.nowMs,
  }
}

function describeOutcome(outcome: 'correct' | 'incorrect' | 'passed' | 'no-answer'): string {
  switch (outcome) {
    case 'correct':
      return 'richtig'
    case 'incorrect':
      return 'falsch'
    case 'passed':
      return 'gepasst'
    case 'no-answer':
      return 'ohne Antwort aufgelöst'
  }
}

function formatDelta(delta: number): string {
  return delta >= 0 ? `+${delta}` : `${delta}`
}

function reject(reason: CommandRejection['reason'], message: string): EngineResult {
  return { ok: false, rejection: { reason, message } }
}

/**
 * Small workspace for one command: collects state change, events and effects,
 * so that the individual commands stay short and all use the same commit
 * semantics (increment revision, set timestamp).
 */
class Draft {
  state: GameState | null
  private readonly events: DomainEvent[] = []
  private readonly effects: EngineEffects = { scoreTransactions: [], questionUsages: [] }

  constructor(
    initial: GameState | null,
    readonly ctx: EngineContext,
    readonly timing: GameTiming,
    readonly selfServiceTiming: SelfServiceTiming,
    readonly scoring: ScoringRules,
  ) {
    this.state = initial ? structuredClone(initial) : null
  }

  get phase(): GamePhase {
    return this.state?.phase ?? 'idle'
  }

  replaceState(next: GameState): void {
    this.state = next
  }

  mutate(mutator: (draft: GameState) => void): void {
    if (!this.state) throw new Error('mutate ohne Zustand')
    mutator(this.state)
  }

  log(category: DomainEvent['category'], message: string, data?: Record<string, unknown>): void {
    this.events.push({ category, message, data })
  }

  score(transaction: ScoreTransaction): void {
    this.effects.scoreTransactions.push(transaction)
  }

  usage(record: QuestionUsageRecord): void {
    this.effects.questionUsages.push(record)
  }

  requireActiveGame(): EngineResult | null {
    if (!this.state) return reject('no-active-game', 'Es läuft gerade kein Spiel.')
    if (this.state.status !== 'active') {
      return reject('no-active-game', 'Das Spiel ist bereits beendet oder abgebrochen.')
    }
    return null
  }

  requireRevealQuestion(): EngineResult | null {
    const guard = this.requireActiveGame()
    if (guard) return guard
    const question = this.state!.currentQuestion
    if (!question || !isImageReveal(question.question.questionType) || !this.state!.reveal) {
      return reject('invalid-phase', 'Die aktuelle Frage ist keine Bilderkennen-Frage.')
    }
    return null
  }

  /** Timed transition with a defined fallback time (specification 22.1). */
  /**
   * Put a phase change on the clock.
   *
   * `still` separates two things that used to be one: the TIMER and the
   * PRESENTATION TRANSITION. Normally they belong together - the change from
   * feedback to solution is both. Where they must not be, the clock runs
   * without an animation: the stage client keys its scene node to the id of
   * the last transition, so a new id rebuilds the scene, and a section that is
   * merely waiting out its time would be rebuilt underneath whoever is looking
   * at it.
   */
  scheduleTimedTransition(
    nextPhase: GamePhase,
    durationMs: number,
    transitionId: string,
    options: { still?: boolean } = {},
  ): void {
    this.mutate((draft) => {
      const id = `${transitionId}:${this.ctx.newId('transition')}`
      draft.pendingTransition = { nextPhase, endsAtMs: this.ctx.nowMs + durationMs, transitionId: id }
      if (!options.still) {
        draft.lastTransition = { transitionId: id, startedAtServerMs: this.ctx.nowMs, durationMs }
      }
    })
  }

  commit(): EngineResult {
    if (!this.state) throw new Error('commit ohne Zustand')
    this.state.revision += 1
    this.state.updatedAtMs = this.ctx.nowMs
    return { ok: true, state: this.state, events: this.events, effects: this.effects }
  }
}

export { attemptsForCurrentQuestion, pendingAttempt }
