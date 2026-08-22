# @quiz/game

**Verantwortung:** Das spielbare Quiz als eine einbettbare Komponente. Sie ist der
einzige Baustein, den ein Gastgeber kennt - der Kiosk genauso wie eine
Multigame-Anwendung.

```tsx
import { QuizGame } from '@quiz/game'
import '@quiz/presentation/styles.css'
import '@quiz/game/styles.css'

<QuizGame
  quizModeId="adults"
  onFinished={(result) => shell.showScore(result)}
  onExit={() => shell.backToMenu()}
/>
```

| Eigenschaft | Bedeutung |
|---|---|
| `quizModeId` | Modus, in dem dieses Geraet spielt. Ohne Angabe der erste des Katalogs. |
| `onFinished` | Ergebnis eines beendeten Spiels - Punkte, Gewinner, Trefferzahl. |
| `onExit` | Ruecksprung in die Gastgeberanwendung. Nur wenn gesetzt, erscheint der Knopf. |

Am Geraet wird genau zweierlei gewaehlt: **wie viele spielen** und **wie schwer**.
Der Quizmodus gehoert zur Aufstellung und kommt als Vorgabe herein. Die
Schwierigkeitsstufen stammen aus `view.catalog`, also aus validierter
Konfiguration - es gibt keine Liste im Code.

## Aufbau

| Datei | Verantwortung |
|---|---|
| `QuizGame.tsx` | Verbindung, Startauswahl, laufendes Spiel, Ergebnis |
| `GameStart.tsx` | Spielerzahl und Schwierigkeit |
| `AnswerPad.tsx` | Antwortflaechen eines Spielers; beim Duell gespiegelt |
| `answering.ts` | Welche Flaeche gerade bedienbar ist - abgelesen, nicht abgeleitet |

Die Flaeche in der Mitte ist dieselbe Komposition wie auf dem Beamer
(`@quiz/presentation`, Variante `touch`). Dieses Paket ergaenzt nur, was es dort
nicht gibt: die Antwortflaechen und die Auswahl davor. In der Variante `touch`
zeigt die Buehne die Antwortoptionen nicht noch einmal - sie liegen bereits als
Schaltflaechen vor den Spielern.

**Abhaengigkeiten:** `@quiz/client` (Verbindung), `@quiz/presentation` (Buehne),
`@quiz/contracts` (Typen), `react`.

## Regeln fuer dieses Paket

* **Keine Spielregeln.** Ob ein Fingertipp zaehlt, entscheidet der Server. Wer
  gerade antworten darf, wird aus dem View-Modell abgelesen (`locked`,
  `currentPlayer`), nicht aus Regeln hergeleitet.
* **Gast in fremden Anwendungen.** Alle Stile liegen unter `.quiz-game`; es gibt
  kein `:root`, kein `body`, keine Elementselektoren und kein Routing.
* **Grosse Ziele.** Die ganze Kachel ist die Schaltflaeche. Wer zuerst tippt, hat
  geantwortet - das ist der Ersatz fuer den Hardware-Buzzer.
