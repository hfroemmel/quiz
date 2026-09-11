/**
 * Anwendungsschicht des lokalen Quizservers (Spezifikation 18.4 und 23).
 *
 * Ablauf jedes Befehls - bewusst genau diese Reihenfolge:
 *   1. Schema, Rolle und Phase validieren
 *   2. bereits verarbeitete `commandId` idempotent beantworten
 *   3. `expectedRevision` pruefen
 *   4. neuen Zustand ueber die zentrale Engine berechnen
 *   5. Zustand, Punktebuchung, Nutzung und Auditlog in EINER Transaktion speichern
 *   6. Revision ist damit erhoeht
 *   7. erst danach den neuen Zustand verteilen
 *
 * Diese Klasse enthaelt bewusst keine Spielregeln. Sie verbindet Engine, Inhalt,
 * Persistenz und Zeit.
 */
import {
  commandEnvelopeSchema,
  normalizeLifelineConfig,
  questionPatchSchema,
  requiresRevisionCheck,
  roleMayIssue,
  type ActorRole,
  type ClientRole,
  type Command,
  type CommandEnvelope,
  type CommandRejection,
  type CommandType,
  type GameState,
  type LifelineConfig,
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
  /** Injizierbar fuer Tests. */
  now?: () => number
  random?: () => number
  sessionCode?: string
  lanUrls?: string[]
  /**
   * What this installation offers in the way of lifelines. Partial is fine -
   * it is completed by `normalizeLifelineConfig`. Left out means none, and the
   * service then behaves exactly as it did before the feature existed.
   */
  lifelines?: Partial<LifelineConfig>
}

/**
 * Spielbefehle, die ein Spieler nur in der Selbstbedienung ausloesen darf.
 * `roleMayIssue` kennt nur Rolle und Befehlstyp; das Ablaufprofil des laufenden
 * Spiels prueft `dispatch`.
 */
const playerFlowCommands: readonly CommandType[] = [
  'BUZZ',
  'LOG_OPTION_ANSWER',
  'RESOLVE_ATTEMPT',
  'CONTINUE',
  /*
   * A player triggering their own lifeline is the kiosk case, and it is a game
   * command like the others: only in self-service, and only where the
   * configuration says `activationMode: 'player'` (checked separately below).
   */
  'USE_LIFELINE',
]

const SETTING_SOUND = 'sound-enabled'
const SETTING_LOCALE = 'locale'
/** Ab wann das Spielprotokoll zaehlt. Fehlt der Wert, zaehlt es seit jeher. */
const SETTING_STATISTICS_SINCE = 'statistics-since'
const SETTING_CONTENT_VERSION = 'active-content-version'

export class QuizService {
  private state: GameState | null = null
  /** Nach einem Neustart gefundenes unvollstaendiges Spiel - erst nach Operatorentscheidung aktiv. */
  private resumable: GameState | null = null
  private eventDay: { id: string; calendarDate: string }
  private transitionTimer: ReturnType<typeof setTimeout> | null = null
  private soundEnabled: boolean
  /** Sprache des Geraets - wie der Ton eine Einstellung, kein Spielzustand. */
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
  /** Complete, normalized lifeline configuration of this installation. */
  readonly lifelines: LifelineConfig

  constructor(options: QuizServiceOptions) {
    this.store = options.store
    this.content = options.content
    this.now = options.now ?? (() => Date.now())
    this.random = options.random ?? Math.random
    this.sessionCode = options.sessionCode
    this.lanUrls = options.lanUrls ?? []
    this.lifelines = normalizeLifelineConfig(options.lifelines)

    this.soundEnabled = this.store.getSetting(SETTING_SOUND) !== 'false'
    this.locale = this.store.getSetting(SETTING_LOCALE) ?? undefined
    this.eventDay = this.store.ensureEventDay(this.calendarDate(), new Date(this.now()).toISOString(), true)
    this.store.setSetting(SETTING_CONTENT_VERSION, this.content.contentVersion)
    this.warnings.push(...this.content.patchWarnings)

    this.restore()
  }

  /* ------------------------------------------------------------------ *
   * Wiederherstellung nach Neustart (Spezifikation 23.3)
   * ------------------------------------------------------------------ */

  /**
   * Sucht ein unvollstaendiges Spiel und bereitet es vor, macht es aber NICHT
   * automatisch aktiv: Der Operator entscheidet bewusst zwischen Fortsetzen und Abbruch.
   *
   * Deterministische Strategie fuer laufende Uhren (fuer Live-Sicherheit bewusst so
   * gewaehlt): Eine beim Absturz laufende Enthuellung wird als PAUSIERT
   * wiederhergestellt - eingefroren auf dem zuletzt persistierten Stand. Ein laufendes
   * Video wird ebenfalls pausiert. Ein zeitgesteuerter Uebergang (Feedback,
   * Pausenscreen) wird beim Fortsetzen sofort abgeschlossen, statt eine bereits
   * abgelaufene Frist erneut abzuwarten.
   */
  private restore(): void {
    const found = this.store.loadResumableGame(this.eventDay.id)
    if (!found) return

    const prepared: GameState = structuredClone(found)
    // Spielstaende aus einer Version vor der Mehrkontext-Ausbaustufe tragen kein
    // Steuerprofil. Sie stammen zwangslaeufig aus dem Buehnenbetrieb.
    prepared.flowProfile ??= 'operated'
    if (prepared.reveal?.status === 'running') {
      prepared.reveal = pauseReveal(prepared.reveal, prepared.updatedAtMs)
      // Phase und Uhr muessen zusammenpassen: eine eingefrorene Enthuellung ist
      // fachlich `reveal-paused`. Der Buzzer bleibt dabei bewusst offen.
      if (prepared.phase === 'reveal-running') prepared.phase = 'reveal-paused'
    }
    if (prepared.video?.status === 'playing') {
      const elapsed = prepared.video.startedAtServerMs ? prepared.updatedAtMs - prepared.video.startedAtServerMs : 0
      prepared.video = {
        ...prepared.video,
        status: 'paused',
        positionMs: prepared.video.positionMs + Math.max(0, elapsed),
        startedAtServerMs: undefined,
      }
    }
    if (prepared.pendingTransition) {
      prepared.pendingTransition = { ...prepared.pendingTransition, endsAtMs: 0 }
    }

    this.resumable = prepared
    this.store.appendAudit({
      gameId: prepared.gameId,
      atMs: this.now(),
      actorRole: 'system',
      category: 'system',
      message: `Unvollständiges Spiel gefunden (Frage ${prepared.currentSlotIndex + 1}/${prepared.totalQuestions}). Enthüllung und Video wurden pausiert wiederhergestellt.`,
    })
  }

  /* ------------------------------------------------------------------ *
   * Befehlsverarbeitung
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

    // 2. Idempotenz - eine wiederholte `commandId` bucht niemals doppelt.
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

    // 3. Rolle
    if (!roleMayIssue(envelope.actor.role, envelope.command.type)) {
      return this.rejectAndRecord(envelope, 'forbidden-role', `Die Rolle "${envelope.actor.role}" darf "${envelope.command.type}" nicht auslösen.`)
    }

    // 4. Revision - ein Befehl auf veraltetem Stand wird verstaendlich abgewiesen.
    //    Ausgenommen sind physische Ereignisse wie der Buzzer (siehe
    //    `revisionExemptCommands`); dort entscheidet allein die atomare Pruefung
    //    in der Engine.
    if (requiresRevisionCheck(envelope.command.type) && envelope.expectedRevision !== this.currentRevision) {
      return this.rejectAndRecord(
        envelope,
        'revision-conflict',
        `Der Spielstand hat sich inzwischen geändert (erwartet ${envelope.expectedRevision}, aktuell ${this.currentRevision}). Die Ansicht wurde aktualisiert.`,
      )
    }

    // 5. Rollenpolitik, die keine Spielregel ist: Ein Spieler am Touchgeraet darf
    //    ein Spiel beginnen, aber nur ein selbstbedientes. Sonst koennte er ein
    //    Spiel starten, das auf einen Operator wartet, den es dort nicht gibt.
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

    //    Dieselbe Politik fuer das laufende Spiel: Die Befehlssequenz Zuschlag ->
    //    Einloggen -> Bestaetigen -> Weiter ist fuer Spieler nur in der
    //    Selbstbedienung gedacht. In einem operatorgefuehrten Spiel wuerde ein
    //    Spielerbefehl dem Operator in die Auswertung greifen. Die Engine kennt
    //    den Absender nicht, deshalb steht die Wache hier.
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
     * Whose command triggers a lifeline is the one thing `activationMode`
     * decides - and it is a policy of the installation, not a game rule, which
     * is why it stands here and not in the engine. On stage the operator
     * triggers it for the player who asked out loud; at a kiosk the player taps
     * it. A player command in operator mode is refused, and the refusal says
     * why rather than pretending the lifeline is spent.
     */
    if (
      envelope.command.type === 'USE_LIFELINE' &&
      envelope.actor.role === 'player' &&
      this.lifelines.activationMode !== 'player'
    ) {
      return this.rejectAndRecord(
        envelope,
        'forbidden-role',
        'In diesem Spiel setzt der Operator die Joker ein. Am Gerät ist das nicht vorgesehen.',
      )
    }

    /*
     * 6. Der Ton gehoert dem GERAET und nicht dem Spiel.
     *
     * Laeuft ein Spiel, geht der Befehl durch die Engine und steht danach im
     * Spielprotokoll. Laeuft keines, gibt es nichts, worin er stehen koennte -
     * und die Engine wiese ihn ab. Genau dort wird er aber gebraucht: Am
     * Kioskgeraet sitzt der Tonschalter im Startbildschirm, weil ihn dort der
     * bedient, der das Geraet aufstellt, und nicht der, der gerade spielt.
     */
    if (envelope.command.type === 'SET_SOUND_ENABLED' && this.state === null) {
      this.soundEnabled = envelope.command.enabled
      this.store.setSetting(SETTING_SOUND, String(envelope.command.enabled))
      this.notify()
      return { ok: true, revision: this.currentRevision }
    }

    /*
     * Dasselbe fuer die Sprache, und aus demselben Grund: Am Kioskgeraet steht
     * der Umschalter im Startbildschirm, wo kein Spiel laeuft. Laeuft eines,
     * geht der Befehl durch die Engine und steht im Spielprotokoll.
     */
    if (envelope.command.type === 'SET_LOCALE' && this.state === null) {
      this.locale = envelope.command.locale
      this.store.setSetting(SETTING_LOCALE, envelope.command.locale)
      this.notify()
      return { ok: true, revision: this.currentRevision }
    }

    // 7. Betriebsbefehle laufen nicht durch die Spiel-Engine.
    if (isServiceCommand(envelope.command.type)) {
      return this.handleServiceCommand(envelope)
    }

    return this.runEngineCommand(envelope, envelope.command)
  }

  private runEngineCommand(envelope: CommandEnvelope, command: Command): DispatchResult {
    const nowMs = this.now()
    const result = reduce(this.state, command, {
      nowMs,
      eventDayId: this.eventDay.id,
      newId: (prefix) => `${prefix}-${createRandomId()}`,
      questionSource: this.content.createQuestionSource(
        this.store.loadUsageHistory(this.eventDay.id),
        this.random,
      ),
      initialSoundEnabled: this.soundEnabled,
      initialLocale: this.locale,
      lifelines: this.lifelines,
      random: this.random,
    })

    if (!result.ok) {
      return this.rejectAndRecord(envelope, result.rejection.reason, result.rejection.message)
    }

    // 6. Erst persistieren, dann verteilen. Faellt die Transaktion aus, bleibt der
    //    letzte konsistente Zustand erhalten und es wird nichts gesendet.
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

  /** Wiederherstellung, Veranstaltungstag und Hotfixes - bewusst ausserhalb der Engine. */
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
         * Zurueckgesetzt wird die ZAEHLUNG, nicht der Bestand: Spielstaende,
         * Versuche und Auditlog haengen an denselben Zeilen. Ab jetzt zaehlt das
         * Protokoll neu.
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

        // Der Patch wird gegen dasselbe Schema geprueft wie der Basisinhalt.
        const previousValues: Record<string, unknown> = {}
        for (const field of Object.keys(patch.changes)) {
          previousValues[field] = (original as unknown as Record<string, unknown>)[field]
        }
        this.store.savePatch(patch, previousValues)
        this.content.applyPatchOverlay(this.store.loadPatches())

        // Nur bei ausdruecklichem "Jetzt uebernehmen" geht die Aenderung sofort auf
        // den Buehnenscreen. Sonst wirkt sie erst beim naechsten Einsatz der Frage.
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
   * Zeitgesteuerte Uebergaenge
   * ------------------------------------------------------------------ */

  /**
   * Setzt den Fallback-Timer fuer die aktuelle zeitgesteuerte Phase.
   *
   * Der fachliche Zustandswechsel haengt damit niemals davon ab, ob ein Browser ein
   * `animationend`-Event liefert (Spezifikation 22.1).
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
    // In Node haelt ein aktiver Timer den Prozess am Leben - `unref` gibt ihn
    // frei. Im Browser gibt es die Methode nicht; der Zugriff bleibt strukturell.
    const timer = this.transitionTimer as { unref?: () => void }
    if (typeof timer.unref === 'function') timer.unref()
  }

  /** Fuer Tests und geordnetes Herunterfahren. */
  stopTimers(): void {
    if (this.transitionTimer) clearTimeout(this.transitionTimer)
    this.transitionTimer = null
  }

  /* ------------------------------------------------------------------ *
   * Verteilung
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

  /** Rollenabhaengiger vollstaendiger Snapshot - auch nach jedem Reconnect. */
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
      lifelines: this.lifelines,
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
   * Export und Diagnose
   * ------------------------------------------------------------------ */

  /** Aenderungsbericht der lokalen Hotfixes (Spezifikation 25.4). */
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

  /** Nur fuer Tests: der autoritative Zustand. */
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
    // Auch Ablehnungen werden vermerkt, damit ein wiederholter Befehl dieselbe
    // Antwort bekommt und nicht plotzlich doch ausgefuehrt wird.
    this.store.recordRejectedCommand(
      envelope.commandId,
      this.currentRevision,
      { reason, message },
      new Date(this.now()).toISOString(),
    )
    if (reason === 'buzzer-already-taken' || reason === 'player-locked' || reason === 'buzzer-closed') {
      // Abgewiesene Doppelereignisse sind fuer die Fairnessdiagnose relevant.
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

/** Browser- wie Node-tauglich: `crypto` ist in beiden Welten global. */
function createRandomId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
}
