# Befehle und Rollenrechte

Jede Zustandsaenderung laeuft ueber genau einen typisierten Befehl. Die Tabelle unten
ist aus `packages/contracts/src/commands.ts` erzeugt - dort steht die einzige Quelle
der Wahrheit (`commandRoles`). Weder Operator- noch Moderatorclient bauen sie nach:
Beide werten `allowedCommands` aus dem View-Modell aus.

## Envelope

```ts
interface CommandEnvelope {
  commandId: string        // eindeutig; Wiederholungen werden idempotent beantwortet
  command: Command         // diskriminierte Union
  actor: { clientId: string; role: 'operator' | 'moderator' | 'system' | 'buzzer' }
  expectedRevision: number // Revision, auf der der Client entschieden hat
  issuedAtClient?: string
}
```

## Serverseitige Verarbeitung

1. Schema pruefen (Zod)
2. bereits verarbeitete `commandId` idempotent beantworten
3. Rolle pruefen (`commandRoles`)
4. `expectedRevision` pruefen (siehe Spalte „Revisionspruefung“)
5. neuen Zustand ueber die Domain-Engine berechnen
6. Zustand, Punktebuchung, Nutzung und Auditlog in EINER Transaktion speichern
7. Revision erhoehen und rollenabhaengige Snapshots verteilen

## Spielerzahl

`START_GAME` traegt optional `playerCount` (1 oder 2) und `playerLabels`. Ohne
Angabe entsteht ein Duell; der Buehnenbetrieb schickt die Spielerzahl deshalb
nicht mit. Die Auswirkungen stehen in
[zustandsmaschine.md](zustandsmaschine.md#spielerzahl).

## Tabelle

| Befehl | erlaubte Rollen | Revisionspruefung |
|---|---|---|
| `START_GAME` | operator | ja |
| `OPEN_BUZZER` | operator, moderator | ja |
| `BUZZ` | operator, buzzer | nein |
| `SELECT_PLAYER_MANUALLY` | operator | nein |
| `LOG_OPTION_ANSWER` | operator | ja |
| `MARK_MANUAL_ANSWER` | operator | ja |
| `RESOLVE_ATTEMPT` | operator, moderator | ja |
| `RESOLVE_WITHOUT_ANSWER` | operator, moderator | ja |
| `PASS_SECOND_CHANCE` | operator, moderator | ja |
| `RESET_BUZZER` | operator | ja |
| `PAUSE_IMAGE_REVEAL` | operator, moderator | ja |
| `RESUME_IMAGE_REVEAL` | operator, moderator | ja |
| `REVEAL_IMAGE_COMPLETELY` | operator | ja |
| `RESET_IMAGE_REVEAL` | operator | ja |
| `START_VIDEO` | operator | ja |
| `PAUSE_VIDEO` | operator | ja |
| `SEEK_VIDEO` | operator | ja |
| `RESTART_VIDEO` | operator | ja |
| `SHOW_QUESTION_AFTER_VIDEO` | operator, moderator | ja |
| `REPORT_VIDEO_STATUS` | operator, system | nein |
| `ADJUST_SCORE` | operator | ja |
| `CONTINUE` | operator, moderator | ja |
| `ABORT_GAME` | operator | ja |
| `SKIP_QUESTION` | operator | ja |
| `SET_SOUND_ENABLED` | operator | ja |
| `ADVANCE_TIMED_PHASE` | system, operator | nein |
| `RESUME_GAME` | operator | ja |
| `DISCARD_RESUMABLE_GAME` | operator | ja |
| `START_NEW_EVENT_DAY` | operator | ja |
| `APPLY_QUESTION_PATCH` | operator | ja |

## Warum manche Befehle ohne Revisionspruefung laufen

`expectedRevision` schuetzt vor widerspruechlichen **Entscheidungen**, die zwei Clients
auf demselben Stand treffen. Ein Buzzer ist aber keine Entscheidung auf Basis eines
gesehenen Zustands, sondern ein physisches Ereignis: Gibt der Operator den Buzzer frei
und ein Spieler drueckt 50 Millisekunden spaeter, kennt sein Client die neue Revision
noch nicht. Eine Ablehnung waere im Live-Betrieb inakzeptabel.

Die Fairness bleibt gewahrt, weil der Server weiterhin atomar entscheidet: Phase,
Freigabe und Spielersperre werden bei jedem Ereignis frisch geprueft, und nach dem
ersten angenommenen Buzzer wird jeder weitere abgewiesen.

Ausgenommen sind ausschliesslich `BUZZ`, `SELECT_PLAYER_MANUALLY`,
`ADVANCE_TIMED_PHASE` (durch `transitionId` geschuetzt) und `REPORT_VIDEO_STATUS`.

## Rollen im Klartext

**Operator** (nur vom Veranstaltungslaptop) besitzt die vollstaendige technische
Kontrolle: Spiel starten und abbrechen, Buzzer und Spielerzuordnung, Antworten
einloggen und bewerten, aufloesen, weiterschalten, Bildenthuellung und Video steuern,
Punkte korrigieren, Sound und Vollbild, Fragen ueberspringen, korrigieren oder
deaktivieren, technische Wiederherstellung.

**Moderator** (iPad im LAN, Session-Code erforderlich) darf in der initialen
Ausbaustufe genau vier Dinge: aufloesen, `Weiter`, Bildenthuellung pausieren und
fortsetzen, die naechste Antwortphase freigeben. Er darf **nicht**: Punkte aendern,
das Spiel abbrechen, technische Einstellungen aendern, Inhalte bearbeiten oder Daten
zuruecksetzen. Moderatoraktionen erscheinen im Operatorprotokoll.

**Buehnenclients** duerfen ueberhaupt keine Steuerbefehle senden. Einzige Ausnahme ist
`REPORT_VIDEO_STATUS`, damit ein Medienfehler den Operator erreicht.

## Ablehnungsgruende

| Grund | Bedeutung |
|---|---|
| `invalid-payload` | Schema oder Referenz ungueltig |
| `forbidden-role` | Rolle darf diesen Befehl nicht ausloesen |
| `revision-conflict` | Der Spielstand hat sich inzwischen geaendert |
| `invalid-phase` | In dieser Phase gibt es diese Aktion nicht |
| `no-active-game` | Es laeuft kein Spiel |
| `buzzer-closed` / `buzzer-already-taken` / `player-locked` | Buzzerregeln |
| `no-pending-attempt` / `attempt-already-resolved` / `answer-not-logged` | Antwortablauf |
| `no-candidate-question` | Kein Kandidat fuer den Fragenplatz |
| `nothing-to-resume` | Kein unterbrochenes Spiel vorhanden |
| `invalid-patch` | Hotfix passt nicht zum Basispaket |
| `persistence-error` | Speichern fehlgeschlagen - keine weiteren irreversiblen Aktionen |

Jede Ablehnung enthaelt eine Klartextmeldung mit einer sicheren naechsten Aktion.
