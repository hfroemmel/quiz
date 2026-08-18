# Architektur

## Schichten und Abhaengigkeitsrichtung

```text
UI (React) / Electron / Serveradapter
        ↓
Application Services  (packages/server)
        ↓
Domain und Contracts  (packages/domain, packages/contracts)

Persistence / WebSocket / Hardware
        ↓ implementieren Ports der Application-Schicht
```

`@quiz/domain` kennt weder React noch Electron, WebSocket oder SQLite. Deshalb laufen
alle Regeltests mit Fake-Clock und ohne UI.

## Wer ist wofuer zustaendig?

| Paket | Verantwortung | Kennt NICHT |
|---|---|---|
| `@quiz/contracts` | Typen, Zod-Schemas, Befehle, Rollenrechte, View-Modelle, `scoringRules`/`gameTiming` | alles andere |
| `@quiz/domain` | Zustandsmaschine, Scoring, Buzzerregeln, Fragenauswahl, Projektion | Dateisystem, Netzwerk, Zeitquelle |
| `@quiz/content` | Legacy-Import, Validierung, Paketbau, Hotfix-Overlay | Spielregeln, Netzwerk |
| `@quiz/persistence` | SQLite-Schema, Migrationen, transaktionale Uebernahme | Spielregeln |
| `@quiz/server` | Befehlsverarbeitung, Sitzungen, WebSocket, Auslieferung, Timer | Spielregeln (delegiert an Domain) |
| `apps/web` | Rendern von View-Modellen, Senden von Befehlen, Praesentation | Spielregeln |
| `apps/desktop` | Fenster, Displays, Preload-Bruecke, Prozessstart | Spielregeln |

## Wo aendere ich was?

| Aenderung | Ort |
|---|---|
| Punkteregel | `packages/domain/src/scoring.ts` und `scoringRules` in `@quiz/contracts` |
| Buzzer-Berechtigung | `packages/domain/src/buzzer.ts` |
| Phasenwechsel | `packages/domain/src/engine.ts` |
| Fragenauswahl, Wiederholungsvermeidung | `packages/domain/src/selection.ts` |
| Was der Buehnenscreen sehen darf | `packages/domain/src/projection.ts` |
| Verfuegbare Buttons je Phase | `packages/domain/src/allowedCommands.ts` |
| Datenbankschema | `packages/persistence/src/migrations.ts` |
| Animationsdauer, Easing, Soundmarke | `apps/web/src/presentation/transitions/` |
| Fachlich relevante Timings | `gameTiming` in `packages/contracts/src/config.ts` |

## Zwei bewusste Abweichungen von der Spezifikation

Beide sind nach Abschnitt 20.3 der Spezifikation ausdruecklich zulaessig
(„Separate Pakete sind nur sinnvoll, wenn sie eine echte fachliche Grenze abbilden“).

1. **Kein eigenes Paket `packages/presentation`.**
   Die Praesentationsschicht liegt unter `apps/web/src/presentation/` und behaelt exakt
   die in Abschnitt 22.2 vorgeschlagene innere Struktur (`scenes/`, `transitions/`,
   `animationPresets.ts`, `soundCues.ts`, `README.md`). Einziger Nutzer sind die
   React-Einstiegspunkte im selben Paket; eine Paketgrenze haette hier keine fachliche
   Grenze abgebildet, aber den Build verkompliziert.

2. **Kein eigenes Paket `packages/ui`.**
   Es gibt bisher nur vier gemeinsam genutzte Bausteine (`ScoreBoard`, `PlayerBadge`,
   `Confetti`, `ConnectionBanner`). Sie liegen unter `apps/web/src/components/`.
   Abstrahiert wird erst, wenn ein zweiter echter Nutzer existiert.

## Fluss eines Befehls

```text
Client (Operator / Moderator / Buzzer)
  → WebSocket-Nachricht mit CommandEnvelope
  → QuizService: Schema, Idempotenz, Rolle, Revision
  → Domain-Engine: reduce(state, command, ctx)
  → QuizStore: EINE Transaktion (Zustand + Punkte + Nutzung + Audit + Revision)
  → Broadcast rollenabhaengiger Snapshots an alle Clients
```

Erst nach erfolgreichem Commit wird verteilt. Faellt die Transaktion aus, bleibt der
letzte konsistente Zustand erhalten und der Operator bekommt eine Klartextmeldung.

## Ports

| Port | Definiert in | Implementiert von |
|---|---|---|
| `QuestionSource` | `packages/domain/src/engine.ts` | `packages/server/src/contentService.ts` |
| Zeit (`nowMs`) | `EngineContext` | Server bzw. Fake-Clock in Tests |
| Zufall (`Rng`) | `packages/domain/src/selection.ts` | Server bzw. `createSeededRng` in Tests |
