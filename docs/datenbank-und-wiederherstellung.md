# Datenbank und Wiederherstellung

Die Laufzeitdatenbank ist SQLite und liegt standardmaessig unter
`runtime/quiz.sqlite` (ueber `QUIZ_DB` aenderbar). Sie ist nicht Teil des Repositories.

## Inhalte

| Tabelle | Inhalt |
|---|---|
| `event_days` | Veranstaltungstage, Bezugsrahmen der Wiederholungshistorie |
| `games` | Spiele mit Modus, Preset und Status |
| `game_state` | aktueller autoritativer Spielzustand als Snapshot |
| `attempts` | alle Antwortversuche, normalisiert |
| `score_transactions` | jede Punktebuchung, automatisch wie manuell |
| `question_usage` | globale Nutzungshistorie mit Frage, Wiederholungsgruppe und Slot |
| `processed_commands` | bereits verarbeitete Command-IDs (Idempotenz) |
| `question_patches` | lokale Live-Hotfixes mit altem und neuem Wert |
| `audit_log` | Auditlog aller Ereignisse |
| `settings` | Soundstatus, aktive Paketversion |
| `schema_migrations` | angewendete Migrationen |

## Transaktionen

Eine relevante Aktion wird atomar gespeichert. Beispiel `RESOLVE_ATTEMPT`:

```text
Versuch bewerten + Punktebuchung + Phasenwechsel + Auditlog + neue Revision
= eine Datenbanktransaktion
```

Erst nach erfolgreichem Commit wird der neue Zustand verteilt. Schlaegt das Speichern
fehl, bleibt der letzte konsistente Zustand erhalten, der Befehl wird mit
`persistence-error` abgewiesen und der Operator sieht eine Klartextwarnung.

## Migrationen

`packages/persistence/src/migrations.ts` enthaelt eine geordnete Liste von
SQL-Schritten. Jeder Schritt laeuft genau einmal und wird in `schema_migrations`
festgehalten. Neue Aenderungen werden **hinten angehaengt**; bestehende Schritte
werden nie veraendert, damit vorhandene Veranstaltungsdatenbanken lesbar bleiben.

## Verhalten nach einem Neustart

1. aktive Quizpaketversion pruefen (Schemaversion und Pruefsumme)
2. letzten aktiven Veranstaltungstag laden
3. unvollstaendiges Spiel erkennen
4. gespeicherten Zustand und laufende Uhren rekonstruieren
5. **den Operator entscheiden lassen**: fortsetzen oder bewusst verwerfen
6. bei Fortsetzen alle Clients mit einem vollstaendigen Snapshot synchronisieren

Das Spiel wird nie automatisch fortgesetzt. Die Startansicht zeigt stattdessen
„Unterbrochenes Spiel gefunden“ mit Modus, Preset und Stand.

### Deterministische Strategie fuer laufende Uhren

Fuer Live-Sicherheit gilt bewusst „nach Crash pausiert wiederherstellen“:

* Eine beim Absturz **laufende Enthuellung** wird als `paused` wiederhergestellt,
  eingefroren auf dem zuletzt persistierten Stand; die Phase wird passend auf
  `reveal-paused` gesetzt. Der Buzzer bleibt offen.
* Ein **laufendes Video** wird auf die zuletzt bekannte Position pausiert.
* Ein **zeitgesteuerter Uebergang** (Feedback, Pausenscreen) wird beim Fortsetzen
  sofort abgeschlossen, statt eine laengst abgelaufene Frist erneut abzuwarten.

## Reconnect

Nach einer Netzwerkunterbrechung erhaelt ein Client sofort:

* den vollstaendigen, rollenabhaengigen Snapshot
* die aktuelle Revision
* die Serverzeit zur Synchronisierung
* die erlaubten Befehle
* gegebenenfalls den laufenden Reveal- oder Videozustand

Clients muessen nie verpasste Einzelereignisse rekonstruieren. Der Web-Client verbindet
mit steigenden Abstaenden (0,5 s bis 8 s) automatisch neu.

## Veranstaltungstag

Die Wiederholungshistorie gilt global fuer einen Veranstaltungstag - unabhaengig von
Modus und Preset. Ein Kalendertagwechsel setzt ein **laufendes** Spiel nicht zurueck:
Der Wechsel erfolgt nur, wenn gerade kein aktives Spiel existiert. Der Operator kann
ueber „Neuen Veranstaltungstag beginnen“ bewusst neu starten.

## Sicherung waehrend der Veranstaltung

Die Datei `runtime/quiz.sqlite` (plus `-wal` und `-shm`) laesst sich jederzeit
kopieren. Fuer eine Sicherung zwischen zwei Spielen genuegt das Kopieren des
Verzeichnisses `runtime/`.
