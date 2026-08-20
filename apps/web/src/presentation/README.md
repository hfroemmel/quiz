# Praesentationsschicht

**Verantwortung:** Wie ein Zustand aussieht und klingt - nie, welcher Zustand gilt.

```text
stage/           Bauteile der Buehne, je Bauteil eine Datei + ein CSS-Modul
scenes/          eine Datei je Buehnenszene, dazu scenes.module.css
transitions/     Uebergangsdefinitionen und zentrales Registry
animationPresets.ts  Timings und Easings
soundCues.ts     Soundmarken (Web Audio, keine Dateien)
StageScreen.tsx  waehlt Szene, wendet Uebergang an, spielt Soundmarke
```

## Eine Ansicht, zwei Gestaltungswelten

Es gibt genau ZWEI Welten: die Buehne der Erwachsenen (`default`) und die
illustrierte Kinderwelt (`kids`). Sie teilen sich **dasselbe Markup**; der
einzige Unterschied ist die Klasse an der Buehnenflaeche:

```text
.stage.stage--default   .stage.stage--kids
```

Daraus folgen zwei Regeln, die nicht verhandelbar sind:

1. **Keine modusabhaengigen Komponenten und keine modusabhaengigen Klassen.**
   Es gibt `Score`, nicht `KidsScore`. Wer im Markup einen Modusnamen schreibt,
   hat die Trennung verletzt.
2. **Jedes Bauteil bringt beide Welten in seinem eigenen Modul mit.** Der
   gemeinsame Aufbau steht oben, darunter je ein Block
   `:global(.stage--default)` und `:global(.stage--kids)` mit genau dem, was die
   Welt wirklich anders macht.

Die Wurzelklassen selbst stehen bewusst global in `src/styles/stage.css` - ein
gehashter Name waere aus den Bauteilmodulen heraus nicht ansprechbar. Dort
stehen auch die Token, aus denen die Bauteile ihre Abstaende und Schriften
lesen (`--scene-gap`, `--kids-*`).

## Warum Token statt Ueberschreibungen

Abstaende und Ausrichtung der Szenen kommen als Custom Property von der Buehne.
Eine Angabe AM Element sticht jeden geerbten Wert - damit kann eine Szene ihren
Abstand setzen, ohne mit der Weltregel um die Spezifitaet zu ringen.

## Testhaken

Klassennamen sind gehasht und taugen nicht als Selektor. Die Bauteile tragen
deshalb stabile Datenattribute: `data-answer`, `data-answer-chip`,
`data-answer-surface`, `data-answer-text`, `data-panel`, `data-prompt`,
`data-category`, `data-media`, `data-media-image`, `data-peek`, `data-score`,
`data-score-value`, `data-counter`, `data-counter-value`, `data-brand`,
`data-mascot`, `data-hint`. Der Zustand einer Antwortzeile steht in
`data-state`.

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
