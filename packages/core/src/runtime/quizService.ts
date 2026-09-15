/**
 * Application layer of the local quiz server (specification 18.4 and 23).
 *
 * Flow of every command - deliberately in exactly this order:
 *   1. validate schema, role and phase
 *   2. answer an already processed `commandId` idempotently
 *   3. check `expectedRevision`
 *   4. compute the new state through the central engine
 *   5. store state, score booking, usage and audit log in ONE transaction
 *   6. the revision is thereby incremented
 *   7. only then distribute the new state
 *
 * This class deliberately contains no game rules. It connects engine, content,
 * persistence and time.
 */
import {
  commandEnvelopeSchema,
  questionPatchSchema,
  resolveRules,
  requiresRevisionCheck,
  roleMayIssue,
  type ActorRole,
  type ClientRole,
  type Command,
  type CommandEnvelope,
  type CommandRejection,
  type CommandType,
  type GameState,
  type ModeratorQuizViewModel,
  type OperatorQuizViewModel,
  type PlayerQuizViewModel,
  type PublicQuizViewModel,
  type QuestionPatch,
} from '../contracts'
import {
  pauseReveal,
  projectModerator,
  projectOperator,
  projectPlayer,
  projectPublic,
  type ProjectionContext,
} from '../engine'
import { reduce, type QuizStorePort } from '../engine'
import { buildChangeReport } from './hotfix'
import { ContentService } from './contentService'

type SnapshotForAnyRole =
  | PublicQuizViewModel
  | PlayerQuizViewModel
  | ModeratorQuizViewModel
  | OperatorQuizViewModel

export interface DispatchResult {
  ok: boolean
  revision: number
  rejection?: CommandRejection
}

export interface QuizServiceOptions {
  store: QuizStorePort
  content: ContentService
  /** Injectable for tests. */
  now?: () => number
  random?: () => number
  sessionCode?: string
  lanUrls?: string[]
}

/**
 * Game commands a player may trigger in self-service only.
 * `roleMayIssue` knows only role and command type; the flow profile of the
 * running game is checked by `dispatch`.
 */
const playerFlowCommands: readonly CommandType[] = [
  'BUZZ',
  'LOG_OPTION_ANSWER',
  'RESOLVE_ATTEMPT',
  'CONTINUE',
]

const SETTING_SOUND = 'sound-enabled'
const SETTING_LOCALE = 'locale'
/** From when the game log counts. If the value is missing, it counts since ever. */
const SETTING_STATISTICS_SINCE = 'statistics-since'
const SETTING_CONTENT_VERSION = 'active-content-version'

export class QuizService {
  private state: GameState | null = null
  /** Incomplete game found after a restart - active only after the operator's decision. */
  private resumable: GameState | null = null
  private eventDay: { id: string; calendarDate: string }
  private transitionTimer: ReturnType<typeof setTimeout> | null = null
  private soundEnabled: boolean
  /** Locale of the device - like the sound a setting, not game state. */
  private locale: string | undefined
  private selectionRationale: string | undefined
  private readonly listeners = new Set<() => void>()
  private readonly connectedClients = new Map<string, { role: ActorRole; clientId: string }>()
  private readonly warnings: string[] = []

  readonly store: QuizStorePort
  readonly content: ContentService
  readonly now: () => number
  private readonly random: () => number
  private readonly sessionCode: string | undefined
  private lanUrls: string[]

  constructor(options: QuizServiceOptions) {
    this.store = options.store
    this.content = options.content
    this.now = options.now ?? (() => Date.now())
    this.random = options.random ?? Math.random
    this.sessionCode = options.sessionCode
    this.lanUrls = options.lanUrls ?? []

    this.soundEnabled = this.store.getSetting(SETTING_SOUND) !== 'false'
    this.locale = this.store.getSetting(SETTING_LOCALE) ?? undefined
    this.eventDay = this.store.ensureEventDay(this.calendarDate(), new Date(this.now()).toISOString(), true)
    this.store.setSetting(SETTING_CONTENT_VERSION, this.content.contentVersion)
    this.warnings.push(...this.content.patchWarnings)

    this.restore()
  }

  /* ------------------------------------------------------------------ *
   * Recovery after a restart (specification 23.3)
   * ------------------------------------------------------------------ */

  /**
   * Looks for an incomplete game and prepares it, but does NOT make it active
   * automatically: the operator deliberately decides between resuming and
   * aborting.
   *
   * Deterministic strategy for running clocks (chosen this way for live
   * safety): a reveal running at the crash is restored as PAUSED - frozen at
   * the last persisted state. A running video is no longer requested after the
   * restart. A timed transition (feedback, pause screen) is completed at once
   * on resume instead of waiting out an already expired deadline again.
   */
  private restore(): void {
    const found = this.store.loadResumableGame(this.eventDay.id)
    if (!found) return

    const prepared: GameState = structuredClone(found)
    // Game states from a version before the multi-context stage carry no
    // flow profile. They necessarily come from the stage operation.
    prepared.flowProfile ??= 'operated'
    if (prepared.reveal?.status === 'running') {
      prepared.reveal = pauseReveal(prepared.reveal, prepared.updatedAtMs)
      // Phase and clock have to match: a frozen reveal is, in terms of the rules,
      // `reveal-paused`. The buzzer deliberately stays open.
      if (prepared.phase === 'reveal-running') prepared.phase = 'reveal-paused'
    }
    /*
     * A PLAYBACK REQUEST DOES NOT SURVIVE THE RESTART.
     *
     * A stage executes every request it does not know yet - after a restart
     * this one too, and the video would start over in the hall without anyone
     * asking for it. After a crash the operator decides: the button is ready,
     * the phase is right, and a click creates a new request.
     *
     * A RECONNECT of the stage is something else - there the request stays and
     * is caught up exactly once.
     */
    prepared.video = undefined
    if (prepared.pendingTransition) {
      prepared.pendingTransition = { ...prepared.pendingTransition, endsAtMs: 0 }
    }

    this.resumable = prepared
    this.store.appendAudit({
      gameId: prepared.gameId,
      atMs: this.now(),
      actorRole: 'system',
      category: 'system',
      message: `Unvollständiges Spiel gefunden (Frage ${prepared.currentSlotIndex + 1}/${prepared.totalQuestions}). Die Enthüllung wurde pausiert wiederhergestellt; ein Video startet erst wieder auf Befehl.`,
    })
  }

  /* ------------------------------------------------------------------ *
   * Command processing
   * ------------------------------------------------------------------ */

  get currentRevision(): number {
    return this.state?.revision ?? 0
  }

  dispatch(rawEnvelope: unknown): DispatchResult {
    // 1. Schema
    const parsed = commandEnvelopeSchema.safeParse(rawEnvelope)
    if (!parsed.success) {
      return this.reject('invalid-payload', `Befehl konnte nicht gelesen werden: ${parsed.error.issues[0]?.message ?? 'unbekannt'}`)
    }
    const envelope = parsed.data

    // 2. Idempotency - a repeated `commandId` never books twice.
    const processed = this.store.findProcessedCommand(envelope.commandId)
    if (processed) {
      return processed.accepted
        ? { ok: true, revision: this.currentRevision }
        : {
            ok: false,
            revision: this.currentRevision,
            rejection: { reason: 'invalid-payload', message: 'Dieser Befehl wurde bereits abgewiesen.' },
          }
    }

    // 3. Role
    if (!roleMayIssue(envelope.actor.role, envelope.command.type)) {
      return this.rejectAndRecord(envelope, 'forbidden-role', `Die Rolle "${envelope.actor.role}" darf "${envelope.command.type}" nicht auslösen.`)
    }

    // 4. Revision - a command on a stale state is refused understandably.
    //    Physical events such as the buzzer are exempt (see
    //    `revisionExemptCommands`); there the atomic check in the engine
    //    decides alone.
    if (requiresRevisionCheck(envelope.command.type) && envelope.expectedRevision !== this.currentRevision) {
      return this.rejectAndRecord(
        envelope,
        'revision-conflict',
        `Der Spielstand hat sich inzwischen geändert (erwartet ${envelope.expectedRevision}, aktuell ${this.currentRevision}). Die Ansicht wurde aktualisiert.`,
      )
    }

    // 5. Role policy that is not a game rule: a player at the touch device may
    //    begin a game, but only a self-service one. Otherwise they could start a
    //    game that waits for an operator who is not there.
    if (
      envelope.command.type === 'START_GAME' &&
      envelope.actor.role === 'player' &&
      envelope.command.flowProfile !== 'self-service'
    ) {
      return this.rejectAndRecord(
        envelope,
        'wrong-flow-profile',
        'Ein Spiel am Gerät läuft immer in Selbstbedienung. Ein vom Operator gesteuertes Spiel kann hier nicht gestartet werden.',
      )
    }

    //    The same policy for the running game: the command sequence buzz ->
    //    log -> confirm -> continue is meant for players in self-service only.
    //    In an operated game a player command would reach into the operator's
    //    evaluation. The engine does not know the sender, so the guard stands
    //    here.
    if (
      envelope.actor.role === 'player' &&
      playerFlowCommands.includes(envelope.command.type) &&
      this.state !== null &&
      this.state.flowProfile !== 'self-service'
    ) {
      return this.rejectAndRecord(
        envelope,
        'wrong-flow-profile',
        'In diesem Spiel führt der Operator durch die Fragen. Antworten am Gerät ist hier nicht vorgesehen.',
      )
    }

    /*
     * 6. The sound belongs to the DEVICE and not to the game.
     *
     * While a game runs, the command goes through the engine and ends up in the
     * game log. While none runs, there is nothing it could be recorded in - and
     * the engine would refuse it. But that is exactly where it is needed: at the
     * kiosk device the sound switch sits on the start screen, because there it
     * is operated by whoever sets up the device, not by whoever is playing.
     */
    if (envelope.command.type === 'SET_SOUND_ENABLED' && this.state === null) {
      this.soundEnabled = envelope.command.enabled
      this.store.setSetting(SETTING_SOUND, String(envelope.command.enabled))
      this.notify()
      return { ok: true, revision: this.currentRevision }
    }

    /*
     * The same for the locale, and for the same reason: at the kiosk device the
     * switch sits on the start screen, where no game runs. If one runs, the
     * command goes through the engine and ends up in the game log.
     */
    if (envelope.command.type === 'SET_LOCALE' && this.state === null) {
      this.locale = envelope.command.locale
      this.store.setSetting(SETTING_LOCALE, envelope.command.locale)
      this.notify()
      return { ok: true, revision: this.currentRevision }
    }

    // 7. Operating commands do not go through the game engine.
    if (isServiceCommand(envelope.command.type)) {
      return this.handleServiceCommand(envelope)
    }

    return this.runEngineCommand(envelope, envelope.command)
  }

  private runEngineCommand(envelope: CommandEnvelope, command: Command): DispatchResult {
    const nowMs = this.now()
    const rules = resolveRules(this.content.config.rules)
    const result = reduce(this.state, command, {
      nowMs,
      eventDayId: this.eventDay.id,
      timing: rules.timing,
      selfServiceTiming: rules.selfServiceTiming,
      scoring: rules.scoring,
      jokersEnabled: rules.jokersEnabled,
      newId: (prefix) => `${prefix}-${createRandomId()}`,
      questionSource: this.content.createQuestionSource(
        this.store.loadUsageHistory(this.eventDay.id),
        this.random,
      ),
      initialSoundEnabled: this.soundEnabled,
      initialLocale: this.locale,
      random: this.random,
    })

    if (!result.ok) {
      return this.rejectAndRecord(envelope, result.rejection.reason, result.rejection.message)
    }

    // 6. Persist first, then distribute. If the transaction fails, the last
    //    consistent state is kept and nothing is sent.
    try {
      this.store.commitCommand({
        commandId: envelope.commandId,
        actor: envelope.actor,
        state: result.state,
        events: result.events,
        effects: result.effects,
        atMs: nowMs,
      })
    } catch (error) {
      const message = `Der Spielstand konnte nicht gespeichert werden: ${(error as Error).message}. Bitte keine weiteren Aktionen ausführen und den Speicherort prüfen.`
      this.addWarning(message)
      this.notify()
      return { ok: false, revision: this.currentRevision, rejection: { reason: 'persistence-error', message } }
    }

    this.state = result.state
    if (command.type === 'SET_SOUND_ENABLED') {
      this.soundEnabled = command.enabled
      this.store.setSetting(SETTING_SOUND, String(command.enabled))
    }
    if (command.type === 'SET_LOCALE') {
      this.locale = command.locale
      this.store.setSetting(SETTING_LOCALE, command.locale)
    }
    const selection = result.events.find((event) => event.category === 'content' && event.data?.['rationale'])
    if (selection) this.selectionRationale = String(selection.data!['rationale'])

    this.scheduleTransition()
    this.notify()
    return { ok: true, revision: this.state.revision }
  }

  /** Recovery, event day and hotfixes - deliberately outside the engine. */
  private handleServiceCommand(envelope: CommandEnvelope): DispatchResult {
    const command = envelope.command
    const nowMs = this.now()

    switch (command.type) {
      case 'RESUME_GAME': {
        if (!this.resumable) {
          return this.rejectAndRecord(envelope, 'nothing-to-resume', 'Es gibt kein unterbrochenes Spiel zum Fortsetzen.')
        }
        this.state = this.resumable
        this.resumable = null
        this.store.appendAudit({
          gameId: this.state.gameId,
          atMs: nowMs,
          actorRole: envelope.actor.role,
          actorClientId: envelope.actor.clientId,
          category: 'system',
          message: 'Unterbrochenes Spiel fortgesetzt. Alle Clients wurden mit einem vollständigen Snapshot synchronisiert.',
        })
        this.scheduleTransition()
        this.notify()
        return { ok: true, revision: this.currentRevision }
      }

      case 'DISCARD_RESUMABLE_GAME': {
        if (!this.resumable) {
          return this.rejectAndRecord(envelope, 'nothing-to-resume', 'Es gibt kein unterbrochenes Spiel.')
        }
        const aborted: GameState = { ...this.resumable, status: 'aborted', phase: 'aborted', pendingTransition: undefined }
        this.store.commitCommand({
          commandId: envelope.commandId,
          actor: envelope.actor,
          state: aborted,
          events: [{ category: 'game', message: 'Unterbrochenes Spiel bewusst verworfen. Es wird kein Ergebnis angezeigt.' }],
          effects: { scoreTransactions: [], questionUsages: [] },
          atMs: nowMs,
        })
        this.resumable = null
        this.state = null
        this.notify()
        return { ok: true, revision: this.currentRevision }
      }

      case 'RESET_GAME_STATISTICS': {
        /*
         * The COUNT is reset, not the data: game states, attempts and the audit
         * log hang on the same rows. From now on the log counts afresh.
         */
        const sinceIso = new Date(nowMs).toISOString()
        this.store.setSetting(SETTING_STATISTICS_SINCE, sinceIso)
        this.store.appendAudit({
          atMs: nowMs,
          actorRole: envelope.actor.role,
          actorClientId: envelope.actor.clientId,
          category: 'system',
          message: 'Spielprotokoll zurückgesetzt. Die Zählung beginnt neu.',
        })
        this.notify()
        return { ok: true, revision: this.currentRevision }
      }

      case 'START_NEW_EVENT_DAY': {
        if (this.state?.status === 'active') {
          return this.rejectAndRecord(
            envelope,
            'invalid-phase',
            'Ein laufendes Spiel wird durch einen Tageswechsel nicht zurückgesetzt. Bitte zuerst beenden.',
          )
        }
        this.eventDay = this.store.startNewEventDay(this.calendarDate(), new Date(nowMs).toISOString())
        this.state = null
        this.resumable = null
        this.store.appendAudit({
          atMs: nowMs,
          actorRole: envelope.actor.role,
          actorClientId: envelope.actor.clientId,
          category: 'system',
          message: `Neuer Veranstaltungstag begonnen: ${this.eventDay.id}. Die Wiederholungshistorie startet neu.`,
        })
        this.notify()
        return { ok: true, revision: this.currentRevision }
      }

      case 'APPLY_QUESTION_PATCH': {
        const original = this.content.baseQuestions.find((question) => question.id === command.questionId)
        if (!original) {
          return this.rejectAndRecord(envelope, 'invalid-patch', `Die Frage "${command.questionId}" gibt es im Basispaket nicht.`)
        }
        const patch: QuestionPatch = questionPatchSchema.parse({
          id: `patch-${createRandomId()}`,
          questionId: command.questionId,
          baseContentVersion: this.content.contentVersion,
          changes: command.changes,
          reason: command.reason,
          createdAt: new Date(nowMs).toISOString(),
          createdBy: 'operator',
          applyMode: command.applyMode,
        })

        // The patch is checked against the same schema as the base content.
        const previousValues: Record<string, unknown> = {}
        for (const field of Object.keys(patch.changes)) {
          previousValues[field] = (original as unknown as Record<string, unknown>)[field]
        }
        this.store.savePatch(patch, previousValues)
        this.content.applyPatchOverlay(this.store.loadPatches())

        // Only on an explicit "apply now" does the change go to the stage screen at
        // once. Otherwise it takes effect on the next use of the question.
        if (
          command.applyMode === 'immediate-confirmed' &&
          this.state?.currentQuestion?.question.id === command.questionId
        ) {
          const updated = this.content.findQuestion(command.questionId)
          if (updated) {
            this.state = {
              ...this.state,
              currentQuestion: { ...this.state.currentQuestion!, question: updated },
              revision: this.state.revision + 1,
              updatedAtMs: nowMs,
            }
          }
        }

        this.store.appendAudit({
          gameId: this.state?.gameId ?? null,
          atMs: nowMs,
          actorRole: envelope.actor.role,
          actorClientId: envelope.actor.clientId,
          category: 'content',
          message: `Hotfix an Frage ${command.questionId} (${Object.keys(patch.changes).join(', ')})${command.reason ? ` - ${command.reason}` : ''}. Basispaket unverändert.`,
        })
        this.notify()
        return { ok: true, revision: this.currentRevision }
      }

      default:
        return this.rejectAndRecord(envelope, 'unknown-command', 'Unbekannter Betriebsbefehl.')
    }
  }

  /* ------------------------------------------------------------------ *
   * Timed transitions
   * ------------------------------------------------------------------ */

  /**
   * Sets the fallback timer for the current timed phase.
   *
   * The state transition of the rules thus never depends on a browser delivering
   * an `animationend` event (specification 22.1).
   */
  private scheduleTransition(): void {
    if (this.transitionTimer) {
      clearTimeout(this.transitionTimer)
      this.transitionTimer = null
    }
    const pending = this.state?.pendingTransition
    if (!pending) return

    const delay = Math.max(0, pending.endsAtMs - this.now())
    this.transitionTimer = setTimeout(() => {
      this.transitionTimer = null
      const current = this.state?.pendingTransition
      if (!current || current.transitionId !== pending.transitionId) return
      this.dispatch({
        commandId: `system-${createRandomId()}`,
        command: { type: 'ADVANCE_TIMED_PHASE', transitionId: current.transitionId },
        actor: { clientId: 'server', role: 'system' },
        expectedRevision: this.currentRevision,
      })
    }, delay)
    // In Node an active timer keeps the process alive - `unref` releases it.
    // In the browser the method does not exist; the access stays structural.
    const timer = this.transitionTimer as { unref?: () => void }
    if (typeof timer.unref === 'function') timer.unref()
  }

  /** For tests and an orderly shutdown. */
  stopTimers(): void {
    if (this.transitionTimer) clearTimeout(this.transitionTimer)
    this.transitionTimer = null
  }

  /* ------------------------------------------------------------------ *
   * Distribution
   * ------------------------------------------------------------------ */

  onChange(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private notify(): void {
    for (const listener of this.listeners) listener()
  }

  registerClient(clientId: string, role: ActorRole): void {
    this.connectedClients.set(clientId, { clientId, role })
    this.notify()
  }

  unregisterClient(clientId: string): void {
    if (this.connectedClients.delete(clientId)) this.notify()
  }

  setLanUrls(urls: string[]): void {
    this.lanUrls = urls
  }

  /** Role-specific complete snapshot - also after every reconnect. */
  snapshotFor(role: 'operator'): OperatorQuizViewModel
  snapshotFor(role: 'moderator'): ModeratorQuizViewModel
  snapshotFor(role: 'player'): PlayerQuizViewModel
  snapshotFor(role: 'stage'): PublicQuizViewModel
  snapshotFor(role: ClientRole): SnapshotForAnyRole
  snapshotFor(role: ClientRole): SnapshotForAnyRole {
    const ctx = this.projectionContext()
    if (role === 'operator') return projectOperator(this.state, ctx)
    if (role === 'moderator') return projectModerator(this.state, ctx)
    if (role === 'player') return projectPlayer(this.state, ctx)
    return projectPublic(this.state, ctx)
  }

  private projectionContext(): ProjectionContext {
    const additional: CommandType[] = ['START_NEW_EVENT_DAY', 'APPLY_QUESTION_PATCH', 'RESET_GAME_STATISTICS']
    const statisticsSince = this.store.getSetting(SETTING_STATISTICS_SINCE)
    if (this.resumable) additional.push('RESUME_GAME', 'DISCARD_RESUMABLE_GAME')

    return {
      nowMs: this.now(),
      config: this.content.config,
      assetUrl: (assetId) => this.content.assetUrl(assetId),
      contentVersion: this.content.contentVersion,
      eventDayId: this.eventDay.id,
      selectionRationale: this.selectionRationale,
      auditSummary: this.store.loadAuditEntries(this.state?.gameId ?? null, 40),
      connectedClients: [...this.connectedClients.values()],
      sessionCode: this.sessionCode,
      lanUrls: this.lanUrls,
      warnings: this.warnings,
      soundEnabled: this.soundEnabled,
      locale: this.locale,
      gameCounts: this.store.gameCountsByAudience(statisticsSince),
      statisticsSinceIso: statisticsSince ?? undefined,
      additionalOperatorCommands: additional,
      resumable: this.resumable
        ? {
            gameId: this.resumable.gameId,
            audience: this.resumable.audience,
            presetId: this.resumable.presetId,
            progress: `Frage ${this.resumable.currentSlotIndex + 1}/${this.resumable.totalQuestions}`,
          }
        : undefined,
    }
  }

  /* ------------------------------------------------------------------ *
   * Export and diagnostics
   * ------------------------------------------------------------------ */

  /** Change report of the local hotfixes (specification 25.4). */
  changeReport() {
    return buildChangeReport(this.content.baseQuestions, this.store.loadPatches())
  }

  addWarning(message: string): void {
    if (!this.warnings.includes(message)) this.warnings.push(message)
    this.store.appendAudit({
      gameId: this.state?.gameId ?? null,
      atMs: this.now(),
      actorRole: 'system',
      category: 'system',
      message,
    })
  }

  get eventDayId(): string {
    return this.eventDay.id
  }

  /** For tests only: the authoritative state. */
  get authoritativeState(): GameState | null {
    return this.state
  }

  get resumableState(): GameState | null {
    return this.resumable
  }

  private calendarDate(): string {
    return new Date(this.now()).toISOString().slice(0, 10)
  }

  private reject(reason: CommandRejection['reason'], message: string): DispatchResult {
    return { ok: false, revision: this.currentRevision, rejection: { reason, message, currentRevision: this.currentRevision } }
  }

  private rejectAndRecord(
    envelope: CommandEnvelope,
    reason: CommandRejection['reason'],
    message: string,
  ): DispatchResult {
    // Refusals are recorded too, so that a repeated command gets the same
    // answer and is not suddenly executed after all.
    this.store.recordRejectedCommand(
      envelope.commandId,
      this.currentRevision,
      { reason, message },
      new Date(this.now()).toISOString(),
    )
    if (reason === 'buzzer-already-taken' || reason === 'player-locked' || reason === 'buzzer-closed') {
      // Refused duplicate events matter for the fairness diagnostics.
      this.store.appendAudit({
        gameId: this.state?.gameId ?? null,
        atMs: this.now(),
        actorRole: envelope.actor.role,
        actorClientId: envelope.actor.clientId,
        category: 'buzzer',
        message: `Buzzer abgewiesen: ${message}`,
      })
    }
    return this.reject(reason, message)
  }
}

const serviceCommands = new Set<CommandType>([
  'RESUME_GAME',
  'DISCARD_RESUMABLE_GAME',
  'START_NEW_EVENT_DAY',
  'APPLY_QUESTION_PATCH',
  'RESET_GAME_STATISTICS',
])

function isServiceCommand(type: CommandType): boolean {
  return serviceCommands.has(type)
}

/** Fit for browser and Node alike: `crypto` is global in both worlds. */
function createRandomId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
}
