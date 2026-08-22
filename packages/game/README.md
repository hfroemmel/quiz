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
* **Grosse Ziele.** Die ganze Kachel ist die Schaltflaeche. Wer zuerst tippt, hat
  geantwortet - das ist der Ersatz fuer den Hardware-Buzzer.

## Einbettungsvertrag

Das Quiz ist Gast. Was es zusagt - und was jeweils dafuer sorgt:

| Zusage | Wie sie gehalten wird | Wie sie geprueft wird |
|---|---|---|
| Es faerbt die Gastgeberanwendung nicht um | Alle Stile liegen unter eigenen Klassen. Kein `body`, kein `html`, keine Elementselektoren. Farbtoken gelten am Dokumentwurzelelement nur auf ausdrueckliche Anforderung (`<html class="quiz-tokens">`) | `test/embedding.test.ts` prueft die ausgelieferten Stylesheets selbst |
| Es bleibt in seiner Flaeche | Die Komponente fuellt ihren Kasten und oeffnet nichts darueber hinaus | `test/e2e/embedding.spec.ts` vergleicht die Kaesten |
| Es hinterlaesst beim Entfernen nichts | Verbindung, Timer, Bildfolgen und die Audioausgabe werden abgeraeumt | Der Server zaehlt seine Clients: nach zwei Runden steht er wieder auf dem Ausgangswert |
| Es greift nicht ins Fenster | Keine globalen Listener, kein Routing, kein `window`-Zustand. Beruehrungen fuer die Leerlauf-Aufsicht meldet die Komponente selbst | - |
| Es meldet nur eigene Ergebnisse | Ein Ergebnis, das beim Einsetzen schon auf dem Server steht, gehoert einer frueheren Partie und wird nicht gemeldet | E2E prueft die Zahl der gemeldeten Runden |
| Im Hintergrund bleibt es still | Wechselt der Gastgeber Fenster oder Tab, schweigt der Ton | - |

Die Grenze, die dabei ehrlich benannt sein muss: Blendet ein Gastgeber das Quiz
nur aus (`display: none`), gilt die Seite fuer den Browser weiter als sichtbar.
Das verlaessliche Mittel bleibt das Entfernen der Komponente - dabei wird alles
abgeraeumt.

Unter `/shell` liegt eine beispielhafte Gastgeberanwendung (nur im
Entwicklungsmodus). Sie ist der erste fremde Nutzer dieser Komponente und dient
zugleich als Pruefstand fuer die Zusagen oben.
