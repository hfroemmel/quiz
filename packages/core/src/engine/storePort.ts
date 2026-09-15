/**
 * Storage interface of the application layer.
 *
 * `QuizService` knows exclusively this port - not SQLite. That lets the same
 * service run against two worlds:
 *
 *   - stage operation: the SQLite adapter of the stage operation (ACID, audit,
 *     recovery after a crash);
 *   - kiosk and embedding: `MemoryQuizStore` in `@quiz/runtime`, without native
 *     modules and therefore runnable in a renderer or browser process, too.
 *
 * The cut follows exactly the use by the service; what only tests or
 * diagnostics need (such as row counting) does not belong here.
 */
import type { ActorRole, AuditEntry, GameState, QuestionPatch } from '../contracts'
import type { DomainEvent, EngineEffects } from './engine'

/** Everything that belongs to an accepted command - committed ATOMICALLY. */
export interface CommitInput {
  commandId: string
  actor: { clientId: string; role: ActorRole }
  state: GameState
  events: DomainEvent[]
  effects: EngineEffects
  atMs: number
}

export interface RecordedCommandResponse {
  accepted: boolean
  revisionAfter: number
  response: unknown
}

export interface UsageRow {
  questionId: string
  repetitionGroupId: string | null
  usedAtMs: number
}

/** One row of the game log: all games of one audience. */
export interface GameCountRow {
  audience: string
  total: number
  completed: number
  aborted: number
  /** Time of the most recently started game of this audience. */
  lastAtIso?: string
}

export interface AuditAppendInput {
  gameId?: string | null
  atMs: number
  actorRole: ActorRole
  actorClientId?: string
  category: AuditEntry['category']
  message: string
  data?: Record<string, unknown>
}

export interface QuizStorePort {
  /* Event day */
  ensureEventDay(calendarDate: string, nowIso: string, allowRollover: boolean): { id: string; calendarDate: string }
  startNewEventDay(calendarDate: string, nowIso: string): { id: string; calendarDate: string }

  /* Command idempotency */
  findProcessedCommand(commandId: string): RecordedCommandResponse | null
  recordRejectedCommand(commandId: string, revision: number, response: unknown, nowIso: string): void

  /** The only write method for accepted commands - one transaction. */
  commitCommand(input: CommitInput): void

  /* Reading */
  loadResumableGame(eventDayId: string): GameState | null
  loadUsageHistory(eventDayId: string): UsageRow[]
  loadAuditEntries(gameId: string | null, limit: number): AuditEntry[]

  /** Free audit event outside a command (start, reconnect, error). */
  appendAudit(entry: AuditAppendInput): void

  /* Hotfixes */
  savePatch(patch: QuestionPatch, previousValues: Record<string, unknown>): void
  loadPatches(): QuestionPatch[]

  /* Game log */
  gameCountsByAudience(sinceIso: string | null): GameCountRow[]

  /* Settings */
  getSetting(key: string): string | null
  setSetting(key: string, value: string): void

  close(): void
}
