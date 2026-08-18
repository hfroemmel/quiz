# @quiz/server

**Verantwortung:** Anwendungsschicht des lokalen Quizservers. Verbindet Engine,
Inhalt, Persistenz und Zeit. Enthaelt selbst **keine** Spielregeln.

| Datei | Verantwortung |
|---|---|
| `quizService.ts` | Befehlsverarbeitung, Idempotenz, Revision, Timer, Wiederherstellung, Snapshots |
| `contentService.ts` | Quizpaket laden, Hotfix-Overlay, `QuestionSource` fuer die Engine, Asset-URLs |
| `httpServer.ts` | Auslieferung der Clients, Medien, Session- und Exportendpunkte |
| `wsServer.ts` | WebSocket: Rollenpruefung, Snapshots, Befehle, Audio-Master |
| `network.ts` | Session-Code, Loopback-Erkennung, LAN-Adressen, Zugriffsregeln |
| `startServer.ts` | Zusammenbau und Start |
| `main.ts` | Einstiegspunkt `pnpm server` |

**Abhaengigkeiten:** `@quiz/contracts`, `@quiz/domain`, `@quiz/content`,
`@quiz/persistence`, `ws`.

## Verarbeitungsreihenfolge

1. Schema (Zod) → 2. Idempotenz (`commandId`) → 3. Rolle → 4. Revision →
5. Domain-Engine → 6. eine Datenbanktransaktion → 7. Broadcast

## Zugriffsregeln

* Operator: nur ueber Loopback.
* Moderator: Session-Code erforderlich.
* Buehne: ohne Code, aber ausschliesslich oeffentliche Daten und keine Steuerbefehle
  (Ausnahme: `REPORT_VIDEO_STATUS`).

## Umgebungsvariablen

| Variable | Bedeutung | Standard |
|---|---|---|
| `QUIZ_PORT` | Port | `4319` |
| `QUIZ_HOST` | Bindeadresse | `0.0.0.0` |
| `QUIZ_DB` | SQLite-Datei | `runtime/quiz.sqlite` |
| `QUIZ_PACKAGE_DIR` | Quizpaket | `content/dist` |
