# @quiz/desktop

**Verantwortung:** Electron-Hauptprozess. Startet den lokalen Quizserver im selben
Prozess, oeffnet Operator- und Praesentationsfenster und stellt eine minimale
Preload-Bruecke bereit.

| Datei | Verantwortung |
|---|---|
| `src/main.ts` | Serverstart, Fenster, Displays, gespeicherte Fensterpositionen, IPC |
| `src/preload.ts` | ausschliesslich Fensterfunktionen (`toggleStageFullscreen`, `openStageWindow`) |
| `build.mjs` | esbuild: Hauptprozess als ESM, Preload als CJS |

## Sicherheit

Renderer laufen mit `contextIsolation: true` und ohne `nodeIntegration`. Die
Preload-Bruecke bietet **kein** Dateisystem, keine Datenbank und keinen Spielzustand.
Alles Fachliche laeuft ueber denselben WebSocket-Vertrag wie bei externen Clients -
es gibt keine zweite, privilegierte Steuerungsschiene.

## Fenster

Das Praesentationsfenster wird auf dem zweiten Display geoeffnet und dort in den
Vollbildmodus geschaltet. Gespeicherte Positionen werden nur verwendet, wenn sie noch
auf einen vorhandenen Bildschirm passen. Schliessen oder Absturz des
Praesentationsfensters beendet das Spiel nicht.

## Natives Modul

```bash
pnpm desktop:rebuild-native   # SQLite fuer Electron
pnpm server:rebuild-native    # SQLite wieder fuer Node (Server und Tests)
```

`better-sqlite3` passt immer nur zu einer Laufzeit. Die Anwendung erkennt den Fall und
nennt den passenden Befehl im Klartext.
