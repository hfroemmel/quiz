# @quiz/runtime

**Verantwortung:** Anwendungsschicht des Quiz. Verbindet Engine, Inhalt, Persistenz
und Zeit. Enthaelt selbst **keine** Spielregeln - die stehen in `@quiz/domain`.

Dieses Paket kennt keinen Transport. Es ist der gemeinsame Kern aller Kontexte:

| Kontext | Wie die Laufzeit eingebunden wird |
|---|---|
| Buehnenbetrieb | `@quiz/server` haengt HTTP und WebSocket davor, damit Operator, Moderator und weitere Praesentationsclients denselben Zustand sehen |
| Kiosk, Multigame-Einbettung | dieselbe Laufzeit lokal im Electron-Hauptprozess |

| Datei | Verantwortung |
|---|---|
| `quizService.ts` | Befehlsverarbeitung, Idempotenz, Revision, Timer, Wiederherstellung, Snapshots |
| `contentService.ts` | Quizpaket laden, Hotfix-Overlay, `QuestionSource` fuer die Engine, Asset-URLs |
| `createRuntime.ts` | Zusammenbau aus Quizpaket, Datenbank und Dienst |

**Abhaengigkeiten:** `@quiz/contracts`, `@quiz/domain`, `@quiz/content`,
`@quiz/persistence`.

## Verarbeitungsreihenfolge

1. Schema (Zod) → 2. Idempotenz (`commandId`) → 3. Rolle → 4. Revision →
5. Domain-Engine → 6. eine Datenbanktransaktion → 7. Benachrichtigung der Zuhoerer

Erst nach erfolgreichem Commit wird verteilt. Faellt die Transaktion aus, bleibt der
letzte konsistente Zustand erhalten.

## Umgebungsvariablen

| Variable | Bedeutung | Standard |
|---|---|---|
| `QUIZ_DB` | SQLite-Datei | `runtime/quiz.sqlite` |
| `QUIZ_PACKAGE_DIR` | Quizpaket | `content/dist` |
