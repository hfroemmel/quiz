# @quiz/server

**Verantwortung:** Transportadapter des Buehnenbetriebs. Er liefert die Clients aus,
verteilt Snapshots und regelt den Zugriff im LAN.

Die Befehlsverarbeitung selbst steht in `@quiz/runtime`; dieses Paket haengt nur
HTTP und WebSocket davor. Spielregeln enthaelt es erst recht keine.

| Datei | Verantwortung |
|---|---|
| `httpServer.ts` | Auslieferung der Clients, Medien, Session- und Exportendpunkte |
| `wsServer.ts` | WebSocket: Rollenpruefung, Snapshots, Befehle, Audio-Master |
| `network.ts` | Session-Code, Loopback-Erkennung, LAN-Adressen, Zugriffsregeln |
| `placeholderMedia.ts` | Ersatzbild fuer fehlende Mediendateien |
| `startServer.ts` | Laufzeit starten, HTTP und WebSocket anhaengen, Port oeffnen |
| `main.ts` | Einstiegspunkt `pnpm server` |

**Abhaengigkeiten:** `@quiz/runtime` (Anwendungsschicht), `@quiz/contracts`,
`@quiz/content`, `@quiz/persistence`, `ws`.

## Verarbeitungsreihenfolge

Sie steht in `@quiz/runtime`: Schema → Idempotenz → Rolle → Revision →
Domain-Engine → eine Datenbanktransaktion. Erst danach verteilt dieser Adapter
die neuen Snapshots.

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
