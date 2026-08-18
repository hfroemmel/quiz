# @quiz/persistence

**Verantwortung:** SQLite-Adapter des lokalen Servers. Schema, Migrationen und die
transaktionale Uebernahme akzeptierter Befehle. Enthaelt keine Spielregeln.

| Datei | Verantwortung |
|---|---|
| `migrations.ts` | geordnete Liste der SQL-Schritte, genau einmal angewendet |
| `store.ts` | `QuizStore`: Veranstaltungstage, Befehlsidempotenz, `commitCommand`, Historie, Auditlog, Hotfixes, Einstellungen |

**Oeffentliche API:** `QuizStore`, `runMigrations`, `migrations`.

**Abhaengigkeiten:** `@quiz/contracts`, `@quiz/domain` (nur Typen der Effekte),
`better-sqlite3`.

## Zentrale Zusage

`commitCommand` speichert Zustand, Versuche, Punktebuchungen, Nutzungshistorie,
Auditlog und die verarbeitete Command-ID in **einer** Transaktion. Erst nach
erfolgreichem Commit verteilt der Server den neuen Zustand.

## Aenderungshinweis

Neue Schemaaenderungen werden als **neuer** Migrationsschritt hinten angehaengt.
Bestehende Schritte werden nie veraendert, damit vorhandene Veranstaltungsdatenbanken
lesbar bleiben.

Details: [docs/datenbank-und-wiederherstellung.md](../../docs/datenbank-und-wiederherstellung.md).
