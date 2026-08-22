# Architektur

## Schichten und Abhaengigkeitsrichtung

```text
Anwendungen (apps/web, apps/desktop) / Serveradapter
        ↓
Praesentationsschicht (packages/presentation)
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
| `@quiz/presentation` | Buehnenflaeche: Szenen, Uebergaenge, Soundmarken, Stylesheet der Buehne | Verbindung, Befehle, Spielregeln |
| `apps/web` | Einstiegspunkte je Rolle, Verbindung, Bedienoberflaechen von Operator und Moderator | Spielregeln |
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
| Animationsdauer, Easing, Soundmarke | `packages/presentation/src/transitions/` |
| Fachlich relevante Timings | `gameTiming` in `packages/contracts/src/config.ts` |

## Eine bewusste Abweichung von der Spezifikation

Sie ist nach Abschnitt 20.3 der Spezifikation ausdruecklich zulaessig
(„Separate Pakete sind nur sinnvoll, wenn sie eine echte fachliche Grenze abbilden").

**Kein eigenes Paket `packages/ui`.**
Die Bausteine der Buehne (`Tile`, `OptionBar`, `ProgressRing`, `MediaFrame`,
`AnimationClip`, `Confetti`) liegen unter `packages/presentation/src/ui/`. Sie haben
genau einen Nutzer - die Szenen im selben Paket. `ConnectionBanner` gehoert zur
Bedienoberflaeche und bleibt in `apps/web/src/components/`.

Die frueher hier vermerkte zweite Abweichung - kein eigenes Paket
`packages/presentation` - ist mit der Mehrkontext-Ausbaustufe entfallen: Buehne,
Kiosk und Multigame-Einbettung sind drei echte Nutzer, damit bildet die
Paketgrenze eine fachliche Grenze ab. Siehe
[mehrkontext-architektur.md](mehrkontext-architektur.md).

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
