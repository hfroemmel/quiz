# Praesentationsschicht

**Verantwortung:** Wie ein Zustand aussieht und klingt - nie, welcher Zustand gilt.

```text
scenes/          eine Datei je Buehnenszene
transitions/     Uebergangsdefinitionen und zentrales Registry
animationPresets.ts  Timings und Easings
soundCues.ts     Soundmarken (Web Audio, keine Dateien)
StageScreen.tsx  waehlt Szene, wendet Uebergang an, spielt Soundmarke
```

## Grundregeln

1. Welche Szene gilt, entscheidet `view.scene` und damit der Server.
2. Welche Animation, Dauer, Easing und Soundmarke dazu gehoeren, entscheidet das
   Registry unter `transitions/`.
3. Der fachliche Phasenwechsel haengt nie an `animationend`.
4. Countdown und Bildschaerfe stammen aus derselben Fortschrittsvariable
   (`@quiz/domain/reveal`). Diese Ableitung ist eine Fairnessanforderung und darf
   nicht veraendert werden.
5. Fachlich relevante Timings (`correctFeedbackMs`, `incorrectFeedbackMs`,
   `solutionDelayMs`, `imageRevealDurationMs`, `pauseScreenMs`) stammen aus
   `gameTiming` in `@quiz/contracts` und werden hier nur gespiegelt.

## Neue Uebergangsanimation

1. Definition in `transitions/` anlegen
2. im Registry registrieren
3. Szenenkante ueber `appliesTo` zuordnen
4. `reducedMotionDurationMs` ergaenzen
5. unter `/preview` pruefen
6. Regressionstest in `test/e2e/presentation.spec.ts` aktualisieren

Ausfuehrlich: [docs/animationen.md](../../../../docs/animationen.md).
