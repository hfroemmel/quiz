/**
 * Datenbankschema und Migrationen (Spezifikation 23.1).
 *
 * Migrationen sind eine geordnete Liste von SQL-Schritten. Jeder Schritt laeuft genau
 * einmal und wird in `schema_migrations` festgehalten. Neue Aenderungen werden hinten
 * angehaengt; bestehende Schritte werden nie veraendert, damit vorhandene
 * Veranstaltungsdatenbanken weiter lesbar bleiben.
 */
import type { Database } from 'better-sqlite3'

export interface Migration {
  version: number
  name: string
  sql: string
}

export const migrations: Migration[] = [
  {
    version: 1,
    name: 'initial',
    sql: `
      -- Veranstaltungstag: Bezugsrahmen der globalen Wiederholungshistorie.
      CREATE TABLE event_days (
        id            TEXT PRIMARY KEY,
        calendar_date TEXT NOT NULL,
        started_at    TEXT NOT NULL,
        ended_at      TEXT,
        is_active     INTEGER NOT NULL DEFAULT 1
      );

      CREATE TABLE games (
        id            TEXT PRIMARY KEY,
        event_day_id  TEXT NOT NULL REFERENCES event_days(id),
        quiz_mode_id  TEXT NOT NULL,
        preset_id     TEXT NOT NULL,
        status        TEXT NOT NULL,
        created_at    TEXT NOT NULL,
        finished_at   TEXT
      );
      CREATE INDEX idx_games_event_day ON games(event_day_id, status);

      -- Aktueller autoritativer Spielzustand als Snapshot. Nach jedem akzeptierten
      -- Befehl geschrieben, damit ein Neustart exakt hier wieder aufsetzen kann.
      CREATE TABLE game_state (
        game_id    TEXT PRIMARY KEY REFERENCES games(id),
        revision   INTEGER NOT NULL,
        state_json TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      -- Antwortversuche zusaetzlich normalisiert, damit Auswertungen und Berichte
      -- nicht den Snapshot parsen muessen.
      CREATE TABLE attempts (
        id                    TEXT PRIMARY KEY,
        game_id               TEXT NOT NULL REFERENCES games(id),
        question_id           TEXT NOT NULL,
        slot_index            INTEGER NOT NULL,
        player_id             TEXT,
        attempt_number        INTEGER NOT NULL,
        logged_option_id      TEXT,
        logged_manual_verdict TEXT,
        outcome               TEXT,
        awarded_points        INTEGER NOT NULL DEFAULT 0,
        created_at_ms         INTEGER NOT NULL,
        resolved_at_ms        INTEGER
      );
      CREATE INDEX idx_attempts_game ON attempts(game_id);

      -- Jede Punktebuchung, automatisch wie manuell. Vollstaendige Nachvollziehbarkeit.
      CREATE TABLE score_transactions (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        game_id    TEXT NOT NULL REFERENCES games(id),
        player_id  TEXT NOT NULL,
        delta      INTEGER NOT NULL,
        new_score  INTEGER NOT NULL,
        reason     TEXT NOT NULL,
        attempt_id TEXT,
        at_ms      INTEGER NOT NULL
      );
      CREATE INDEX idx_score_game ON score_transactions(game_id);

      -- Globale Nutzungshistorie des Veranstaltungstags. Modus und Preset dienen der
      -- Diagnose, veraendern die Historie aber nicht.
      CREATE TABLE question_usage (
        id                  INTEGER PRIMARY KEY AUTOINCREMENT,
        event_day_id        TEXT NOT NULL REFERENCES event_days(id),
        game_id             TEXT NOT NULL,
        question_id         TEXT NOT NULL,
        repetition_group_id TEXT,
        slot_id             TEXT NOT NULL,
        used_at_ms          INTEGER NOT NULL,
        quiz_mode_id        TEXT NOT NULL,
        preset_id           TEXT NOT NULL
      );
      CREATE INDEX idx_usage_event_day ON question_usage(event_day_id, used_at_ms);
      CREATE INDEX idx_usage_question ON question_usage(question_id);

      -- Idempotenz: bereits verarbeitete Befehle werden nicht erneut ausgefuehrt.
      CREATE TABLE processed_commands (
        command_id     TEXT PRIMARY KEY,
        game_id        TEXT,
        revision_after INTEGER NOT NULL,
        accepted       INTEGER NOT NULL,
        response_json  TEXT NOT NULL,
        processed_at   TEXT NOT NULL
      );

      -- Lokale Live-Hotfixes. Das Basispaket bleibt unveraendert.
      CREATE TABLE question_patches (
        id                   TEXT PRIMARY KEY,
        question_id          TEXT NOT NULL,
        base_content_version TEXT NOT NULL,
        changes_json         TEXT NOT NULL,
        previous_json        TEXT NOT NULL,
        reason               TEXT,
        created_at           TEXT NOT NULL,
        created_by           TEXT NOT NULL,
        apply_mode           TEXT NOT NULL
      );
      CREATE INDEX idx_patches_question ON question_patches(question_id);

      CREATE TABLE audit_log (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        game_id         TEXT,
        at_ms           INTEGER NOT NULL,
        actor_role      TEXT NOT NULL,
        actor_client_id TEXT,
        category        TEXT NOT NULL,
        message         TEXT NOT NULL,
        data_json       TEXT
      );
      CREATE INDEX idx_audit_game ON audit_log(game_id, id);

      -- Globale Einstellungen (aktive Paketversion, Soundstatus, aktiver Veranstaltungstag).
      CREATE TABLE settings (
        key   TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `,
  },
  {
    version: 2,
    name: 'audience-statt-quizmodus',
    sql: `
      -- Schema v2: Aus dem Quizmodus wird die Zielgruppe; Pools sind eine eigene
      -- Achse und stehen im Spielzustand, nicht in einer eigenen Spalte.
      ALTER TABLE games RENAME COLUMN quiz_mode_id TO audience;
      ALTER TABLE question_usage RENAME COLUMN quiz_mode_id TO audience;
    `,
  },
]

export function runMigrations(db: Database): number[] {
  db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
    version    INTEGER PRIMARY KEY,
    name       TEXT NOT NULL,
    applied_at TEXT NOT NULL
  );`)

  const applied = new Set(
    db.prepare('SELECT version FROM schema_migrations').all().map((row) => (row as { version: number }).version),
  )
  const executed: number[] = []

  for (const migration of migrations) {
    if (applied.has(migration.version)) continue
    const apply = db.transaction(() => {
      db.exec(migration.sql)
      db.prepare('INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)').run(
        migration.version,
        migration.name,
        new Date().toISOString(),
      )
    })
    apply()
    executed.push(migration.version)
  }
  return executed
}
