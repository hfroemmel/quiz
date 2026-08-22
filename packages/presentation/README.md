# @quiz/presentation

**Verantwortung:** Wie ein Zustand aussieht und klingt - nie, welcher Zustand gilt.

Dieses Paket enthaelt die Buehnenflaeche und wird von allen Kontexten gemeinsam
genutzt: Buehnenbetrieb (`apps/web`), Kiosk und Multigame-Einbettung. Es kennt
weder Verbindung noch Befehle - es bekommt ein `PublicQuizViewModel` und rendert es.

```text
src/index.ts         oeffentliche Oberflaeche - nur hierueber wird importiert
src/StageScreen.tsx  waehlt Szene, wendet Uebergang an, spielt Soundmarke
src/scenes/          eine Datei je Buehnenszene
src/transitions/     Uebergangsdefinitionen und zentrales Registry
src/ui/              Bausteine: Kachel, Antwortleiste, Medienrahmen, Konfetti
src/animationPresets.ts  Timings und Easings
src/soundCues.ts     Soundmarken (Web Audio, keine Dateien)
src/designTokens.ts  Farbtoken als Fallback ausserhalb eines laufenden Spiels
src/useRevealClock.ts    Anzeigewerte der Enthuellung aus dem Serverstand
src/styles/presentation.css  Stylesheet der Buehnenflaeche
```

## Einbinden

```ts
import { StageScreen } from '@quiz/presentation'
import '@quiz/presentation/styles.css'
```

Tiefe Importe einzelner Dateien sind ueber `exports` gesperrt. Was eine Anwendung
braucht, steht in `src/index.ts`; alles andere darf sich jederzeit aendern.

Das Stylesheet beschreibt ausschliesslich die Buehnenflaeche. Bedienoberflaechen -
Operator, Moderator, Vorschau - liegen im Stylesheet der jeweiligen Anwendung,
damit eine fremde Gastgeberanwendung nichts Fremdes mitbekommt.

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

Ausfuehrlich: [docs/animationen.md](../../docs/animationen.md).
