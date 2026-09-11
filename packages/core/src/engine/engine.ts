/**
 * Autoritative Zustandsmaschine (Spezifikation 18).
 *
 * Diese Datei ist die einzige Stelle, an der Phasenwechsel stattfinden. Sie ist rein:
 * Zeit, Zufall, IDs und der Zugriff auf den Fragenpool werden ueber `EngineContext`
 * injiziert. Dadurch laufen alle Regeltests ohne Electron, React, Netzwerk oder echte
 * Systemzeit.
 *
 * Vertrag:
 *   reduce(state, command, ctx) -> akzeptiert (neuer Zustand + Ereignisse + Effekte)
 *                                | abgelehnt (Grund + Klartextmeldung)
 *
 * Die Engine erhoeht bei jeder Annahme `revision`. Idempotenz gegen doppelte
 * Netzwerkbefehle stellt der Server ueber die `commandId` sicher (Spezifikation 18.4);
 * zusaetzlich schuetzt die Engine strukturell, weil ein bereits ausgewerteter Versuch
 * nicht erneut ausgewertet werden kann.
 */
import {
  createPlayerLifelines,
  defaultLifelineConfig,
  gameTiming,
  isChoiceQuestion,
  isImageReveal,
  isSelfServiceAnswerable,
  lifelinesOf,
  playerIds,
  scoringRules,
  selfServiceTiming,
  type AnswerAttempt,
  type LifelineConfig,
  type LifelineType,
  type Command,
  type CommandRejection,
  type FlowProfile,
  type GamePhase,
  type GameState,
  type PlayerCount,
  type PlayerId,
  type PlayerState,
  type RuntimeQuestion,
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
  evaluateLifelineRestore,
  evaluateLifelineUse,
  lifelineLabel,
  pickFiftyFiftyHiddenOptions,
} from './lifelines'

/* ------------------------------------------------------------------ *
 * Ports und Ergebnisstruktur
 * ------------------------------------------------------------------ */

/** Anfrage der Engine an die Anwendungsschicht: Frage fuer einen Fragenplatz ziehen. */
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
 * Zugriff auf Inhalt und Nutzungshistorie. Die Engine kennt weder Dateisystem noch
 * SQLite; der Server implementiert diesen Port (Abhaengigkeitsrichtung Spezifikation 20.4).
 */
export interface QuestionSource {
  /** Anzahl Fragenplaetze der Kombination, oder `null` wenn sie nicht existiert. */
  slotCountFor(audience: string, presetId: string): number | null
  selectForSlot(request: SlotRequest): SlotResponse
}

export interface EngineContext {
  nowMs: number
  eventDayId: string
  /** Erzeugt stabile IDs (Spiel, Versuch, Uebergang). */
  newId: (prefix: string) => string
  questionSource: QuestionSource
  timing?: typeof gameTiming
  selfServiceTiming?: SelfServiceTiming
  /** Globaler Soundstatus, den ein neu gestartetes Spiel uebernimmt. */
  initialSoundEnabled?: boolean
  /** Sprache des Geraets, die ein neu gestartetes Spiel uebernimmt. */
  initialLocale?: string
  /**
   * What this installation offers in the way of lifelines (see
   * `contracts/lifelines.ts`). Missing means none - the engine then refuses
   * every lifeline command and nothing else changes.
   */
  lifelines?: LifelineConfig
  /**
   * Source of chance for decisions the engine itself makes - currently only the
   * one wrong answer the 50:50 leaves standing. Injected so a test can hand in
   * a fixed sequence instead of luck.
   */
  random?: () => number
}

export interface DomainEvent {
  category: 'game' | 'buzzer' | 'answer' | 'score' | 'phase' | 'content' | 'system'
  message: string
  data?: Record<string, unknown>
}

/** Punktebuchung, die der Server in derselben Transaktion persistieren muss. */
export interface ScoreTransaction {
  playerId: PlayerId
  delta: number
  newScore: number
  reason: string
  attemptId?: string
}

/** Nutzungseintrag der globalen Wiederholungshistorie (Spezifikation 17.3). */
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
  const work = new Draft(state, ctx, timing, ctx.selfServiceTiming ?? selfServiceTiming)

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
       * Wie beim Ton: Laeuft ein Spiel, wechselt es mit - die Fragen sind
       * dieselben, nur die Sprache ist eine andere. Laeuft keines, gibt es
       * nichts, worin der Befehl stehen koennte; dann traegt ihn die
       * Anwendungsschicht (siehe `QuizService`).
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
      // Ein abgebrochenes Spiel zeigt bewusst keine automatische Gewinneransicht.
      work.log('game', 'Spiel abgebrochen. Es wird kein Ergebnis angezeigt.')
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
       * Erst hier oeffnet der Buzzer. Vorher steht das Bild unscharf, damit der
       * Moderator die Frage in Ruhe vorlesen kann - ein Buzzern waere sonst ein
       * Zufallstreffer auf ein Bild, das noch niemand gesehen hat.
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
        // Vollstaendige Enthuellung sperrt den Buzzer ausdruecklich NICHT.
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
      // Technische Korrekturaktion, bewusst getrennt von "Buzzer zuruecksetzen".
      work.log('system', 'Enthüllung technisch auf den Anfang zurückgesetzt.')
      return work.commit()
    }

    case 'START_VIDEO':
    case 'PAUSE_VIDEO':
    case 'RESTART_VIDEO':
    case 'REPORT_VIDEO_STATUS':
    case 'SHOW_QUESTION_AFTER_VIDEO':
      return handleVideoCommand(work, command)

    case 'USE_LIFELINE':
      return useLifeline(work, command.playerId, command.lifelineType)

    case 'RESTORE_LIFELINE':
      return restoreLifeline(work, command.playerId, command.lifelineType)

    case 'ADJUST_SCORE': {
      if (!work.state) return reject('no-active-game', 'Es läuft gerade kein Spiel.')
      if (work.state.status === 'aborted') {
        return reject('invalid-phase', 'Ein abgebrochenes Spiel kann nicht mehr korrigiert werden.')
      }
      const step = command.direction === 'increase' ? scoringRules.manualAdjustmentStep : -scoringRules.manualAdjustmentStep
      const player = work.state.players.find((entry) => entry.id === command.playerId)
      if (!player) return reject('invalid-payload', 'Unbekannter Spieler.')
      const { score, effectiveDelta } = applyScoreDelta(player.score, step)
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

    case 'RESUME_GAME':
    case 'DISCARD_RESUMABLE_GAME':
    case 'START_NEW_EVENT_DAY':
    case 'RESET_GAME_STATISTICS':
    case 'APPLY_QUESTION_PATCH':
      // Betriebs- und Wiederherstellungsbefehle sind bewusst keine Spielregeln.
      // Sie werden in der Anwendungsschicht (`@quiz/runtime`) behandelt, weil sie
      // Inhalt, Datenbank und Veranstaltungstag betreffen - nicht den Spielablauf.
      return reject('unknown-command', 'Dieser Befehl wird nicht von der Spiel-Engine verarbeitet.')

    default: {
      const exhaustive: never = command
      void exhaustive
      return reject('unknown-command', 'Unbekannter Befehl.')
    }
  }
}

/* ------------------------------------------------------------------ *
 * Befehlsimplementierungen
 * ------------------------------------------------------------------ */

function startGame(
  work: Draft,
  command: {
    audience: string
    poolIds?: string[]
    presetId: string
    playerCount?: PlayerCount
    playerLabels?: string[]
    flowProfile?: FlowProfile
  },
): EngineResult {
  const { audience, poolIds, presetId, playerLabels } = command
  if (work.state && work.state.status === 'active') {
    return reject('invalid-phase', 'Es läuft bereits ein Spiel. Bitte zuerst beenden.')
  }
  const slotCount = work.ctx.questionSource.slotCountFor(audience, presetId)
  if (slotCount === null) {
    return reject('invalid-payload', 'Diese Kombination aus Zielgruppe und Schwierigkeits-Preset gibt es nicht.')
  }

  // Ohne Angabe ist ein Spiel ein Duell. Der Buehnenbetrieb bleibt damit
  // unveraendert, ohne dass er die Spielerzahl mitschicken muss.
  const playerCount: PlayerCount = command.playerCount ?? 2
  // Ohne Angabe steuert ein Mensch - der Buehnenbetrieb bleibt damit unveraendert.
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
    // Der globale Soundstatus bleibt ueber Spiele hinweg erhalten.
    soundEnabled: work.ctx.initialSoundEnabled ?? work.state?.soundEnabled ?? true,
    // Ebenso die Sprache: Sie gehoert dem Geraet und ueberdauert das einzelne Spiel.
    ...(work.ctx.initialLocale ?? work.state?.locale
      ? { locale: work.ctx.initialLocale ?? work.state?.locale }
      : {}),
    updatedAtMs: work.ctx.nowMs,
  }

  work.replaceState(fresh)
  const poolNote = poolIds?.length ? `, Pools ${poolIds.join('+')}` : ''
  work.log('game', `Spiel gestartet: Zielgruppe "${audience}"${poolNote}, Preset "${presetId}", ${slotCount} Fragen.`)

  const selection = drawQuestionForCurrentSlot(work, [])
  if (!selection.ok) return selection.rejection

  // Der Pausen-/Logoscreen laeuft als kurze eigene Praesentationsphase an; danach
  // uebernimmt derselbe Weg wie zwischen zwei Fragen (keine zweite Ablauflogik).
  work.scheduleTimedTransition(questionEntryPhase(work.state!), work.timing.pauseScreenMs, 'pause-to-question')
  return work.commit()
}

/* ------------------------------------------------------------------ *
 * Lifelines
 *
 * Both commands do the same three things in the same order: ask the rules
 * (`evaluateLifelineUse` / `evaluateLifelineRestore`), change the state, write
 * one line into the log. The rules live in `lifelines.ts` because the operator's
 * view asks them too - a greyed-out button and a refused command must never
 * disagree.
 * ------------------------------------------------------------------ */

function useLifeline(work: Draft, playerId: PlayerId, type: LifelineType): EngineResult {
  const config = work.ctx.lifelines ?? defaultLifelineConfig
  const decision = evaluateLifelineUse(work.state, config, playerId, type)
  if (!decision.allowed) return reject(decision.reason, decision.message)

  const state = work.state!
  const label = state.players.find((player) => player.id === playerId)!.label
  const questionId = state.currentQuestion!.question.id

  /*
   * The 50:50 draws its survivor BEFORE anything is written: if the draw were
   * to come up empty - it cannot here, the rules guarantee three options, but
   * the shape allows it - the lifeline must stay unspent. A lifeline that is
   * marked used and hides nothing is the one outcome a player would rightly
   * complain about.
   */
  let hiddenOptionIds: string[] = []
  if (type === 'fiftyFifty') {
    hiddenOptionIds = pickFiftyFiftyHiddenOptions({
      correctOptionId: state.currentQuestion!.question.correctOptionId!,
      optionOrder: state.currentQuestion!.optionOrder,
      random: work.ctx.random ?? Math.random,
    })
    if (hiddenOptionIds.length === 0) {
      return reject('lifeline-not-applicable', 'Diese Frage hat keine Antwort, die sich ausblenden ließe.')
    }
  }

  work.mutate((draft) => {
    for (const player of draft.players) {
      if (player.id !== playerId) continue
      /*
       * Written through `lifelinesOf` and not into `player.lifelines![type]`:
       * a game resumed from a save without the field would otherwise index into
       * nothing. This way the whole set is created on first write.
       */
      player.lifelines = {
        ...lifelinesOf(player),
        [type]: { used: true, usedAtQuestionId: questionId, usedAtMs: work.ctx.nowMs },
      }
    }
    if (type === 'fiftyFifty') {
      draft.activeFiftyFifty = { playerId, questionId, hiddenOptionIds }
    }
  })

  const detail =
    type === 'fiftyFifty' ? ` Ausgeblendet: ${hiddenOptionIds.length} Antwort(en).` : ''
  work.log('game', `${label} setzt den ${lifelineLabel(type)} ein.${detail}`, {
    lifeline: type,
    playerId,
    questionId,
    ...(type === 'fiftyFifty' ? { hiddenOptionIds } : {}),
  })
  return work.commit()
}

/**
 * The operator's undo.
 *
 * Two cases, one command: while the question is still on screen the removed
 * answers come back, because the effect belongs to that question and is cleared
 * with it. After the question has moved on there is nothing to bring back - the
 * restore then only hands the lifeline back for a later question. The condition
 * below is exactly that distinction, and it needs no phase check: an effect
 * that survived is by definition the current question's.
 */
function restoreLifeline(work: Draft, playerId: PlayerId, type: LifelineType): EngineResult {
  const config = work.ctx.lifelines ?? defaultLifelineConfig
  const decision = evaluateLifelineRestore(work.state, config, playerId, type)
  if (!decision.allowed) return reject(decision.reason, decision.message)

  const state = work.state!
  const label = state.players.find((player) => player.id === playerId)!.label
  const undoesEffect =
    type === 'fiftyFifty' && state.activeFiftyFifty?.playerId === playerId

  work.mutate((draft) => {
    for (const player of draft.players) {
      if (player.id !== playerId) continue
      player.lifelines = { ...lifelinesOf(player), [type]: { used: false } }
    }
    if (undoesEffect) draft.activeFiftyFifty = undefined
  })

  const detail = undoesEffect ? ' Die ausgeblendeten Antworten sind wieder sichtbar.' : ''
  work.log('game', `${lifelineLabel(type)} von ${label} wiederhergestellt.${detail}`, {
    lifeline: type,
    playerId,
    restoredEffect: undoesEffect,
  })
  return work.commit()
}

function acceptPlayer(work: Draft, playerId: PlayerId, via: 'hardware' | 'manual'): EngineResult {
  if (!work.state) return reject('no-active-game', 'Es läuft gerade kein Spiel.')
  const decision = evaluateBuzz(work.state, playerId)
  if (!decision.allowed) {
    // Abgewiesene Ereignisse werden protokolliert - inklusive Auto-Repeat der Tastatur.
    return reject(decision.reason ?? 'buzzer-closed', decision.message ?? 'Buzzer nicht möglich.')
  }

  claimPlayer(work, playerId, via)
  return work.commit()
}

/**
 * Der Zuschlag selbst - ohne Commit, getrennt von der Zulaessigkeitspruefung.
 * Die Pruefung, ob der Zuschlag erlaubt ist, steht in `evaluateBuzz` und
 * passiert VOR diesem Aufruf.
 */
function claimPlayer(work: Draft, playerId: PlayerId, via: 'hardware' | 'manual'): void {
  const label = work.state!.players.find((player) => player.id === playerId)!.label
  const wasRevealRunning = work.phase === 'reveal-running'

  work.mutate((draft) => {
    draft.buzzer = { open: false, acceptedPlayerId: playerId, acceptedAtMs: work.ctx.nowMs, acceptedVia: via }
    // Ein gueltiger Buzzer friert die Enthuellung sofort ein, damit der andere
    // Spieler waehrend der Antwort keinen Informationsvorteil bekommt.
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
     * Eine bereits als falsch bewertete Option ist verbraucht. Sie in der zweiten
     * Chance erneut einzuloggen koennte nur zu einem zweiten "falsch" fuehren -
     * der Operator sieht sie deshalb gesperrt, und der Server haelt die Regel.
     */
    const alreadyWrong = attemptsForCurrentQuestion(work.state).some(
      (attempt) => attempt.outcome === 'incorrect' && attempt.loggedOptionId === input.optionId,
    )
    if (alreadyWrong) {
      return reject('option-already-answered', 'Diese Antwort wurde bereits als falsch bewertet.')
    }
  }

  work.mutate((draft) => {
    const target = draft.attempts.find((entry) => entry.id === attempt.id)!
    if (input.optionId !== undefined) {
      target.loggedOptionId = input.optionId
      target.loggedManualVerdict = undefined
    }
    if (input.verdict !== undefined) {
      target.loggedManualVerdict = input.verdict
      target.loggedOptionId = undefined
    }
  })
  const description =
    input.optionId !== undefined
      ? `Option "${question.options?.find((option) => option.id === input.optionId)?.text ?? input.optionId}" eingeloggt.`
      : `Manuelle Bewertung "${input.verdict === 'correct' ? 'richtig' : 'falsch'}" vorgemerkt.`
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
    // Explizite richtige Antwort: verglichen wird immer gegen `correctOptionId`,
    // niemals gegen eine Position in der Optionsliste.
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
    // Ein bereits laufender Versuch (z. B. zweite Chance) wird als "gepasst" gewertet.
    return finishAttempt(work, existing, 'passed')
  }

  // Ohne Buzzer und ohne Antwort: neutraler Versuch ohne Spieler, keine Punkte.
  let created: AnswerAttempt | undefined
  work.mutate((draft) => {
    created = createAttempt(work, draft, null)
    draft.attempts.push(created)
  })
  return finishAttempt(work, created!, 'no-answer')
}

/**
 * Wertet einen Versuch verbindlich aus, bucht ggf. Punkte und startet die
 * Feedbacksequenz (Spezifikation 13.1).
 *
 * Punkte werden hier genau einmal vergeben: `outcome` ist danach gesetzt und
 * `pendingAttempt` findet den Versuch nicht mehr, ein zweiter Aufruf wird also
 * bereits vor der Buchung abgewiesen.
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
  const points = outcome === 'correct' ? pointsForCorrectAnswer(previousFailures) : scoringRules.noPoints

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
      const { score } = applyScoreDelta(player.score, points)
      player.score = score
    }

    // Bei normalen Fragen ist der Spieler nach einer falschen ersten Antwort fuer
    // diese Frage gesperrt. Beim Bilderkennen wird nie gesperrt - dort sind
    // unbegrenzt viele Fehlversuche erlaubt und beide duerfen erneut buzzern.
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

  // Naechste Phase bestimmen und die Feedbacksequenz mit definierter Fallbackzeit starten.
  const nextPhase = nextPhaseAfterAttempt(work, outcome, attempt, imageReveal)
  if (outcome === 'correct' || outcome === 'incorrect') {
    const feedbackMs = outcome === 'correct' ? work.timing.correctFeedbackMs : work.timing.incorrectFeedbackMs
    const extra = nextPhase === 'solution' ? work.timing.solutionDelayMs : 0
    work.mutate((draft) => {
      draft.phase = 'attempt-feedback'
    })
    work.scheduleTimedTransition(nextPhase, feedbackMs + extra, `feedback-${outcome}`)
  } else {
    // Passen und Aufloesen ohne Antwort brauchen keine Richtig-/Falsch-Animation.
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
  // Bilderkennen: Loesung bleibt verborgen, die Enthuellung laeuft an derselben
  // Stelle weiter, beide Spieler duerfen erneut buzzern.
  if (imageReveal) return 'reveal-running'
  // Normale Frage: nach dem ersten Fehlversuch bekommt der andere Spieler die
  // zweite Chance; nach dem zweiten Fehlversuch folgt die Loesung.
  // Im Einzelspiel gibt es keinen anderen Spieler - dort folgt sofort die Loesung.
  const opponent = eligibleOpponent(work.state!, attempt.playerId)
  return attempt.attemptNumber === 1 && opponent ? 'second-chance' : 'solution'
}

function resetBuzzer(work: Draft): EngineResult {
  if (!work.state) return reject('no-active-game', 'Es läuft gerade kein Spiel.')
  const question = work.state.currentQuestion
  if (!question) return reject('invalid-phase', 'Es ist gerade keine Frage aktiv.')

  if (work.phase === 'second-chance') {
    // In der zweiten Chance gibt es keine Buzzer-Zuordnung; zurueckgesetzt wird
    // nur die bereits eingeloggte Antwort.
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
    // Offenen, noch nicht ausgewerteten Versuch verwerfen.
    const open = draft.attempts.findIndex((entry) => entry.outcome === undefined)
    if (open >= 0) draft.attempts.splice(open, 1)
    draft.buzzer = { open: true }
    // Sperren aus bereits ausgewerteten Fehlversuchen bleiben bestehen - sie sind
    // eine Spielregel, keine Buzzer-Zuordnung.
    draft.phase = isImageReveal(question.question.questionType)
      ? draft.reveal?.status === 'paused'
        ? 'reveal-paused'
        : 'reveal-running'
      : 'buzzer-open'
  })
  work.log('buzzer', 'Buzzer zurückgesetzt und erneut freigegeben.')
  return work.commit()
}

function handleVideoCommand(work: Draft, command: Command): EngineResult {
  if (!work.state) return reject('no-active-game', 'Es läuft gerade kein Spiel.')
  const question = work.state.currentQuestion
  if (!question || question.question.questionType !== 'video-then-question') {
    return reject('invalid-phase', 'Die aktuelle Frage ist keine Videofrage.')
  }

  switch (command.type) {
    case 'START_VIDEO': {
      if (!['video-ready', 'video-playing'].includes(work.phase)) {
        return reject('invalid-phase', 'Das Video kann in dieser Phase nicht gestartet werden.')
      }
      work.mutate((draft) => {
        draft.video = { ...draft.video!, status: 'playing', startedAtServerMs: work.ctx.nowMs }
        draft.phase = 'video-playing'
        // Waehrend des Videos darf nicht gebuzzert werden.
        draft.buzzer = { open: false }
      })
      work.log('phase', 'Video gestartet.')
      // Ist die Laufzeit schon bekannt, steht damit auch das Ende fest.
      scheduleVideoEnd(work, false, true)
      return work.commit()
    }
    case 'PAUSE_VIDEO': {
      if (work.phase !== 'video-playing') return reject('invalid-phase', 'Das Video läuft gerade nicht.')
      work.mutate((draft) => {
        const video = draft.video!
        const elapsed = video.startedAtServerMs ? work.ctx.nowMs - video.startedAtServerMs : 0
        draft.video = { ...video, status: 'paused', positionMs: video.positionMs + elapsed, startedAtServerMs: undefined }
        draft.phase = 'video-ready'
        /*
         * Der Zeitgeber gehoert zum laufenden Video. Bleibt er stehen, zeigt der
         * Saal die Frage, waehrend der Operator gerade angehalten hat, um etwas
         * zu sagen.
         */
        draft.pendingTransition = undefined
      })
      work.log('phase', 'Video pausiert.')
      return work.commit()
    }
    case 'RESTART_VIDEO': {
      if (!['video-ready', 'video-playing'].includes(work.phase)) {
        return reject('invalid-phase', 'Das Video kann in dieser Phase nicht neu gestartet werden.')
      }
      work.mutate((draft) => {
        draft.video = { ...draft.video!, status: 'playing', positionMs: 0, startedAtServerMs: work.ctx.nowMs }
        draft.phase = 'video-playing'
        draft.buzzer = { open: false }
      })
      work.log('phase', 'Video neu gestartet.')
      scheduleVideoEnd(work, false, true)
      return work.commit()
    }
    case 'REPORT_VIDEO_STATUS': {
      work.mutate((draft) => {
        draft.video = {
          ...draft.video!,
          durationMs: command.durationMs ?? draft.video!.durationMs,
          error: command.error ?? undefined,
        }
        if (command.error) {
          draft.video!.status = 'idle'
          draft.phase = 'video-ready'
        }
      })
      if (command.error) {
        work.log(
          'system',
          `Video konnte nicht abgespielt werden: ${command.error}. Frage überspringen oder ohne Video weiterfuehren.`,
        )
      }
      scheduleVideoEnd(work, command.error !== undefined)
      return work.commit()
    }
    case 'SHOW_QUESTION_AFTER_VIDEO': {
      if (!['video-ready', 'video-playing'].includes(work.phase)) {
        return reject('invalid-phase', 'Die Videophase ist nicht aktiv.')
      }
      work.mutate((draft) => {
        const video = draft.video!
        const elapsed = video.startedAtServerMs ? work.ctx.nowMs - video.startedAtServerMs : 0
        draft.video = {
          ...video,
          status: 'ended',
          positionMs: video.positionMs + elapsed,
          startedAtServerMs: undefined,
        }
        // Zwei Phasen derselben Frage, nicht zwei unabhaengige Fragen.
        draft.phase = 'question-presented'
      })
      work.log('phase', 'Videophase beendet, Frage eingeblendet.')
      return work.commit()
    }
    default:
      return reject('unknown-command', 'Unbekannter Videobefehl.')
  }
}

function handleContinue(work: Draft): EngineResult {
  const guard = work.requireActiveGame()
  if (guard) return guard

  if (work.phase === 'result') {
    return reject('invalid-phase', 'Das Spiel ist beendet. Ueber "Beenden" geht es zurück zur Startansicht.')
  }
  if (work.phase !== 'solution') {
    // `Weiter` bedeutet immer dasselbe und darf niemals "Antwort bewerten" oder
    // "zweiten Spieler freigeben" bedeuten - dafuer gibt es eigene Befehle.
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
     * Ohne Operator gibt es niemanden, der auf eine gescheiterte Auswahl
     * reagieren koennte. Ein stehengebliebener Bildschirm waere das schlechteste
     * Ergebnis, deshalb endet das Spiel hier mit dem, was gespielt wurde.
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
 * Beendet ein Selbstbedienungsspiel, fuer das keine beantwortbare Frage mehr
 * gefunden wurde. Gewertet wird, was gespielt wurde.
 *
 * `totalQuestions` bleibt die Zahl der Fragenplaetze des Presets; wie viele Fragen
 * tatsaechlich gestellt wurden, leitet das Ergebnis aus den Versuchen ab.
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
    'video-ready',
    'video-playing',
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
    // Doppelte oder verspaetete Meldungen laufen hier ins Leere - ein schneller
    // Doppelklick kann keinen Uebergang zweimal ausloesen.
    return reject('invalid-phase', 'Dieser Uebergang ist bereits abgeschlossen.')
  }
  // Aus der Loesung heraus ist der faellige Uebergang kein Phasenwechsel, sondern
  // dieselbe Entscheidung wie "Weiter": naechste Frage ziehen oder Ergebnis zeigen.
  if (work.phase === 'solution') return handleContinue(work)

  applyPhase(work, pending.nextPhase)
  return work.commit()
}

/* ------------------------------------------------------------------ *
 * Phasenuebergaenge
 * ------------------------------------------------------------------ */

/**
 * Notbremse fuer die Suche nach einer beantwortbaren Frage im
 * Selbstbedienungsbetrieb. Regulaer endet die Suche von selbst, weil bereits
 * gezogene Fragen ausgeschlossen werden und die Fragenplaetze zu Ende gehen.
 */
const MAX_SELF_SERVICE_DRAWS = 200

/** In welcher Phase startet die aktuelle Frage nach dem Pausenscreen? */
function questionEntryPhase(state: GameState): GamePhase {
  const type = state.currentQuestion?.question.questionType
  if (type === 'video-then-question') return 'video-ready'
  /*
   * Bei Selbstbedienung gibt es niemanden, der die Frage vorliest und danach
   * freigibt. Die Frage steht deshalb trotzdem erst allein da - nur gibt sie
   * nicht der Operator frei, sondern eine feste Frist (`questionLeadInMs`).
   * Es sind dieselben Phasen; ersetzt ist allein der Ausloeser.
   *
   * Die Enthuellung laeuft dagegen sofort an: Dort IST das Bild die Frage, und
   * eine Wartezeit davor zeigte nur ein verdecktes Bild ohne Aufgabe.
   */
  const selfService = state.flowProfile === 'self-service'
  if (type === 'image-reveal') return selfService ? 'reveal-running' : 'reveal-ready'
  return 'question-presented'
}

/**
 * Setzt die Zielphase eines zeitgesteuerten Uebergangs um.
 *
 * Wichtig: Diese Funktion setzt keine frageweiten Daten zurueck. Der Reset pro Frage
 * passiert ausschliesslich in `drawQuestionForCurrentSlot`, damit "Enthuellung nach
 * Fehlversuch fortsetzen" und "neue Bildfrage beginnen" denselben Code teilen koennen,
 * ohne dass der Fortschritt versehentlich verloren geht.
 */
function applyPhase(work: Draft, phase: GamePhase): void {
  applyPhaseMutation(work, phase)
  /*
   * Faellt der Uebergang IN die Videophase, steht das Ende der Videophase damit
   * schon fest - sofern die Laufzeit gemeldet ist. Geplant wird danach, weil
   * `applyPhaseMutation` den offenen Uebergang zu Beginn abraeumt.
   */
  if (phase === 'video-playing') scheduleVideoEnd(work, false, true)
}

function applyPhaseMutation(work: Draft, phase: GamePhase): void {
  work.mutate((draft) => {
    draft.pendingTransition = undefined
    switch (phase) {
      case 'solution': {
        draft.phase = 'solution'
        draft.buzzer = { open: false }
        // Nach richtiger Antwort oder manuellem Aufloesen ist das Bild vollstaendig scharf.
        if (draft.reveal) draft.reveal = completeReveal(draft.reveal)
        if (draft.video && draft.video.status === 'playing') {
          draft.video = { ...draft.video, status: 'ended', startedAtServerMs: undefined }
        }
        break
      }
      case 'second-chance': {
        draft.phase = 'second-chance'
        draft.buzzer = { open: false }
        break
      }
      case 'reveal-running': {
        // Sowohl "Bildfrage beginnt" als auch "Enthuellung nach Fehlversuch fortsetzen".
        draft.phase = 'reveal-running'
        draft.reveal = resumeReveal(draft.reveal ?? createRevealClock(work.timing.imageRevealDurationMs), work.ctx.nowMs)
        draft.buzzer = { open: true }
        break
      }
      case 'reveal-ready': {
        // Bild steht unscharf, die Uhr laeuft noch nicht - und der Buzzer ist zu.
        draft.phase = 'reveal-ready'
        draft.reveal = draft.reveal ?? createRevealClock(work.timing.imageRevealDurationMs)
        draft.buzzer = { open: false }
        break
      }
      case 'buzzer-open': {
        // Bei Selbstbedienung wird diese Phase automatisch angesteuert; der Buzzer
        // muss dabei genauso oeffnen wie beim Befehl des Operators.
        draft.phase = 'buzzer-open'
        draft.buzzer = { open: true }
        // Folgt die Frage auf ein Video, ist das Video damit beendet.
        if (draft.video?.status === 'playing') {
          const elapsed = draft.video.startedAtServerMs ? work.ctx.nowMs - draft.video.startedAtServerMs : 0
          draft.video = {
            ...draft.video,
            status: 'ended',
            positionMs: draft.video.positionMs + elapsed,
            startedAtServerMs: undefined,
          }
        }
        break
      }
      case 'video-playing': {
        draft.phase = 'video-playing'
        draft.buzzer = { open: false }
        if (draft.video) {
          draft.video = { ...draft.video, status: 'playing', startedAtServerMs: work.ctx.nowMs }
        }
        // Das Ende wird unten geplant - erst muss die neue Phase stehen.
        break
      }
      case 'question-presented': {
        draft.phase = 'question-presented'
        draft.buzzer = { open: false }
        // Folgt die Frage auf ein Video, ist das Video damit beendet.
        if (draft.video?.status === 'playing') {
          const elapsed = draft.video.startedAtServerMs ? work.ctx.nowMs - draft.video.startedAtServerMs : 0
          draft.video = {
            ...draft.video,
            status: 'ended',
            positionMs: draft.video.positionMs + elapsed,
            startedAtServerMs: undefined,
          }
        }
        break
      }
      case 'video-ready': {
        draft.phase = 'video-ready'
        draft.buzzer = { open: false }
        break
      }
      default:
        draft.phase = phase
    }
  })

  // Die zweite Chance bekommt sofort einen offenen Versuch fuer den noch nicht
  // gesperrten Spieler - erneutes Buzzern ist dafuer nicht erforderlich.
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
 * Uebergaenge, die im Selbstbedienungsprofil niemand von Hand ausloest.
 *
 * Es entsteht dabei keine neue Mechanik: Es sind dieselben zeitgesteuerten
 * Uebergaenge mit serverseitiger Fallbackzeit, die es fuer Feedback und
 * Pausenscreen schon gibt. Nur der Ausloeser fehlt - deshalb plant ihn der Server.
 */
function scheduleSelfServiceFollowUp(work: Draft, phase: GamePhase): void {
  const state = work.state
  if (!state || state.flowProfile !== 'self-service' || state.status !== 'active') return

  if (phase === 'question-presented') {
    /*
     * Erst die Frage, dann die Antworten. Der Server schickt die Optionen
     * waehrend dieser Frist gar nicht mit (`projection.ts`), und der Buzzer ist
     * zu - es gibt also nichts zu treffen, bevor jemand gelesen hat.
     */
    work.scheduleTimedTransition('buzzer-open', work.selfServiceTiming.questionLeadInMs, 'question-to-answers')
    return
  }

  /*
   * NACH DER LOESUNG PLANT DER SERVER NICHTS. Weiter geht es allein durch
   * `CONTINUE` eines Spielers - dieselbe Entscheidung wie beim "Weiter" des
   * Operators. Ein eingeplanter Uebergang naehme dem, der gerade liest, warum
   * seine Antwort falsch war, das Bild unter den Augen weg.
   */

  if (phase === 'video-ready') {
    // Ohne Operator startet das Video von selbst, nach kurzem Vorlauf.
    work.scheduleTimedTransition('video-playing', work.selfServiceTiming.videoLeadInMs, 'video-auto-start')
  }
}

/**
 * Wann endet die Videophase?
 *
 * EIN DURCHGELAUFENES VIDEO GEHT VON SELBST IN DIE FRAGE UEBER - im Saal wie am
 * Geraet. Ein schwarzes Bild, das stehen bleibt, bis jemand weiterschaltet, ist
 * in beiden Faellen ein Ausfall; der Operator behaelt seinen Knopf, um frueher
 * umzuschalten, muss ihn aber nicht mehr suchen.
 *
 * Der Server hat keine eigene Sicht auf das Medium, deshalb plant er den Wechsel
 * aus der Laufzeit, die der Client meldet. Massgeblich bleibt trotzdem der
 * serverseitige Timer - eine ausbleibende Meldung des Browsers kann den Ablauf
 * nicht anhalten.
 *
 * NUR DER FEHLERFALL BLEIBT GETEILT: Laesst sich das Video gar nicht abspielen,
 * springt die Selbstbedienung sofort zur Frage, weil dort niemand steht, der
 * reagieren koennte. Im gefuehrten Spiel entscheidet der Operator - er sieht die
 * Meldung und kann die Frage ueberspringen.
 */
function scheduleVideoEnd(work: Draft, hasError: boolean, erzwinge = false): void {
  const state = work.state
  if (!state || state.status !== 'active') return
  if (!['video-ready', 'video-playing'].includes(state.phase)) return

  if (hasError) {
    if (state.flowProfile !== 'self-service') return
    work.scheduleTimedTransition('question-presented', 0, 'video-error-to-question', { still: true })
    return
  }

  const video = state.video
  if (state.phase !== 'video-playing' || !video?.durationMs) return

  /*
   * STEHT DAS ENDE SCHON, BLEIBT ES STEHEN.
   *
   * Die Laufzeit meldet JEDER Client, der das Video zeigt - Buehne, zweiter
   * Praesentationsschirm, Touchgeraet. Wuerde jede Meldung neu planen, liefe
   * bei zwei Fenstern ein Wettlauf: Zwei Meldungen, zwei neue Plaene, und der
   * faellige Zeitpunkt ruecke bei jedem Durchlauf ein Stueck weiter.
   *
   * Nur ein Befehl plant neu (`erzwinge`) - Starten, Fortsetzen, Zuruecksetzen.
   * Eine Statusmeldung ist keine Entscheidung, sondern eine Beobachtung.
   */
  const steht = state.pendingTransition?.nextPhase === 'question-presented'
  if (steht && !erzwinge) return

  const played = video.positionMs + (video.startedAtServerMs ? work.ctx.nowMs - video.startedAtServerMs : 0)
  const remainingMs = Math.max(0, video.durationMs - played)
  work.scheduleTimedTransition('question-presented', remainingMs + work.timing.videoTailMs, 'video-to-question', {
    still: true,
  })
}

/**
 * Zieht die Frage fuer den aktuellen Fragenplatz und setzt alle frageweiten
 * Laufzeitdaten zurueck (Sperren, Buzzer, Enthuellung, Video).
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
   * Selbstbedienung: Eine Frage, die nur ein Mensch bewerten kann - eine
   * muendliche Antwort - laesst sich am Touchgeraet nicht aufloesen. Sie wuerde
   * den Ablauf anhalten, weil niemand da ist, der ihn beenden koennte.
   *
   * Deshalb wird sie wie eine uebersprungene Frage behandelt. Taugt der ganze
   * Fragenplatz nicht - ein Preset mit einem reinen Bilderkennen-Platz ist genau
   * dieser Fall -, wird der Platz uebersprungen und der naechste versucht.
   *
   * Verhindern soll beides die Inhaltsvalidierung: Ein Kiosk-Preset filtert auf
   * auswertbare Fragen. Diese Stelle ist das Sicherheitsnetz, nicht der Plan -
   * und sie schweigt nicht, sondern schreibt jeden Fall ins Protokoll.
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

      // Der ganze Fragenplatz taugt nicht. Gibt es keinen weiteren, entscheidet
      // der Aufrufer, was das bedeutet: kein Spielstart bzw. vorzeitiges Ende.
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
    // Eine uebersprungene Frage bleibt fuer dieses Spiel gesperrt, damit sie nicht
    // direkt wieder gezogen wird.
    for (const excluded of exclusions) {
      if (!draft.selectedQuestionIds.includes(excluded)) draft.selectedQuestionIds.push(excluded)
    }
    draft.currentQuestion = runtime
    draft.selectedQuestionIds.push(runtime.question.id)
    const groupId = runtime.question.repetitionGroupId
    if (groupId && !draft.selectedRepetitionGroupIds.includes(groupId)) {
      draft.selectedRepetitionGroupIds.push(groupId)
    }
    // Frageweiter Reset - genau eine Stelle.
    for (const player of draft.players) player.lockedForCurrentQuestion = false
    /*
     * The 50:50 effect dies with the question - here, at the one place a new
     * question arrives. The player's SPENT lifeline is not touched: it lives on
     * the player and survives until a new game starts.
     */
    draft.activeFiftyFifty = undefined
    draft.buzzer = { open: false }
    draft.reveal = isImageReveal(runtime.question.questionType)
      ? createRevealClock(work.timing.imageRevealDurationMs)
      : undefined
    draft.video =
      runtime.question.questionType === 'video-then-question'
        ? { status: 'idle', positionMs: 0 }
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
 * Hilfsmittel
 * ------------------------------------------------------------------ */

function createPlayer(id: PlayerId, label: string): PlayerState {
  /*
   * A new player enters with both lifelines untouched, whether or not the
   * installation offers them: the state is the same everywhere, and only the
   * configuration decides whether anybody ever sees it. That is what makes a
   * game started without lifelines and one started with them the same shape -
   * and why enabling them needs no migration.
   */
  return { id, label, score: 0, lockedForCurrentQuestion: false, lifelines: createPlayerLifelines() }
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
 * Kleiner Arbeitsbereich fuer einen Befehl: sammelt Zustandsaenderung, Ereignisse und
 * Effekte, damit die einzelnen Befehle knapp bleiben und alle dieselbe
 * Commit-Semantik (Revision erhoehen, Zeitstempel setzen) verwenden.
 */
class Draft {
  state: GameState | null
  private readonly events: DomainEvent[] = []
  private readonly effects: EngineEffects = { scoreTransactions: [], questionUsages: [] }

  constructor(
    initial: GameState | null,
    readonly ctx: EngineContext,
    readonly timing: typeof gameTiming,
    readonly selfServiceTiming: SelfServiceTiming,
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

  /** Zeitgesteuerter Uebergang mit definierter Fallbackzeit (Spezifikation 22.1). */
  /**
   * Einen Phasenwechsel auf die Uhr legen.
   *
   * `still` trennt zwei Dinge, die frueher eines waren: den ZEITGEBER und den
   * PRAESENTATIONSUEBERGANG. Normalerweise gehoeren sie zusammen - der Wechsel
   * von der Rueckmeldung zur Loesung ist beides. Beim Video nicht: Wenn seine
   * Restzeit auf die Uhr gelegt wird, animiert nichts, und seine Laufzeit ist
   * keine Animationsdauer.
   *
   * Der Unterschied ist nicht kosmetisch. Der Buehnenclient haengt seinen
   * Szenenknoten an die Kennung des letzten Uebergangs; eine neue Kennung baut
   * die Szene neu auf. Beim Video hiesse das: Videoelement weg, Videoelement
   * neu, Laufzeitmeldung, neue Kennung - eine Schleife, die flackert, das Bild
   * nie zeigt und den geplanten Uebergang nie faellig werden laesst.
   */
  scheduleTimedTransition(
    nextPhase: GamePhase,
    durationMs: number,
    transitionId: string,
    optionen: { still?: boolean } = {},
  ): void {
    this.mutate((draft) => {
      const id = `${transitionId}:${this.ctx.newId('transition')}`
      draft.pendingTransition = { nextPhase, endsAtMs: this.ctx.nowMs + durationMs, transitionId: id }
      if (!optionen.still) {
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
