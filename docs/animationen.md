# Uebergangsanimationen anpassen und testen

Animationen sind austauschbare Praesentation. Sie steuern **nie** die
Spielzustandsmaschine.

Welche Bewegungen es geben soll, steht in
[`docs/animationskatalog.md`](animationskatalog.md). Diese Datei beschreibt, wie
sie technisch angelegt und geaendert werden.

## Trennung von Zustand und Darstellung

```text
Domain entscheidet:            phase = attempt-feedback, outcome = correct
Praesentationsregistry:        welche Animation, welche Dauer, welches Easing,
                               welche Soundmarke, welcher Reduced-Motion-Fallback
```

Der fachliche Zustandswechsel haengt nicht davon ab, ob ein Browser ein
`animationend`-Event liefert. Der Server verwendet definierte Fallbackzeiten und
schickt anschliessend `ADVANCE_TIMED_PHASE`.

## Wo liegt was?

```text
apps/web/src/presentation/
  animationPresets.ts      zentrale Timings und Easings
  soundCues.ts             Soundmarken (Web Audio, keine Dateien)
  StageScreen.tsx          waehlt Szene, wendet Uebergang an, spielt Soundmarke
  scenes/                  PauseScene, QuestionScene, RevealScene, VideoScene,
                           FeedbackScene, SolutionScene, ResultScene, StartScene
  transitions/
    types.ts               Animationsvertrag
    registry.ts            alle Uebergaenge, Zuordnung zu Szenenkanten
    fadeThrough.ts  questionEnter.ts  correctFeedback.ts
    incorrectFeedback.ts  solutionReveal.ts  resultCelebration.ts
```

## Der Animationsvertrag

```ts
interface PresentationTransitionDefinition {
  id: string
  description: string
  appliesTo: { from: PublicScene | '*'; to: PublicScene }
  durationMs: number
  delayMs?: number
  easing: string
  reducedMotionDurationMs: number
  soundCueId?: SoundCueId
  classNames?: { from?: string; active?: string; to?: string }
  locked?: string    // Begruendung, falls die Dauer nicht frei aenderbar ist
}
```

Jede Definition beantwortet an genau einer Stelle: welcher Szenenwechsel, welche
Elemente, welche Dauer und welches Easing, welche Soundmarke, welcher
Reduced-Motion-Fallback und was aus Fairnessgruenden fest ist.

## Neue Uebergangsanimation hinzufuegen

1. Definition im Verzeichnis `transitions/` anlegen
2. ID und Timing im Registry registrieren (`transitions`-Liste in `registry.ts`)
3. betroffene Szenenkante ueber `appliesTo` zuordnen
4. Reduced-Motion-Fallback ergaenzen (`reducedMotionDurationMs`)
5. in der Entwicklungsansicht `/preview` pruefen
6. visuellen Regressionstest aktualisieren (`test/e2e/presentation.spec.ts`)

Die zugehoerige CSS-Klasse kommt in `apps/web/src/styles.css`; Dauer, Verzoegerung und
Easing werden dort **nicht** hart geschrieben, sondern ueber `--transition-duration`,
`--transition-delay` und `--transition-easing` aus dem Registry gesetzt.

## Was darf ich aendern, was nicht?

| Wert | Aenderbar? |
|---|---|
| `sceneFadeMs`, `optionStaggerMs`, `resultConfettiMs`, `scoreCountUpMs` | frei - rein visuell |
| Easings, Klassennamen, Keyframes | frei |
| `correctFeedbackMs`, `incorrectFeedbackMs`, `solutionDelayMs`, `pauseScreenMs` | nur in `gameTiming` (`packages/contracts/src/config.ts`) - der Server beendet die Phase nach genau dieser Zeit |
| `imageRevealDurationMs` | bestaetigte zehn Sekunden; Aenderung nur nach Ruecksprache |
| Ableitung der Bildschaerfe aus dem Reveal-Fortschritt | **nicht** aendern - Fairness |

Wer eine Feedbackdauer nur in der Animation aendert, laesst Anzeige und Spielzustand
auseinanderlaufen: Die Loesung erschiene, waehrend die Animation noch laeuft. Deshalb
spiegeln `correctFeedback.ts` und `incorrectFeedback.ts` bewusst `gameTiming` und
tragen ein `locked`-Feld mit Begruendung.

## Bildschaerfe und Countdown

Beide werden aus **derselben** Fortschrittsvariable berechnet:

```text
progress  = clamp(elapsedMs / durationMs, 0, 1)
countdown = ceil((1 - progress) × durationSeconds)
blur      = maxBlurPx × (1 - progress)
```

Die Funktionen stehen in `packages/domain/src/reveal.ts`, der Client nutzt sie ueber
`useRevealClock`. Es darf niemals eine unabhaengige CSS-Animation neben einem
separaten JavaScript-Timer laufen - sonst bekaeme ein Spieler einen Informationsvorteil.

Anpassbar ist allein `revealMaxBlurPx` in `animationPresets.ts`.

## Pausieren und Reconnect

Pausiert der Server die Enthuellung, friert der Wert ein, weil `status !== 'running'`
keine Weiterrechnung erlaubt. Nach einem Reconnect uebernimmt der naechste Snapshot
sofort wieder den Serverstand - der Client startet nie bei 10 neu. Beides ist in
`test/e2e/live-presentation.spec.ts` abgesichert.

## Entwicklungsansicht

```bash
pnpm dev     # danach http://localhost:5180/preview
```

Die Vorschau ist bewusst serverfrei: Sie baut keine WebSocket-Verbindung auf, sendet
keine Befehle und verwendet lokal erzeugte Beispiel-View-Modelle. Im Produktionsbuild
ist sie ueber `import.meta.env.DEV` gesperrt und greift damit nicht in den
Produktionsworkflow ein.

Sie erlaubt: Szene waehlen, Theme wechseln, Feedbackvariante umschalten,
Enthuellungsfortschritt per Regler pruefen, Unentschieden simulieren, Uebergang
wiederholt abspielen und alle registrierten Uebergaenge mit Dauer, Reduced-Motion-Wert
und gesperrten Stellen einsehen.

## Tests

```bash
pnpm test:e2e --project=preview   # Szenen, Themes, Reveal-Synchronitaet, Reduced Motion, Screenshots
pnpm test:e2e --project=live      # Doppelklick, Reconnect, Fensterverlust, Loesungssperre
pnpm test                          # Fake-Clock-Tests der Reveal- und Feedbacktimings
```

Screenshot-Baselines sind plattformabhaengig. Auf einem neuen System einmalig:

```bash
npx playwright test --project=preview --update-snapshots
```
