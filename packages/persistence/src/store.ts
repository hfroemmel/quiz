/**
 * SQLite-Adapter des lokalen Quizservers (Spezifikation 23).
 *
 * Wichtigste Zusage: Eine relevante Aktion wird ATOMAR gespeichert. Beispiel
 * `RESOLVE_ATTEMPT`:
 *
 *   Versuch bewerten + Punktebuchung + Phasenwechsel + Auditlog + neue Revision
 *   = eine Datenbanktransaktion
 *
 * Erst nach erfolgreichem Commit verteilt der Server den neuen Zustand an Clients.
 * Deshalb gibt es hier genau eine Schreibmethode fuer akzeptierte Befehle:
 * `commitCommand`.
 */
import Database from 'better-sqlite3'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import type { ActorRole, AuditEntry, GameState, QuestionPatch } from '@hfroemmel/quiz-core'
import type { CommitInput, GameCountRow, QuizStorePort, RecordedCommandResponse, UsageRow } from '@hfroemmel/quiz-core'
import { runMigrations } from './migrations'

// Die Vertragsformen des Ports werden mit ausgeliefert, damit Konsumenten dieses
// Adapters nicht zusaetzlich an `@quiz/domain` haengen muessen.
export type { CommitInput, GameCountRow, RecordedCommandResponse, UsageRow }

export class QuizStore implements QuizStorePort {
  private readonly db: Database.Database

  constructor(filePath: string) {
    if (filePath !== ':memory:') mkdirSync(dirname(filePath), { recursive: true })
    try {
      this.db = new Database(filePath)
    } catch (error) {
      // Haeufigster Stolperstein: Das native SQLite-Modul wurde fuer die jeweils
      // andere Laufzeit gebaut (Node oder Electron). Statt eines kryptischen
      // NODE_MODULE_VERSION-Fehlers bekommt der Operator die passende Anweisung.
      const message = (error as Error).message
      if (message.includes('NODE_MODULE_VERSION') || message.includes('did not self-register')) {
        throw new Error(
          'Die SQLite-Bibliothek passt nicht zur aktuellen Laufzeit. ' +
            'Fuer die Desktop-Anwendung: "pnpm desktop:rebuild-native". ' +
            'Fuer den reinen Node-Server: "pnpm server:rebuild-native".',
        )
      }
      throw error
    }
    // WAL haelt Lesen und Schreiben waehrend der Show auseinander; FULL-Synchronisation
    // ist hier bewusst nicht noetig, NORMAL ist fuer lokalen Betrieb der richtige
    // Kompromiss aus Sicherheit und Schreiblatenz.
    this.db.pragma('journal_mode = WAL')
    this.db.pragma('synchronous = NORMAL')
    this.db.pragma('foreign_keys = ON')
    runMigrations(this.db)
  }

  close(): void {
    this.db.close()
  }

  /* ---------------- Veranstaltungstag ---------------- */

  /**
   * Liefert den aktiven Veranstaltungstag oder legt ihn an.
   *
   * Ein Kalendertagwechsel setzt ein laufendes Spiel NICHT zurueck: Der Wechsel
   * geschieht nur, wenn gerade kein aktives Spiel existiert (Spezifikation 17.4).
   */
  ensureEventDay(calendarDate: string, nowIso: string, allowRollover: boolean): { id: string; calendarDate: string } {
    const active = this.db
      .prepare('SELECT id, calendar_date FROM event_days WHERE is_active = 1 ORDER BY started_at DESC LIMIT 1')
      .get() as { id: string; calendar_date: string } | undefined

    if (active && (active.calendar_date === calendarDate || !allowRollover)) {
      return { id: active.id, calendarDate: active.calendar_date }
    }

    const id = `event-${calendarDate}-${Date.parse(nowIso)}`
    const create = this.db.transaction(() => {
      if (active) {
        this.db.prepare('UPDATE event_days SET is_active = 0, ended_at = ? WHERE id = ?').run(nowIso, active.id)
      }
      this.db
        .prepare('INSERT INTO event_days (id, calendar_date, started_at, is_active) VALUES (?, ?, ?, 1)')
        .run(id, calendarDate, nowIso)
    })
    create()
    return { id, calendarDate }
  }

  /** Bewusster Operatorbefehl: neuen Veranstaltungstag beginnen. */
  startNewEventDay(calendarDate: string, nowIso: string): { id: string; calendarDate: string } {
    return this.ensureEventDay(calendarDate, nowIso, true)
  }

  /* ---------------- Befehlsidempotenz ---------------- */

  /** Bereits verarbeitet? Dann wird die urspruengliche Antwort erneut geliefert. */
  findProcessedCommand(commandId: string): RecordedCommandResponse | null {
    const row = this.db
      .prepare('SELECT accepted, revision_after, response_json FROM processed_commands WHERE command_id = ?')
      .get(commandId) as { accepted: number; revision_after: number; response_json: string } | undefined
    if (!row) return null
    return {
      accepted: row.accepted === 1,
      revisionAfter: row.revision_after,
      response: JSON.parse(row.response_json),
    }
  }

  /** Abgelehnte Befehle werden ebenfalls vermerkt, damit Wiederholungen gleich antworten. */
  recordRejectedCommand(commandId: string, revision: number, response: unknown, nowIso: string): void {
    this.db
      .prepare(
        `INSERT OR IGNORE INTO processed_commands (command_id, game_id, revision_after, accepted, response_json, processed_at)
         VALUES (?, NULL, ?, 0, ?, ?)`,
      )
      .run(commandId, revision, JSON.stringify(response), nowIso)
  }

  /* ---------------- Transaktionale Befehlsuebernahme ---------------- */

  /**
   * Speichert alles, was zu einem akzeptierten Befehl gehoert, in genau einer
   * Transaktion. Faellt irgendein Teil aus, bleibt der letzte konsistente Zustand
   * erhalten und es wird nichts verteilt.
   */
  commitCommand(input: CommitInput): void {
    const { state, effects, events, actor } = input
    const nowIso = new Date(input.atMs).toISOString()

    const transaction = this.db.transaction(() => {
      this.db
        .prepare(
          `INSERT INTO games (id, event_day_id, audience, preset_id, status, created_at, finished_at)
           VALUES (@id, @eventDayId, @audience, @presetId, @status, @createdAt, @finishedAt)
           ON CONFLICT(id) DO UPDATE SET status = excluded.status, finished_at = excluded.finished_at`,
        )
        .run({
          id: state.gameId,
          eventDayId: state.eventDayId,
          audience: state.audience,
          presetId: state.presetId,
          status: state.status,
          createdAt: nowIso,
          finishedAt: state.status === 'active' ? null : nowIso,
        })

      this.db
        .prepare(
          `INSERT INTO game_state (game_id, revision, state_json, updated_at)
           VALUES (?, ?, ?, ?)
           ON CONFLICT(game_id) DO UPDATE SET revision = excluded.revision, state_json = excluded.state_json, updated_at = excluded.updated_at`,
        )
        .run(state.gameId, state.revision, JSON.stringify(state), nowIso)

      const upsertAttempt = this.db.prepare(
        `INSERT INTO attempts (id, game_id, question_id, slot_index, player_id, attempt_number,
                               logged_option_id, logged_manual_verdict, outcome, awarded_points, created_at_ms, resolved_at_ms)
         VALUES (@id, @gameId, @questionId, @slotIndex, @playerId, @attemptNumber,
                 @loggedOptionId, @loggedManualVerdict, @outcome, @awardedPoints, @createdAtMs, @resolvedAtMs)
         ON CONFLICT(id) DO UPDATE SET
           logged_option_id = excluded.logged_option_id,
           logged_manual_verdict = excluded.logged_manual_verdict,
           outcome = excluded.outcome,
           awarded_points = excluded.awarded_points,
           resolved_at_ms = excluded.resolved_at_ms`,
      )
      for (const attempt of state.attempts) {
        upsertAttempt.run({
          id: attempt.id,
          gameId: state.gameId,
          questionId: attempt.questionId,
          slotIndex: attempt.slotIndex,
          playerId: attempt.playerId,
          attemptNumber: attempt.attemptNumber,
          loggedOptionId: attempt.loggedOptionId ?? null,
          loggedManualVerdict: attempt.loggedManualVerdict ?? null,
          outcome: attempt.outcome ?? null,
          awardedPoints: attempt.awardedPoints,
          createdAtMs: attempt.createdAtMs,
          resolvedAtMs: attempt.resolvedAtMs ?? null,
        })
      }

      const insertScore = this.db.prepare(
        `INSERT INTO score_transactions (game_id, player_id, delta, new_score, reason, attempt_id, at_ms)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      for (const transactionEntry of effects.scoreTransactions) {
        insertScore.run(
          state.gameId,
          transactionEntry.playerId,
          transactionEntry.delta,
          transactionEntry.newScore,
          transactionEntry.reason,
          transactionEntry.attemptId ?? null,
          input.atMs,
        )
      }

      const insertUsage = this.db.prepare(
        `INSERT INTO question_usage (event_day_id, game_id, question_id, repetition_group_id, slot_id, used_at_ms, audience, preset_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      for (const usage of effects.questionUsages) {
        insertUsage.run(
          state.eventDayId,
          state.gameId,
          usage.questionId,
          usage.repetitionGroupId ?? null,
          usage.slotId,
          input.atMs,
          state.audience,
          state.presetId,
        )
      }

      const insertAudit = this.db.prepare(
        `INSERT INTO audit_log (game_id, at_ms, actor_role, actor_client_id, category, message, data_json)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      for (const event of events) {
        insertAudit.run(
          state.gameId,
          input.atMs,
          actor.role,
          actor.clientId,
          event.category,
          event.message,
          event.data ? JSON.stringify(event.data) : null,
        )
      }

      this.db
        .prepare(
          `INSERT INTO processed_commands (command_id, game_id, revision_after, accepted, response_json, processed_at)
           VALUES (?, ?, ?, 1, ?, ?)
           ON CONFLICT(command_id) DO NOTHING`,
        )
        .run(input.commandId, state.gameId, state.revision, JSON.stringify({ revision: state.revision }), nowIso)
    })

    transaction()
  }

  /* ---------------- Lesen ---------------- */

  /** Letztes noch aktives Spiel eines Veranstaltungstags - Basis der Wiederherstellung. */
  loadResumableGame(eventDayId: string): GameState | null {
    const row = this.db
      .prepare(
        `SELECT gs.state_json FROM game_state gs
         JOIN games g ON g.id = gs.game_id
         WHERE g.event_day_id = ? AND g.status = 'active'
         ORDER BY gs.updated_at DESC LIMIT 1`,
      )
      .get(eventDayId) as { state_json: string } | undefined
    return row ? (JSON.parse(row.state_json) as GameState) : null
  }

  loadGameState(gameId: string): GameState | null {
    const row = this.db.prepare('SELECT state_json FROM game_state WHERE game_id = ?').get(gameId) as
      | { state_json: string }
      | undefined
    return row ? (JSON.parse(row.state_json) as GameState) : null
  }

  /**
   * Nutzungshistorie des Veranstaltungstags, adressiert ueber `repetitionGroupId`
   * beziehungsweise `questionId`. Bewusst ohne Modus- und Presetfilter: die Historie
   * gilt global (Spezifikation 17.1).
   */
  loadUsageHistory(eventDayId: string): UsageRow[] {
    return this.db
      .prepare(
        `SELECT question_id AS questionId, repetition_group_id AS repetitionGroupId, used_at_ms AS usedAtMs
         FROM question_usage WHERE event_day_id = ? ORDER BY used_at_ms ASC`,
      )
      .all(eventDayId) as UsageRow[]
  }

  loadAuditEntries(gameId: string | null, limit: number): AuditEntry[] {
    const rows = gameId
      ? (this.db
          .prepare(
            `SELECT id, at_ms, actor_role, category, message FROM audit_log
             WHERE game_id = ? ORDER BY id DESC LIMIT ?`,
          )
          .all(gameId, limit) as AuditRow[])
      : (this.db
          .prepare('SELECT id, at_ms, actor_role, category, message FROM audit_log ORDER BY id DESC LIMIT ?')
          .all(limit) as AuditRow[])

    return rows
      .map((row) => ({
        id: row.id,
        atMs: row.at_ms,
        actorRole: row.actor_role as ActorRole,
        category: row.category as AuditEntry['category'],
        message: row.message,
      }))
      .reverse()
  }

  /** Freies Auditereignis ausserhalb eines Befehls (Start, Reconnect, Fehler). */
  appendAudit(entry: {
    gameId?: string | null
    atMs: number
    actorRole: ActorRole
    actorClientId?: string
    category: AuditEntry['category']
    message: string
    data?: Record<string, unknown>
  }): void {
    this.db
      .prepare(
        `INSERT INTO audit_log (game_id, at_ms, actor_role, actor_client_id, category, message, data_json)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        entry.gameId ?? null,
        entry.atMs,
        entry.actorRole,
        entry.actorClientId ?? null,
        entry.category,
        entry.message,
        entry.data ? JSON.stringify(entry.data) : null,
      )
  }

  /* ---------------- Hotfixes ---------------- */

  savePatch(patch: QuestionPatch, previousValues: Record<string, unknown>): void {
    this.db
      .prepare(
        `INSERT INTO question_patches (id, question_id, base_content_version, changes_json, previous_json, reason, created_at, created_by, apply_mode)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        patch.id,
        patch.questionId,
        patch.baseContentVersion,
        JSON.stringify(patch.changes),
        JSON.stringify(previousValues),
        patch.reason ?? null,
        patch.createdAt,
        patch.createdBy,
        patch.applyMode,
      )
  }

  loadPatches(): QuestionPatch[] {
    const rows = this.db
      .prepare('SELECT * FROM question_patches ORDER BY created_at ASC')
      .all() as PatchRow[]
    return rows.map((row) => ({
      id: row.id,
      questionId: row.question_id,
      baseContentVersion: row.base_content_version,
      changes: JSON.parse(row.changes_json),
      reason: row.reason ?? undefined,
      createdAt: row.created_at,
      createdBy: 'operator',
      applyMode: row.apply_mode as QuestionPatch['applyMode'],
    }))
  }

  /* ---------------- Spielprotokoll ---------------- */

  /**
   * Gespielte Spiele je Zielgruppe.
   *
   * `sinceIso` begrenzt die Zaehlung auf Spiele ab diesem Zeitpunkt. So laesst
   * sich das Protokoll zuruecksetzen, ohne Spiele zu loeschen: Spielstaende,
   * Versuche und Auditlog haengen an denselben Zeilen und wuerden mitgeloescht.
   */
  gameCountsByAudience(sinceIso: string | null): GameCountRow[] {
    const rows = this.db
      .prepare(
        `SELECT audience,
                COUNT(*)                                             AS total,
                SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed,
                SUM(CASE WHEN status = 'aborted'   THEN 1 ELSE 0 END) AS aborted,
                MAX(created_at)                                      AS last_at
           FROM games
          WHERE (@since IS NULL OR created_at >= @since)
       GROUP BY audience`,
      )
      .all({ since: sinceIso }) as {
      audience: string
      total: number
      completed: number
      aborted: number
      last_at: string | null
    }[]

    return rows.map((row) => ({
      audience: row.audience,
      total: row.total,
      completed: row.completed,
      aborted: row.aborted,
      lastAtIso: row.last_at ?? undefined,
    }))
  }

  /* ---------------- Einstellungen ---------------- */

  getSetting(key: string): string | null {
    const row = this.db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined
    return row?.value ?? null
  }

  setSetting(key: string, value: string): void {
    this.db
      .prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
      .run(key, value)
  }

  /** Nur fuer Tests und Diagnose. */
  countRows(table: string): number {
    const allowed = new Set([
      'games',
      'game_state',
      'attempts',
      'score_transactions',
      'question_usage',
      'processed_commands',
      'audit_log',
      'question_patches',
      'event_days',
    ])
    if (!allowed.has(table)) throw new Error(`Unbekannte Tabelle: ${table}`)
    return (this.db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get() as { count: number }).count
  }
}

interface AuditRow {
  id: number
  at_ms: number
  actor_role: string
  category: string
  message: string
}

interface PatchRow {
  id: string
  question_id: string
  base_content_version: string
  changes_json: string
  previous_json: string
  reason: string | null
  created_at: string
  created_by: string
  apply_mode: string
}
