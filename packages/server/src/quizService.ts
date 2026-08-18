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
import { randomUUID } from 'node:crypto'
import {
  commandEnvelopeSchema,
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
  type ModeratorQuizViewModel,
  type OperatorQuizViewModel,
  type PublicQuizViewModel,
  type QuestionPatch,
} from '@quiz/contracts'
import {
  pauseReveal,
  projectModerator,
  projectOperator,
  projectPublic,
  type ProjectionContext,
} from '@quiz/domain'
import { reduce } from '@quiz/domain'
import { QuizStore } from '@quiz/persistence'
import { buildChangeReport } from '@quiz/content'
import { ContentService } from './contentService.ts'

export interface DispatchResult {
  ok: boolean
  revision: number
  rejection?: CommandRejection
}

export interface QuizServiceOptions {
  store: QuizStore
  content: ContentService
  /** Injizierbar fuer Tests. */
  now?: () => number
  random?: () => number
  sessionCode?: string
  lanUrls?: string[]
}

const SETTING_SOUND = 'sound-enabled'
const SETTING_CONTENT_VERSION = 'active-content-version'

export class QuizService {
  private state: GameState | null = null
  /** Nach einem Neustart gefundenes unvollstaendiges Spiel - erst nach Operatorentscheidung aktiv. */
  private resumable: GameState | null = null
  private eventDay: { id: string; calendarDate: string }
  private transitionTimer: NodeJS.Timeout | null = null
  private soundEnabled: boolean
  private selectionRationale: string | undefined
  private readonly listeners = new Set<() => void>()
  private readonly connectedClients = new Map<string, { role: ActorRole; clientId: string }>()
  private readonly warnings: string[] = []

  readonly store: QuizStore
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
      message: `Unvollstaendiges Spiel gefunden (Frage ${prepared.currentSlotIndex + 1}/${prepared.totalQuestions}). Enthuellung und Video wurden pausiert wiederhergestellt.`,
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
      return this.rejectAndRecord(envelope, 'forbidden-role', `Die Rolle "${envelope.actor.role}" darf "${envelope.command.type}" nicht ausloesen.`)
    }

    // 4. Revision - ein Befehl auf veraltetem Stand wird verstaendlich abgewiesen.
    //    Ausgenommen sind physische Ereignisse wie der Buzzer (siehe
    //    `revisionExemptCommands`); dort entscheidet allein die atomare Pruefung
    //    in der Engine.
    if (requiresRevisionCheck(envelope.command.type) && envelope.expectedRevision !== this.currentRevision) {
      return this.rejectAndRecord(
        envelope,
        'revision-conflict',
        `Der Spielstand hat sich inzwischen geaendert (erwartet ${envelope.expectedRevision}, aktuell ${this.currentRevision}). Die Ansicht wurde aktualisiert.`,
      )
    }

    // 5. Betriebsbefehle laufen nicht durch die Spiel-Engine.
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
      newId: (prefix) => `${prefix}-${randomUUID()}`,
      questionSource: this.content.createQuestionSource(
        this.store.loadUsageHistory(this.eventDay.id),
        this.random,
      ),
      initialSoundEnabled: this.soundEnabled,
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
      const message = `Der Spielstand konnte nicht gespeichert werden: ${(error as Error).message}. Bitte keine weiteren Aktionen ausfuehren und den Speicherort pruefen.`
      this.addWarning(message)
      this.notify()
      return { ok: false, revision: this.currentRevision, rejection: { reason: 'persistence-error', message } }
    }

    this.state = result.state
    if (command.type === 'SET_SOUND_ENABLED') {
      this.soundEnabled = command.enabled
      this.store.setSetting(SETTING_SOUND, String(command.enabled))
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
          message: 'Unterbrochenes Spiel fortgesetzt. Alle Clients wurden mit einem vollstaendigen Snapshot synchronisiert.',
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

      case 'START_NEW_EVENT_DAY': {
        if (this.state?.status === 'active') {
          return this.rejectAndRecord(
            envelope,
            'invalid-phase',
            'Ein laufendes Spiel wird durch einen Tageswechsel nicht zurueckgesetzt. Bitte zuerst beenden.',
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
          id: `patch-${randomUUID()}`,
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
          message: `Hotfix an Frage ${command.questionId} (${Object.keys(patch.changes).join(', ')})${command.reason ? ` - ${command.reason}` : ''}. Basispaket unveraendert.`,
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
        commandId: `system-${randomUUID()}`,
        command: { type: 'ADVANCE_TIMED_PHASE', transitionId: current.transitionId },
        actor: { clientId: 'server', role: 'system' },
        expectedRevision: this.currentRevision,
      })
    }, delay)
    if (typeof this.transitionTimer.unref === 'function') this.transitionTimer.unref()
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
  snapshotFor(role: 'stage'): PublicQuizViewModel
  snapshotFor(role: ClientRole): PublicQuizViewModel | ModeratorQuizViewModel | OperatorQuizViewModel
  snapshotFor(role: ClientRole): PublicQuizViewModel | ModeratorQuizViewModel | OperatorQuizViewModel {
    const ctx = this.projectionContext()
    if (role === 'operator') return projectOperator(this.state, ctx)
    if (role === 'moderator') return projectModerator(this.state, ctx)
    return projectPublic(this.state, ctx)
  }

  private projectionContext(): ProjectionContext {
    const additional: CommandType[] = ['START_NEW_EVENT_DAY', 'APPLY_QUESTION_PATCH']
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
      additionalOperatorCommands: additional,
      resumable: this.resumable
        ? {
            gameId: this.resumable.gameId,
            quizModeId: this.resumable.quizModeId,
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
])

function isServiceCommand(type: CommandType): boolean {
  return serviceCommands.has(type)
}
