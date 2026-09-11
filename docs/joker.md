# Der Joker im Live-Quiz

Jeder Spieler hat **einen** Joker pro Spiel. Er kann ihn als **50:50** oder als
**Publikumsjoker** einsetzen - beides greift auf denselben Vorrat zu. Wer eine
der beiden Varianten genutzt hat, hat fuer den Rest des Spiels keinen Joker
mehr.

Zurueck kommt er nur mit einem neuen Spiel oder durch das ausdrueckliche
Zuruecksetzen am Operatorpult - nicht mit einer neuen Frage, nicht mit einer
neuen Runde, nicht durch Neuladen und nicht dadurch, dass der andere Spieler
antwortet.

Im Quellcode heisst er durchgehend **joker**; deutsche Woerter stehen nur in
Texten, die ein Mensch liest.

## Ausschliesslich das Live-Quiz

Standalone-Quiz, Kiosk, App-Collection und die lokalen Laufzeiten haben **keine
Joker**: keinen Zustand, keine Oberflaeche, keine Konfiguration.

Dafuer gibt es **kein Flag**. Entscheidend ist das Ablaufprofil des Spiels:

| Ablaufprofil | Wer fuehrt | Joker |
| --- | --- | --- |
| `operated` | ein Operator am Pult (Live-Quiz) | ja |
| `self-service` | die Spieler selbst am Geraet | nein |

`START_GAME` legt den Vorrat nur bei `operated` an. Der Zustand beschreibt sich
damit selbst: Ein Spiel **mit** Jokern traegt `jokerByPlayer`, ein Spiel ohne
traegt das Feld nicht - auch nach einem Serverneustart, und auch fuer ein Spiel,
das vor dieser Funktion gespeichert wurde. Genau das prueft
`gameHasJokers(state)`, und nur diese eine Stelle entscheidet es.

## Commands

| Command | Rollen | Wirkung |
| --- | --- | --- |
| `USE_JOKER { playerId, jokerType }` | `operator` | Setzt den Joker dieses Spielers ein; beim 50:50 werden zusaetzlich die ausgeblendeten Antworten gespeichert |
| `RESTORE_JOKER { playerId }` | `operator` | Macht den Joker wieder verfuegbar; steht die Frage noch, erscheinen die ausgeblendeten Antworten wieder |

Beide Commands sind **serverseitig** validiert und **nur** fuer den Operator
zugelassen (`commandRoles`). Die Buehne veraendert nichts; sie zeigt, was im
naechsten Snapshot steht. Zwei gleichzeitige Commands werden von der
Dispatch-Pipeline serialisiert - der zweite wird abgewiesen, und ein wiederholter
Command mit derselben `commandId` wird aus dem Protokoll beantwortet, statt ein
zweites Mal zu laufen.

Abweisungen tragen einen strukturierten Grund, damit das Pult einen Satz zeigen
kann und kein Schulterzucken: `joker-already-used`, `joker-not-used`,
`joker-not-applicable`, `joker-effect-active`, `joker-player-not-answering`,
`unknown-player`, dazu die allgemeinen `invalid-phase`,
`attempt-already-resolved` und `answer-not-logged`. Ein abgewiesener Einsatz
verbraucht **nichts**.

## Events

Es gibt keinen Ereigniskanal zu den Clients - sie bekommen vollstaendige
Snapshots. Das Ereignis ist deshalb der Eintrag im Spielprotokoll, benannt im
Datenteil:

- `jokerUsed { playerId, jokerType, questionId }` (beim 50:50 zusaetzlich
  `hiddenOptionIds`)
- `jokerRestored { playerId }`

Er steht im Audit-Log der Datenbank und damit im Protokoll, das der Operator
oeffnen kann. `deriveQuizEvents` - die Ereignisse fuer einen einbettenden
Gastgeber - kennt den Joker bewusst **nicht**: Diese Schnittstelle gehoert dem
Kiosk, und dort gibt es keine Joker.

## Zustand

Zwei Dinge, bewusst getrennt, weil sie zwei Lebensdauern haben:

- `GameState.jokerByPlayer` - was ein Spieler in **diesem** Spiel gemacht hat:
  `{ status: 'available' }` oder
  `{ status: 'used', type, usedAtQuestionId, usedAt }`, je Spieler-ID. Gelesen
  wird immer ueber `jokerOf(jokerByPlayer, playerId)`.
- `GameState.activeFiftyFifty` - was der 50:50 mit der Frage **auf dem Schirm**
  macht: `{ playerId, questionId, hiddenOptionIds }`. Wird an der einen Stelle
  geloescht, an der eine neue Frage kommt.

Ein einziges Feld koennte beides nicht: Es wuerde entweder die ausgeblendeten
Antworten bei der naechsten Frage zurueckholen oder den Joker fuer immer
einsetzbar halten. Die `questionId` ist zugleich der Grund, warum ein alter
Effekt nie auf eine neue Frage wirken kann - die Projektion vergleicht sie mit
der Frage, die tatsaechlich steht.

Im Snapshot: `PublicScore.joker` (`{ used }`, fehlt in einem Spiel ohne Joker),
`PublicOption.hidden`, `PublicQuizViewModel.activeFiftyFifty` und
`OperatorQuizViewModel.jokers` - Letzteres ein fertig anzeigbarer Bereich je
Spieler mit `canUseFiftyFifty`, `canUseAudience`, `usedType`, `canRestore` und
den Gruenden.

**Die Buehne erfaehrt nicht, welche Variante es war.** Sie zeigt eine neutrale
Karte, solange der Joker da ist. Was daraus wurde, wird im Saal gesagt und
bleibt am Pult nachvollziehbar.

## Der 50:50

Erlaubt nur, wenn eine Frage laeuft, **die Antworten sichtbar sind** und sie
noch nicht aufgeloest ist, der Spieler seinen Joker noch hat, keine Antwort
eingeloggt oder gewertet ist, kein anderer 50:50 zu dieser Frage aktiv ist, es
eine Auswahlfrage mit genau einer richtigen Antwort ist, sie mindestens **drei**
Antworten hat und **der genannte Spieler in dieser Situation antworten darf**
(hat ein Spieler den Zuschlag, ist die Frage seine; in der zweiten Chance gilt
dasselbe fuer den anderen).

Unter drei Antworten wird der Einsatz abgewiesen und **nicht** verbraucht: Von
zwei Antworten eine zu nehmen waere kein Hinweis, sondern die Loesung.

Beim Einsatz bleibt die richtige Antwort stehen, genau **eine** falsche bleibt
stehen, alles andere wird ausgeblendet - bei drei Antworten verschwindet eine,
bei vier zwei, bei mehr bleiben trotzdem nur zwei uebrig. Die ueberlebende
falsche Antwort wird **einmal, auf dem Server** gezogen, aus einer injizierbaren
Zufallsquelle (`EngineContext.random`), und die IDs reisen im Snapshot mit. So
blendet jeder Client dieselben Antworten aus, statt eine Ziehung nachzurechnen.
Es wird keine Antwort fuer den Spieler ausgewaehlt.

Auf dem Schirm behalten die ausgeblendeten Antworten ihren Platz, ihre Hoehe und
ihren Buchstaben und werden nur abgedunkelt - vier Zeilen in zwei umzubrechen
wuerde das Ziel unter dem Finger wegziehen. Unerreichbar werden sie im Bauteil
(`disabled`, `aria-hidden`), nie nur optisch.

## Der Publikumsjoker

Keine digitale Abstimmung. Der Spieler fragt den Saal, der Operator haelt fest,
dass der Joker verbraucht ist, und die Jokerkarte auf der Buehne verschwindet.
Die Befragung passiert im Raum. Keine erfundenen Prozente, keine zufaellige
Antwort, kein zweites Abstimmungssystem.

Er verbraucht **denselben** Joker wie der 50:50 - das ist der ganze Unterschied
zu zwei getrennten Jokern, und deshalb steht es auch in der Rueckfrage am Pult.

## Die Jokerkarte auf der Buehne

`JokerCard` (in `hfroemmel/quiz-live`, `apps/web/src/components/`) zeigt
**eine** neutrale Karte - `Jokerkarte_Livequiz_verfuegbar.png`, ueber den
normalen Build-Weg importiert, ein Asset fuer beide Spieler.

Sie liegt **hinter** dem Scoreboard und schaut nur seitlich hervor: bei Spieler 1
links aussen und leicht gegen den Uhrzeigersinn gedreht, bei Spieler 2 rechts
aussen, gespiegelt und andersherum gedreht. Seite, Drehung und Spiegelung stehen
allein im CSS und haengen an `data-player`.

Sie verschiebt nichts: Die Kopfzeile stellt je Spieler einen relativ
positionierten Rahmen um die Punktekarte
(`StageHeaderSlots.besidePlayer` in `@hfroemmel/quiz-react`), und die Karte liegt
darin absolut positioniert mit `z-index: -1`. Die Scoreboards bleiben farbneutral
und behalten ihre Groesse und Position.

Nach dem Einsatz rutscht die Karte hinter das Scoreboard und wird unsichtbar -
kein leerer Platzhalter, keine durchgestrichene zweite Karte. Sie bleibt nur
deshalb im Dokument, weil dieser Weg eine Bewegung ist und kein Entfernen;
`prefers-reduced-motion` nimmt ihr den Weg, nicht das Ergebnis.

Sie ist kein Bedienelement: kein Zeiger, kein Fokus, das Bild traegt `alt=""`
und `aria-hidden="true"`. Fuer die Sprachausgabe steht ein Satz im
Spielerbereich - `stage.joker.available` / `stage.joker.used` aus der
vorhandenen Uebersetzungsstruktur.

## Das Pult

`JokerPanel` zeigt je Spieler einen abgegrenzten Bereich: den Status als Wort
(`Joker verfuegbar` / `Joker eingesetzt: 50:50-Joker`), beide Einsatzarten als
Knoepfe an demselben Joker und - leiser, daneben - `Joker zuruecksetzen`.

Vor jedem Einsatz eine Rueckfrage, die den Preis nennt: "50:50-Joker fuer
Spieler 1 einsetzen? Dieser Spieler kann danach keinen Publikumsjoker mehr
verwenden." Ist der 50:50 zu dieser Frage nicht moeglich, steht der Grund im
Fluss unter den Knoepfen, nicht in einem Tooltip.

Alles davon kommt aus `view.jokers`, also aus denselben Regelfunktionen, die die
Engine beim Command anwendet. Das Pult leitet nichts selbst her: Ein Knopf, der
verfuegbar aussieht, fuehrt zu einem Command, den der Server annimmt.

## Dateien

**`hfroemmel/quiz`**

| Datei | Was |
| --- | --- |
| `packages/core/src/contracts/joker.ts` | neu: Typen, Regeln, `createJokerStates`, `jokerOf`, `jokerTypeLabel` |
| `packages/core/src/contracts/state.ts` | `GameState.jokerByPlayer`, `GameState.activeFiftyFifty` |
| `packages/core/src/contracts/commands.ts` | die zwei Commands, Rollen, Abweisungsgruende |
| `packages/core/src/contracts/viewModels.ts` | `PublicJokerStatus`, `PublicScore.joker`, `PublicOption.hidden`, `activeFiftyFifty`, `OperatorJokerControl` |
| `packages/core/src/engine/joker.ts` | neu: `gameHasJokers`, die Entscheidungsfunktionen, die Ziehung |
| `packages/core/src/engine/engine.ts` | die zwei Handler, Vorrat bei `START_GAME` (nur `operated`), Effekt bei Fragenwechsel geloescht |
| `packages/core/src/engine/allowedCommands.ts` | die Commands erscheinen nur, solange ein Knopf lebt |
| `packages/core/src/engine/projection.ts` | Status, ausgeblendete Antworten, Operatorbereich |
| `packages/react/src/presentation/stage/StageHeader.tsx`, `.module.css` | der Slot `besidePlayer` und der Rahmen dafuer |
| `packages/react/src/presentation/stage/AnswerList.tsx`, `.module.css`, `answerState.ts` | ausgeblendete Antworten |
| `packages/react/src/presentation/texts.ts` | `stage.joker.available`, `stage.joker.used` |
| `harness/src/preview/PreviewApp.tsx` | Schalter fuer ausgeblendete Antworten |

**`hfroemmel/quiz-live`**

| Datei | Was |
| --- | --- |
| `apps/web/src/assets/Jokerkarte_Livequiz_verfuegbar.png` | das Asset |
| `apps/web/src/components/JokerCard.tsx`, `.module.css` | neu: die Karte und der Header-Slot |
| `apps/web/src/apps/stage/StageApp.tsx` | die Karte im Buehnenfenster |
| `apps/web/src/apps/operator/JokerPanel.tsx`, `.module.css` | neu: das Pult |
| `apps/web/src/apps/operator/OperatorApp.tsx` | der Bereich in der Seitenspalte, die Karte in der Vorschau |

## Tests

| Suite | Anzahl | Was |
| --- | --- | --- |
| `packages/core/test/joker.test.ts` | 29 | ein Vorrat fuer beide Varianten, Trennung der Spieler, wer antworten darf, Lebensdauer, alle 50:50-Regeln, gleichzeitige Einsaetze, Zuruecksetzen, der Operatorbereich, und ein Spiel ohne Joker |
| `packages/server/test/joker.test.ts` | 9 | der Server besitzt den Zustand, ein Snapshot fuer alle Rollen, Neustart, wiederholter Command, Rollen, Zuruecksetzen, und ein Spiel ohne Joker |
| `test/e2e/joker.spec.ts` (quiz) | 3 | ausgeblendete Antworten bleiben an ihrem Platz, Scoreboards unveraendert, und das Touchgeraet hat nichts davon |
| `test/e2e/joker.spec.ts` (quiz-live) | 7 | das Pult, die Karte am Scoreboard, die Rueckfrage, dieselben Antworten auf Buehne und Pult, der Grund einer Abweisung, Zuruecksetzen, Neuladen beider Ansichten |

Laufen mit `pnpm test` und `pnpm test:e2e` in beiden Repositories.
