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
  gameTiming,
  isImageReveal,
  playerIds,
  scoringRules,
  type AnswerAttempt,
  type Command,
  type CommandRejection,
  type GamePhase,
  type GameState,
  type PlayerCount,
  type PlayerId,
  type PlayerState,
  type RuntimeQuestion,
} from '@quiz/contracts'
import { eligibleOpponent, evaluateBuzz } from './buzzer.ts'
import {
  applyScoreDelta,
  attemptsForCurrentQuestion,
  countFailedAttemptsForCurrentQuestion,
  pendingAttempt,
  pointsForCorrectAnswer,
} from './scoring.ts'
import {
  completeReveal,
  createRevealClock,
  pauseReveal,
  resetReveal,
  resumeReveal,
} from './reveal.ts'

/* ------------------------------------------------------------------ *
 * Ports und Ergebnisstruktur
 * ------------------------------------------------------------------ */

/** Anfrage der Engine an die Anwendungsschicht: Frage fuer einen Fragenplatz ziehen. */
export interface SlotRequest {
  quizModeId: string
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
  slotCountFor(quizModeId: string, presetId: string): number | null
  selectForSlot(request: SlotRequest): SlotResponse
}

export interface EngineContext {
  nowMs: number
  eventDayId: string
  /** Erzeugt stabile IDs (Spiel, Versuch, Uebergang). */
  newId: (prefix: string) => string
  questionSource: QuestionSource
  timing?: typeof gameTiming
  /** Globaler Soundstatus, den ein neu gestartetes Spiel uebernimmt. */
  initialSoundEnabled?: boolean
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
  const work = new Draft(state, ctx, timing)

  switch (command.type) {
    case 'START_GAME':
      return startGame(work, command)

    case 'SET_SOUND_ENABLED': {
      if (!work.state) return reject('no-active-game', 'Es laeuft gerade kein Spiel.')
      work.mutate((draft) => {
        draft.soundEnabled = command.enabled
      })
      work.log('system', `Sound ${command.enabled ? 'eingeschaltet' : 'stummgeschaltet'}.`)
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

    case 'PAUSE_IMAGE_REVEAL': {
      const guard = work.requireRevealQuestion()
      if (guard) return guard
      if (work.phase !== 'reveal-running') {
        return reject('invalid-phase', 'Die Enthuellung laeuft gerade nicht.')
      }
      work.mutate((draft) => {
        draft.reveal = pauseReveal(draft.reveal!, ctx.nowMs)
        draft.phase = 'reveal-paused'
      })
      work.log('phase', 'Enthuellung pausiert.')
      return work.commit()
    }

    case 'RESUME_IMAGE_REVEAL': {
      const guard = work.requireRevealQuestion()
      if (guard) return guard
      if (work.phase !== 'reveal-paused') {
        return reject('invalid-phase', 'Die Enthuellung ist gerade nicht pausiert.')
      }
      work.mutate((draft) => {
        draft.reveal = resumeReveal(draft.reveal!, ctx.nowMs)
        draft.phase = 'reveal-running'
      })
      work.log('phase', 'Enthuellung fortgesetzt.')
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
      work.log('phase', 'Bild vollstaendig aufgedeckt. Buzzern bleibt erlaubt.')
      return work.commit()
    }

    case 'RESET_IMAGE_REVEAL': {
      const guard = work.requireRevealQuestion()
      if (guard) return guard
      if (!['reveal-running', 'reveal-paused'].includes(work.phase)) {
        return reject('invalid-phase', 'Die Enthuellung kann in dieser Phase nicht zurueckgesetzt werden.')
      }
      work.mutate((draft) => {
        draft.reveal = resumeReveal(resetReveal(draft.reveal!), ctx.nowMs)
        draft.phase = 'reveal-running'
      })
      // Technische Korrekturaktion, bewusst getrennt von "Buzzer zuruecksetzen".
      work.log('system', 'Enthuellung technisch auf den Anfang zurueckgesetzt.')
      return work.commit()
    }

    case 'START_VIDEO':
    case 'PAUSE_VIDEO':
    case 'SEEK_VIDEO':
    case 'RESTART_VIDEO':
    case 'REPORT_VIDEO_STATUS':
    case 'SHOW_QUESTION_AFTER_VIDEO':
      return handleVideoCommand(work, command)

    case 'ADJUST_SCORE': {
      if (!work.state) return reject('no-active-game', 'Es laeuft gerade kein Spiel.')
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
  command: { quizModeId: string; presetId: string; playerCount?: PlayerCount; playerLabels?: string[] },
): EngineResult {
  const { quizModeId, presetId, playerLabels } = command
  if (work.state && work.state.status === 'active') {
    return reject('invalid-phase', 'Es laeuft bereits ein Spiel. Bitte zuerst beenden.')
  }
  const slotCount = work.ctx.questionSource.slotCountFor(quizModeId, presetId)
  if (slotCount === null) {
    return reject('invalid-payload', 'Diese Kombination aus Quizmodus und Schwierigkeits-Preset gibt es nicht.')
  }

  // Ohne Angabe ist ein Spiel ein Duell. Der Buehnenbetrieb bleibt damit
  // unveraendert, ohne dass er die Spielerzahl mitschicken muss.
  const playerCount: PlayerCount = command.playerCount ?? 2
  const players: PlayerState[] = playerIds
    .slice(0, playerCount)
    .map((id, index) => createPlayer(id, playerLabels?.[index] ?? `Spieler ${index + 1}`))
  const fresh: GameState = {
    gameId: work.ctx.newId('game'),
    eventDayId: work.ctx.eventDayId,
    status: 'active',
    phase: 'pause-screen',
    revision: 0,
    quizModeId,
    presetId,
    totalQuestions: slotCount,
    currentSlotIndex: 0,
    selectedQuestionIds: [],
    selectedRepetitionGroupIds: [],
    players,
    buzzer: { open: false },
    attempts: [],
    // Der globale Soundstatus bleibt ueber Spiele hinweg erhalten.
    soundEnabled: work.ctx.initialSoundEnabled ?? work.state?.soundEnabled ?? true,
    updatedAtMs: work.ctx.nowMs,
  }

  work.replaceState(fresh)
  work.log(
    'game',
    `Spiel gestartet: Modus "${quizModeId}", Preset "${presetId}", ${slotCount} Fragen, ` +
      `${playerCount === 1 ? 'Einzelspiel' : 'Duell'}.`,
  )

  const selection = drawQuestionForCurrentSlot(work, [])
  if (!selection.ok) return selection.rejection

  // Der Pausen-/Logoscreen laeuft als kurze eigene Praesentationsphase an; danach
  // uebernimmt derselbe Weg wie zwischen zwei Fragen (keine zweite Ablauflogik).
  work.scheduleTimedTransition(questionEntryPhase(work.state!), work.timing.pauseScreenMs, 'pause-to-question')
  return work.commit()
}

function acceptPlayer(work: Draft, playerId: PlayerId, via: 'hardware' | 'manual'): EngineResult {
  if (!work.state) return reject('no-active-game', 'Es laeuft gerade kein Spiel.')
  const decision = evaluateBuzz(work.state, playerId)
  if (!decision.allowed) {
    // Abgewiesene Ereignisse werden protokolliert - inklusive Auto-Repeat der Tastatur.
    return reject(decision.reason ?? 'buzzer-closed', decision.message ?? 'Buzzer nicht moeglich.')
  }

  const label = work.state.players.find((player) => player.id === playerId)!.label
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
  work.log('buzzer', `${label} hat den Zuschlag (${via === 'hardware' ? 'Buzzer' : 'manuell'}).`, {
    playerId,
    via,
  })
  return work.commit()
}

function logAnswer(work: Draft, input: { optionId?: string; verdict?: 'correct' | 'incorrect' }): EngineResult {
  if (!work.state) return reject('no-active-game', 'Es laeuft gerade kein Spiel.')
  if (!['answer-locked', 'second-chance'].includes(work.phase)) {
    return reject('invalid-phase', 'In dieser Phase kann keine Antwort eingeloggt werden.')
  }
  const attempt = pendingAttempt(work.state)
  if (!attempt) return reject('no-pending-attempt', 'Es gibt gerade keinen offenen Versuch.')

  const question = work.state.currentQuestion!.question
  if (input.optionId !== undefined) {
    const known = question.options?.some((option) => option.id === input.optionId)
    if (!known) return reject('invalid-payload', 'Diese Antwortoption gehoert nicht zur Frage.')
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
  if (!work.state) return reject('no-active-game', 'Es laeuft gerade kein Spiel.')
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
      'Zuerst die genannte Antwort einloggen oder "Ohne Antwort aufloesen" verwenden.',
    )
  }

  return finishAttempt(work, attempt, outcome)
}

function resolveWithoutAnswer(work: Draft, mode: 'resolve-without-answer' | 'pass'): EngineResult {
  if (!work.state) return reject('no-active-game', 'Es laeuft gerade kein Spiel.')
  const allowedPhases: GamePhase[] = [
    'question-presented',
    'buzzer-open',
    'answer-locked',
    'second-chance',
    'reveal-running',
    'reveal-paused',
  ]
  if (!allowedPhases.includes(work.phase)) {
    return reject('invalid-phase', 'In dieser Phase kann nicht aufgeloest werden.')
  }
  if (mode === 'pass' && work.phase !== 'second-chance') {
    return reject('invalid-phase', 'Passen ist nur in der zweiten Chance moeglich.')
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
  const imageReveal = isImageReveal(question.presentationType)
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
  // zweite Chance; nach dem zweiten Fehlversuch folgt die Loesung. Im Einzelspiel
  // gibt es keinen anderen Spieler - dort folgt sofort die Loesung.
  const opponent = eligibleOpponent(work.state!, attempt.playerId)
  return attempt.attemptNumber === 1 && opponent ? 'second-chance' : 'solution'
}

function resetBuzzer(work: Draft): EngineResult {
  if (!work.state) return reject('no-active-game', 'Es laeuft gerade kein Spiel.')
  const question = work.state.currentQuestion
  if (!question) return reject('invalid-phase', 'Es ist gerade keine Frage aktiv.')

  if (work.phase === 'second-chance') {
    // In der zweiten Chance gibt es keine Buzzer-Zuordnung; zurueckgesetzt wird
    // nur die bereits eingeloggte Antwort.
    const attempt = pendingAttempt(work.state)
    if (!attempt) return reject('no-pending-attempt', 'Es gibt nichts zurueckzusetzen.')
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
    draft.phase = isImageReveal(question.question.presentationType)
      ? draft.reveal?.status === 'paused'
        ? 'reveal-paused'
        : 'reveal-running'
      : 'buzzer-open'
  })
  work.log('buzzer', 'Buzzer zurueckgesetzt und erneut freigegeben.')
  return work.commit()
}

function handleVideoCommand(work: Draft, command: Command): EngineResult {
  if (!work.state) return reject('no-active-game', 'Es laeuft gerade kein Spiel.')
  const question = work.state.currentQuestion
  if (!question || question.question.presentationType !== 'video-then-question') {
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
      return work.commit()
    }
    case 'PAUSE_VIDEO': {
      if (work.phase !== 'video-playing') return reject('invalid-phase', 'Das Video laeuft gerade nicht.')
      work.mutate((draft) => {
        const video = draft.video!
        const elapsed = video.startedAtServerMs ? work.ctx.nowMs - video.startedAtServerMs : 0
        draft.video = { ...video, status: 'paused', positionMs: video.positionMs + elapsed, startedAtServerMs: undefined }
        draft.phase = 'video-ready'
      })
      work.log('phase', 'Video pausiert.')
      return work.commit()
    }
    case 'SEEK_VIDEO': {
      if (!['video-ready', 'video-playing'].includes(work.phase)) {
        return reject('invalid-phase', 'In dieser Phase kann nicht im Video gesprungen werden.')
      }
      work.mutate((draft) => {
        const wasPlaying = draft.video!.status === 'playing'
        draft.video = {
          ...draft.video!,
          positionMs: command.positionMs,
          startedAtServerMs: wasPlaying ? work.ctx.nowMs : undefined,
        }
      })
      work.log('phase', `Video auf ${Math.round(command.positionMs / 1000)} s gesetzt.`)
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
          `Video konnte nicht abgespielt werden: ${command.error}. Frage ueberspringen oder ohne Video weiterfuehren.`,
        )
      }
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
    return reject('invalid-phase', 'Das Spiel ist beendet. Ueber "Beenden" geht es zurueck zur Startansicht.')
  }
  if (work.phase !== 'solution') {
    // `Weiter` bedeutet immer dasselbe und darf niemals "Antwort bewerten" oder
    // "zweiten Spieler freigeben" bedeuten - dafuer gibt es eigene Befehle.
    return reject('invalid-phase', '"Weiter" ist erst nach der Loesung moeglich.')
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
  if (!selection.ok) return selection.rejection

  work.mutate((draft) => {
    draft.phase = 'pause-screen'
  })
  work.scheduleTimedTransition(questionEntryPhase(work.state!), work.timing.pauseScreenMs, 'pause-to-question')
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
    'reveal-running',
    'reveal-paused',
  ]
  if (!skippablePhases.includes(work.phase)) {
    return reject('invalid-phase', 'Eine bereits aufgeloeste Frage kann nicht mehr uebersprungen werden.')
  }

  const skippedId = current.question.id
  const selection = drawQuestionForCurrentSlot(work, [skippedId])
  if (!selection.ok) return selection.rejection

  work.log('content', `Frage ${skippedId} uebersprungen${reason ? ` (${reason})` : ''}.`, { skippedId, reason })
  work.mutate((draft) => {
    draft.phase = 'pause-screen'
  })
  work.scheduleTimedTransition(questionEntryPhase(work.state!), work.timing.pauseScreenMs, 'pause-to-question')
  return work.commit()
}

function advanceTimedPhase(work: Draft, transitionId: string): EngineResult {
  if (!work.state) return reject('no-active-game', 'Es laeuft gerade kein Spiel.')
  const pending = work.state.pendingTransition
  if (!pending || pending.transitionId !== transitionId) {
    // Doppelte oder verspaetete Meldungen laufen hier ins Leere - ein schneller
    // Doppelklick kann keinen Uebergang zweimal ausloesen.
    return reject('invalid-phase', 'Dieser Uebergang ist bereits abgeschlossen.')
  }
  applyPhase(work, pending.nextPhase)
  return work.commit()
}

/* ------------------------------------------------------------------ *
 * Phasenuebergaenge
 * ------------------------------------------------------------------ */

/** In welcher Phase startet die aktuelle Frage nach dem Pausenscreen? */
function questionEntryPhase(state: GameState): GamePhase {
  const type = state.currentQuestion?.question.presentationType
  if (type === 'video-then-question') return 'video-ready'
  if (type === 'image-reveal') return 'reveal-running'
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
      case 'question-presented': {
        draft.phase = 'question-presented'
        draft.buzzer = { open: false }
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
      work.log('phase', `Zweite Chance fuer ${eligible.label}. Kein erneutes Buzzern noetig.`)
    }
  } else {
    work.log('phase', `Phase: ${phase}.`)
  }
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
  const response = work.ctx.questionSource.selectForSlot({
    quizModeId: state.quizModeId,
    presetId: state.presetId,
    slotIndex: state.currentSlotIndex,
    excludeQuestionIds: [...state.selectedQuestionIds, ...additionalExclusions],
    excludeRepetitionGroupIds: [...state.selectedRepetitionGroupIds],
  })
  if (!response.ok) {
    return { ok: false, rejection: reject('no-candidate-question', response.message) }
  }

  const runtime = response.runtimeQuestion
  work.mutate((draft) => {
    // Eine uebersprungene Frage bleibt fuer dieses Spiel gesperrt, damit sie nicht
    // direkt wieder gezogen wird.
    for (const excluded of additionalExclusions) {
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
    draft.buzzer = { open: false }
    draft.reveal = isImageReveal(runtime.question.presentationType)
      ? createRevealClock(work.timing.imageRevealDurationMs)
      : undefined
    draft.video =
      runtime.question.presentationType === 'video-then-question'
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
    `Frage ${state.currentSlotIndex + 1}/${state.totalQuestions} gewaehlt: ${runtime.question.id} - ${response.rationale}`,
    { questionId: runtime.question.id, rationale: response.rationale },
  )
  return { ok: true }
}

/* ------------------------------------------------------------------ *
 * Hilfsmittel
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
      return 'ohne Antwort aufgeloest'
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
    if (!this.state) return reject('no-active-game', 'Es laeuft gerade kein Spiel.')
    if (this.state.status !== 'active') {
      return reject('no-active-game', 'Das Spiel ist bereits beendet oder abgebrochen.')
    }
    return null
  }

  requireRevealQuestion(): EngineResult | null {
    const guard = this.requireActiveGame()
    if (guard) return guard
    const question = this.state!.currentQuestion
    if (!question || !isImageReveal(question.question.presentationType) || !this.state!.reveal) {
      return reject('invalid-phase', 'Die aktuelle Frage ist keine Bilderkennen-Frage.')
    }
    return null
  }

  /** Zeitgesteuerter Uebergang mit definierter Fallbackzeit (Spezifikation 22.1). */
  scheduleTimedTransition(nextPhase: GamePhase, durationMs: number, transitionId: string): void {
    this.mutate((draft) => {
      const id = `${transitionId}:${this.ctx.newId('transition')}`
      draft.pendingTransition = { nextPhase, endsAtMs: this.ctx.nowMs + durationMs, transitionId: id }
      draft.lastTransition = { transitionId: id, startedAtServerMs: this.ctx.nowMs, durationMs }
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
