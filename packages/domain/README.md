# @quiz/domain

**Verantwortung:** Alle Spielregeln. Dieses Paket ist die einzige Stelle, an der
Phasen wechseln, Punkte entstehen, Buzzer-Berechtigungen entschieden und Fragen
ausgewaehlt werden.

**Abhaengigkeiten:** nur `@quiz/contracts`. Kein React, kein Electron, kein
WebSocket, kein SQLite, keine echte Systemzeit. Dadurch laufen alle Regeltests
ohne UI und mit Fake-Clock.

| Datei | Verantwortung |
|---|---|
| `engine.ts` | `reduce(state, command, ctx)` - die autoritative Zustandsmaschine |
| `scoring.ts` | Punkteregeln, Punktedeckelung, Ergebnisermittlung |
| `buzzer.ts` | Buzzer-Berechtigung; Hardware und manuelle Auswahl teilen sich diese Pruefung |
| `reveal.ts` | Enthuellungsuhr; Countdown und Bildschaerfe stammen aus derselben Variable |
| `selection.ts` | Fragenauswahl, Wiederholungsvermeidung, Optionsreihenfolge |
| `allowedCommands.ts` | ableitbare Befehlsliste je Rolle (Clients bauen sie nicht nach) |
| `projection.ts` | Filterung auf oeffentliches / Moderator- / Operator-View-Modell |

## Ports

Die Engine kennt den Fragenpool nicht selbst. Sie fragt ueber `QuestionSource`
(`engine.ts`) nach einer Frage fuer einen Fragenplatz. Der Server implementiert
diesen Port mit Quizpaket, Hotfix-Overlay und Nutzungshistorie.

## Erweiterungspunkte

* **Neuer Befehl:** in `@quiz/contracts` ergaenzen, dann in `reduce` behandeln und in
  `allowedCommands.ts` einer Phase zuordnen.
* **Neuer Fragetyp:** `QuestionPresentationType` erweitern, `questionEntryPhase`
  (engine.ts) und `sceneForPhase` (projection.ts) ergaenzen.
* **Andere Punkteregel:** ausschliesslich `scoring.ts` und `scoringRules`.
