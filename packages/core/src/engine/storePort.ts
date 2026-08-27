/**
 * Speicher-Schnittstelle der Anwendungsschicht.
 *
 * `QuizService` kennt ausschliesslich diesen Port - nicht SQLite. Dadurch kann
 * derselbe Dienst gegen zwei Welten laufen:
 *
 *   - Buehnenbetrieb: der SQLite-Adapter des Buehnenbetriebs (ACID, Audit,
 *     Wiederherstellung nach Absturz);
 *   - Kiosk und Einbettung: `MemoryQuizStore` in `@quiz/runtime`, ohne native
 *     Module und damit auch in einem Renderer- oder Browserprozess lauffaehig.
 *
 * Der Zuschnitt folgt exakt der Nutzung durch den Dienst; was nur Tests oder
 * Diagnose brauchen (etwa Zeilenzaehlung), gehoert nicht hierher.
 */
import type { ActorRole, AuditEntry, GameState, QuestionPatch } from '../contracts'
import type { DomainEvent, EngineEffects } from './engine'

/** Alles, was zu einem akzeptierten Befehl gehoert - es wird ATOMAR uebernommen. */
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

/** Eine Zeile des Spielprotokolls: alle Spiele einer Zielgruppe. */
export interface GameCountRow {
  audience: string
  total: number
  completed: number
  aborted: number
  /** Zeitpunkt des zuletzt begonnenen Spiels dieser Zielgruppe. */
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
  /* Veranstaltungstag */
  ensureEventDay(calendarDate: string, nowIso: string, allowRollover: boolean): { id: string; calendarDate: string }
  startNewEventDay(calendarDate: string, nowIso: string): { id: string; calendarDate: string }

  /* Befehlsidempotenz */
  findProcessedCommand(commandId: string): RecordedCommandResponse | null
  recordRejectedCommand(commandId: string, revision: number, response: unknown, nowIso: string): void

  /** Die einzige Schreibmethode fuer akzeptierte Befehle - eine Transaktion. */
  commitCommand(input: CommitInput): void

  /* Lesen */
  loadResumableGame(eventDayId: string): GameState | null
  loadUsageHistory(eventDayId: string): UsageRow[]
  loadAuditEntries(gameId: string | null, limit: number): AuditEntry[]

  /** Freies Auditereignis ausserhalb eines Befehls (Start, Reconnect, Fehler). */
  appendAudit(entry: AuditAppendInput): void

  /* Hotfixes */
  savePatch(patch: QuestionPatch, previousValues: Record<string, unknown>): void
  loadPatches(): QuestionPatch[]

  /* Spielprotokoll */
  gameCountsByAudience(sinceIso: string | null): GameCountRow[]

  /* Einstellungen */
  getSetting(key: string): string | null
  setSetting(key: string, value: string): void

  close(): void
}
