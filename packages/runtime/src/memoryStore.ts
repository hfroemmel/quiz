/**
 * In-Memory-Implementierung des `QuizStorePort` (Spezifikation 23, Kioskbetrieb).
 *
 * Sie traegt Kiosk und Einbettung: keine nativen Module, lauffaehig in jedem
 * Renderer- oder Browserprozess. Wer Dauerhaftigkeit braucht, haengt sie ueber
 * `toJSON()`/`fromJSON()` an einen Host-Adapter (Electron-IPC, IndexedDB, ...);
 * `LocalQuizRuntime` ruft dafuer nach jeder Aenderung entprellt `persist` auf.
 *
 * Akzeptierte Grenze gegenueber SQLite: Ein Absturz kann die letzten Befehle
 * verlieren. Fuer die Selbstbedienung ist das in Ordnung - der Buehnenbetrieb
 * behaelt den ACID-Adapter aus `@quiz/persistence`.
 */
import type { AuditEntry, GameState, QuestionPatch } from '@quiz/contracts'
import type {
  AuditAppendInput,
  CommitInput,
  GameCountRow,
  QuizStorePort,
  RecordedCommandResponse,
  UsageRow,
} from '@quiz/domain'

interface EventDayEntry {
  id: string
  calendarDate: string
  active: boolean
}

interface GameEntry {
  gameId: string
  quizModeId: string
  status: GameState['status']
  createdAtIso: string
  updatedAtIso: string
  state: GameState
}

interface AuditRecord extends AuditEntry {
  gameId: string | null
}

interface UsageRecord extends UsageRow {
  eventDayId: string
}

/** Serialisierte Form fuer Host-Adapter. Nur ueber `toJSON`/`fromJSON` anfassen. */
export interface MemoryQuizStoreSnapshot {
  version: 1
  eventDays: EventDayEntry[]
  processedCommands: Record<string, RecordedCommandResponse>
  games: GameEntry[]
  usage: UsageRecord[]
  audit: AuditRecord[]
  auditNextId: number
  patches: QuestionPatch[]
  settings: Record<string, string>
}

export class MemoryQuizStore implements QuizStorePort {
  private eventDays: EventDayEntry[] = []
  private processedCommands = new Map<string, RecordedCommandResponse>()
  private games = new Map<string, GameEntry>()
  private usage: UsageRecord[] = []
  private audit: AuditRecord[] = []
  private auditNextId = 1
  private patches: QuestionPatch[] = []
  private settings = new Map<string, string>()

  /* ---------------- Veranstaltungstag ---------------- */

  ensureEventDay(calendarDate: string, nowIso: string, allowRollover: boolean): { id: string; calendarDate: string } {
    const active = this.eventDays.find((entry) => entry.active)
    if (active && (active.calendarDate === calendarDate || !allowRollover)) {
      return { id: active.id, calendarDate: active.calendarDate }
    }
    if (active) active.active = false
    const created: EventDayEntry = { id: `event-${calendarDate}-${Date.parse(nowIso)}`, calendarDate, active: true }
    this.eventDays.push(created)
    return { id: created.id, calendarDate: created.calendarDate }
  }

  startNewEventDay(calendarDate: string, nowIso: string): { id: string; calendarDate: string } {
    return this.ensureEventDay(calendarDate, nowIso, true)
  }

  /* ---------------- Befehlsidempotenz ---------------- */

  findProcessedCommand(commandId: string): RecordedCommandResponse | null {
    return this.processedCommands.get(commandId) ?? null
  }

  recordRejectedCommand(commandId: string, revision: number, response: unknown, _nowIso: string): void {
    if (this.processedCommands.has(commandId)) return
    this.processedCommands.set(commandId, { accepted: false, revisionAfter: revision, response })
  }

  /* ---------------- Transaktionale Befehlsuebernahme ---------------- */

  commitCommand(input: CommitInput): void {
    const { state } = input
    const nowIso = new Date(input.atMs).toISOString()

    const existing = this.games.get(state.gameId)
    this.games.set(state.gameId, {
      gameId: state.gameId,
      quizModeId: state.quizModeId,
      status: state.status,
      createdAtIso: existing?.createdAtIso ?? nowIso,
      updatedAtIso: nowIso,
      // Eigene Kopie, damit spaetere Engine-Draefte den abgelegten Stand nicht anfassen.
      state: structuredClone(state),
    })

    for (const usageEntry of input.effects.questionUsages) {
      this.usage.push({
        eventDayId: state.eventDayId,
        questionId: usageEntry.questionId,
        repetitionGroupId: usageEntry.repetitionGroupId ?? null,
        usedAtMs: input.atMs,
      })
    }

    for (const event of input.events) {
      this.audit.push({
        id: this.auditNextId++,
        gameId: state.gameId,
        atMs: input.atMs,
        actorRole: input.actor.role,
        category: event.category,
        message: event.message,
      })
    }

    if (!this.processedCommands.has(input.commandId)) {
      this.processedCommands.set(input.commandId, {
        accepted: true,
        revisionAfter: state.revision,
        response: { revision: state.revision },
      })
    }
  }

  /* ---------------- Lesen ---------------- */

  loadResumableGame(eventDayId: string): GameState | null {
    const candidates = [...this.games.values()]
      .filter((entry) => entry.state.eventDayId === eventDayId && entry.status === 'active')
      .sort((a, b) => (a.updatedAtIso < b.updatedAtIso ? 1 : -1))
    const found = candidates[0]
    return found ? structuredClone(found.state) : null
  }

  loadUsageHistory(eventDayId: string): UsageRow[] {
    return this.usage
      .filter((entry) => entry.eventDayId === eventDayId)
      .sort((a, b) => a.usedAtMs - b.usedAtMs)
      .map(({ questionId, repetitionGroupId, usedAtMs }) => ({ questionId, repetitionGroupId, usedAtMs }))
  }

  loadAuditEntries(gameId: string | null, limit: number): AuditEntry[] {
    const rows = gameId ? this.audit.filter((entry) => entry.gameId === gameId) : this.audit
    return rows.slice(-limit).map(({ gameId: _gameId, ...entry }) => entry)
  }

  appendAudit(entry: AuditAppendInput): void {
    this.audit.push({
      id: this.auditNextId++,
      gameId: entry.gameId ?? null,
      atMs: entry.atMs,
      actorRole: entry.actorRole,
      category: entry.category,
      message: entry.message,
    })
  }

  /* ---------------- Hotfixes ---------------- */

  savePatch(patch: QuestionPatch, _previousValues: Record<string, unknown>): void {
    this.patches.push(structuredClone(patch))
  }

  loadPatches(): QuestionPatch[] {
    return [...this.patches].sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1))
  }

  /* ---------------- Spielprotokoll ---------------- */

  gameCountsByMode(sinceIso: string | null): GameCountRow[] {
    const byMode = new Map<string, GameCountRow>()
    for (const entry of this.games.values()) {
      if (sinceIso && entry.createdAtIso < sinceIso) continue
      const row = byMode.get(entry.quizModeId) ?? {
        quizModeId: entry.quizModeId,
        total: 0,
        completed: 0,
        aborted: 0,
      }
      row.total += 1
      if (entry.status === 'completed') row.completed += 1
      if (entry.status === 'aborted') row.aborted += 1
      if (!row.lastAtIso || entry.createdAtIso > row.lastAtIso) row.lastAtIso = entry.createdAtIso
      byMode.set(entry.quizModeId, row)
    }
    return [...byMode.values()]
  }

  /* ---------------- Einstellungen ---------------- */

  getSetting(key: string): string | null {
    return this.settings.get(key) ?? null
  }

  setSetting(key: string, value: string): void {
    this.settings.set(key, value)
  }

  close(): void {
    // Nichts zu schliessen - der Speicher gehoert dem Prozess.
  }

  /* ---------------- Dauerhaftigkeit ueber Host-Adapter ---------------- */

  toJSON(): MemoryQuizStoreSnapshot {
    return structuredClone({
      version: 1 as const,
      eventDays: this.eventDays,
      processedCommands: Object.fromEntries(this.processedCommands),
      games: [...this.games.values()],
      usage: this.usage,
      audit: this.audit,
      auditNextId: this.auditNextId,
      patches: this.patches,
      settings: Object.fromEntries(this.settings),
    })
  }

  static fromJSON(snapshot: MemoryQuizStoreSnapshot): MemoryQuizStore {
    const store = new MemoryQuizStore()
    const data = structuredClone(snapshot)
    store.eventDays = data.eventDays
    store.processedCommands = new Map(Object.entries(data.processedCommands))
    store.games = new Map(data.games.map((entry) => [entry.gameId, entry]))
    store.usage = data.usage
    store.audit = data.audit
    store.auditNextId = data.auditNextId
    store.patches = data.patches
    store.settings = new Map(Object.entries(data.settings))
    return store
  }
}
