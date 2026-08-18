# Neuen Fragetyp hinzufuegen

Praesentationsform, Bewertungsverfahren und Medium sind getrennt modelliert. Oft
braucht ein neuer redaktioneller Wunsch daher gar keinen neuen Typ.

## Zuerst pruefen: reicht die Kombination bestehender Felder?

| Wunsch | Loesung ohne neuen Typ |
|---|---|
| „Politiker erkennen“ | `image-choice` mit Pflichtbild - es ist keine eigene Geschaeftslogik |
| Bild mit muendlicher Antwort | `image-reveal` mit `manual-correct-incorrect` |
| Frage ohne Optionen | `evaluationMode: "manual-correct-incorrect"` plus `acceptedAnswerText` |
| Video vor der Frage | `video-then-question` - zwei Phasen derselben Frage |

## Wenn ein echter neuer Typ noetig ist

1. **Contracts** - `packages/contracts/src/content.ts`:
   `questionPresentationTypes` um den neuen Wert ergaenzen. Der Compiler zeigt danach
   jede Stelle, die reagieren muss.

2. **Validierung** - `packages/content/src/validate.ts`:
   In `validateMedia` und `validateAnswerModel` festlegen, welche Medien und
   Antwortfelder verpflichtend sind.

3. **Domain** - `packages/domain/src/engine.ts`:
   In `questionEntryPhase` bestimmen, in welcher Phase die Frage startet. Falls der
   Typ eigene Phasen braucht, `GamePhase` in `@quiz/contracts` erweitern und die
   Uebergaenge in `applyPhase` ergaenzen.

4. **Buzzerregeln** - `packages/domain/src/buzzer.ts`:
   Nur anfassen, wenn der Typ neue buzzbare Phasen einfuehrt (`buzzablePhases`).

5. **Scoring** - in der Regel nichts. Die Regel „ohne vorherigen Fehlversuch 100,
   sonst 50“ gilt typunabhaengig.

6. **Projektion** - `packages/domain/src/projection.ts`:
   `sceneForPhase` ergaenzen und pruefen, welche Felder oeffentlich werden duerfen.

7. **Befehle** - `packages/contracts/src/commands.ts`:
   Neue Befehle in `commandSchema` **und** `commandRoles` eintragen, danach in
   `allowedCommands.ts` einer Phase zuordnen.

8. **Praesentation** - `apps/web/src/presentation/scenes/`:
   Neue Szene anlegen und in `StageScreen.tsx` einhaengen. Uebergang im Registry
   registrieren (siehe [animationen.md](animationen.md)).

9. **Operatorsteuerung** - `apps/web/src/apps/operator/OperatorControls.tsx`:
   Neue Bedienelemente an `allowedCommands` binden, nicht an eigene Bedingungen.

10. **Tests** - Regelfaelle in `packages/domain/test/engine.test.ts`, Validierung in
    `packages/content/test/validate.test.ts`, Szene in `test/e2e/presentation.spec.ts`.

## Beispiel: Audiofrage

* `presentationType: "audio-then-question"`, `evaluationMode` wie gehabt
* Pflichtmedium `audioAssetId` (Validierung)
* Phasen `audio-ready` und `audio-playing`, beide **nicht** in `buzzablePhases`
* Befehle `START_AUDIO`, `PAUSE_AUDIO`, `SHOW_QUESTION_AFTER_AUDIO`
* Szene `AudioScene.tsx`, Uebergang `audioEnter.ts`

Das entspricht exakt dem Aufbau der Videofrage - sie ist die beste Vorlage.
