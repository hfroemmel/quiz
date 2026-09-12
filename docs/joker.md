# Der Joker im Live-Quiz

Jeder Spieler hat **einen** Joker pro Spiel. Er wird **gezogen**, nicht
gewaehlt: Wer gebuzzert hat, bittet um seinen Joker, der Operator zieht ihn, und
der **Server** entscheidet mit 50:50, ob daraus ein **50:50-Joker** oder ein
**Publikumsjoker** wird. Weder Spieler noch Operator koennen den Typ bestimmen -
eine Wahl waere eine taktische Entscheidung, eine Ziehung ist ein Moment.

Die Muenze faellt nur dort, wo beide Ergebnisse moeglich sind. Eine
Bilderkennen-Frage hat keine Antworten zum Halbieren; dort ist der
Publikumsjoker das einzig moegliche Ergebnis (siehe
[Was diese Frage hergibt](#was-diese-frage-hergibt)).

Zurueck kommt der Joker nur mit einem neuen Spiel. Nicht mit einer neuen Frage,
nicht mit einer neuen Runde, nicht durch Neuladen, nicht durch einen Reconnect -
und es gibt keinen Befehl, der eine Ziehung zurueckholt. Sie ist mit ihrem
ersten Moment endgueltig: Der Spielerstatus wechselt auf `used`, bevor die Karte
das Scoreboard verlassen hat.

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

## Der Ablauf

```
                 DRAW_JOKER              Server, nach 820 ms
verfuegbar  ────────────────►  drawing  ────────────────────►  revealed
                                                                  │
                                                   CONTINUE_JOKER │
                                                                  ▼
        idle  ◄────────────────────────────────────────────   applied
              Antwort gewertet (Markierung) / neue Frage (alles)
```

Beim Ziehen entscheidet der Server **einmal** alles: den Jokertyp und - beim
50:50 - die Antworten, die verschwinden. Beides steht ab diesem Moment im
Spielzustand. Kein spaeterer Schritt und kein Client wuerfelt noch.

Der Schritt `drawing -> revealed` gehoert ebenfalls dem Server: Er plant ihn als
zeitgesteuerten Uebergang ein (`pendingTransition`, dieselbe Mechanik wie die
Feedback-Animation) und schaltet nach `jokerRevealAtMs` selbst um - also genau
dann, wenn die Karte in der Mitte angekommen ist. Deshalb findet ein Client, der
mitten in der Ziehung dazukommt, denselben Zustand wie alle anderen.

**Die Drehung kommt danach, nicht davor.** Waehrend `drawing` kennt kein Client
den Jokertyp (siehe unten) - eine Karte, die sich vorher dreht, zeigt eine leere
Rueckseite und traegt das Ergebnis hinterher nach. Der Snapshot mit dem Ergebnis
ist deshalb derselbe, der die Drehung startet: kein Timer im Client, nichts, was
auseinanderlaufen koennte.

## Commands

| Command | Rollen | Wirkung |
| --- | --- | --- |
| `DRAW_JOKER` | `operator` | Zieht den Joker des Spielers, der gebuzzert hat: Typ und ausgeblendete Antworten werden bestimmt, der Joker gilt ab sofort als verbraucht, die Karte fliegt |
| `CONTINUE_JOKER { sequenceId }` | `operator` | Wendet das Ergebnis an und gibt die Frage wieder frei |

`DRAW_JOKER` **traegt keine Nutzlast**. Keinen Jokertyp, weil der Server die
Muenze wirft - wer ihn nennen koennte, koennte ihn waehlen. Und keine
`playerId`: Ziehen darf nur, wer den Zuschlag hat, und das weiss der Server. Ein
Feld dafuer waere ein Feld, das gegen den aktiven Spieler geprueft werden
muesste, und die Pruefung waere "ist es ohnehin der aktive Spieler".

`CONTINUE_JOKER` nennt die Ziehung, die es meint. Ein spaeter Klick - die
Operator-Ansicht hat neu gezeichnet, die Verbindung war weg und ist wieder da -
kommt dann mit der Kennung einer Ziehung, die vorbei ist, und wird abgewiesen,
statt einen Schritt der aktuellen zu ueberspringen.

**Waehrend `drawing` und `revealed` ruht die Frage.** Einloggen, Bewerten,
Aufloesen, Weiter, Ueberspringen, Buzzern - alles abgewiesen
(`joker-sequence-active`) und in `allowedCommands` gar nicht angeboten. Eine
Antwort unter einer Karte, die den Schirm bedeckt, waere eine Entscheidung
hinter dem Ruecken des Saals. Eine Liste, zwei Leser: `jokerBlockedCommands`.

Abweisungen tragen einen strukturierten Grund: `joker-already-used`,
`joker-not-applicable`, `joker-sequence-active`, `joker-no-sequence`,
`joker-sequence-stale`, `joker-no-answering-player`, dazu die allgemeinen
`invalid-phase` und `answer-not-logged`. Eine abgewiesene Ziehung verbraucht
**nichts**.

## Events

Es gibt keinen Ereigniskanal zu den Clients - sie bekommen vollstaendige
Snapshots. Das Ereignis ist deshalb der Eintrag im Spielprotokoll, benannt im
Datenteil:

- `jokerDrawn { playerId, jokerType, questionId, sequenceId }` (beim 50:50
  zusaetzlich `eliminatedOptionIds`)
- `jokerApplied { playerId, jokerType, sequenceId }`

`deriveQuizEvents` - die Ereignisse fuer einen einbettenden Gastgeber - kennt
den Joker bewusst **nicht**: Diese Schnittstelle gehoert dem Kiosk, und dort
gibt es keine Joker.

## Zustand

Zwei Dinge, bewusst getrennt, weil sie zwei Lebensdauern haben:

- `GameState.jokerByPlayer` - was ein Spieler in **diesem** Spiel gemacht hat:
  `{ status: 'available' }` oder
  `{ status: 'used', type, usedAtQuestionId, usedAt }`, je Spieler-ID. Gelesen
  wird immer ueber `jokerOf(jokerByPlayer, playerId)`. Ueberdauert jede Frage
  und endet mit dem Spiel.
- `GameState.jokerSequence` - die Ziehung, wie sie **laeuft**:
  `{ phase: 'idle' }` oder
  `{ phase: 'drawing' | 'revealed' | 'applied', sequenceId, playerId,
  questionId, type, startedAt, eliminatedOptionIds? }`. Wird an der einen
  Stelle auf `idle` gesetzt, an der eine neue Frage kommt - und mit ihr
  verschwinden die ausgeblendeten Antworten.

Ein einziges Feld koennte beides nicht: Es wuerde entweder die ausgeblendeten
Antworten bei der naechsten Frage zurueckholen oder den Joker fuer immer
ziehbar halten. Die `questionId` ist zugleich der Grund, warum eine alte
Ziehung nie auf eine neue Frage wirken kann - die Projektion vergleicht sie mit
der Frage, die tatsaechlich steht.

Im Snapshot:

- `PublicScore.joker` (`{ used }`, fehlt in einem Spiel ohne Joker),
- `PublicOption.eliminated`,
- `PublicQuizViewModel.jokerDraw` (`phase`, `sequenceId`, `playerId`,
  `startedAtServerMs`, `revealCompleteMs` und `type`),
- `OperatorQuizViewModel.joker` - ein fertig anzeigbarer Bereich mit `canDraw`,
  `blockedReason`, `playerLabel`, `used` und der laufenden `sequence`.

**Der Jokertyp geht erst auf die Leitung, wenn die Karte sich gedreht hat.**
Waehrend `drawing` erfahren alle Rollen, DASS eine Ziehung laeuft, wessen sie
ist und wann sie begann - das braucht der Flug. Was herauskam, kommt mit
`revealed`, also in dem Moment, in dem die Karte es ohnehin zeigt. Genauso die
ausgeblendeten Antworten: entschieden beim Ziehen, uebertragen erst mit
`applied`. Eine Buehne, die es frueher wuesste, koennte es verraten - und eine,
der man vertrauen muesste, waere der falsche Entwurf.

## Was diese Frage hergibt

Gezogen werden kann nur, wenn eine Frage laeuft, **die Antworten sichtbar sind**
und sie noch nicht aufgeloest ist, ein Spieler **gueltig gebuzzert hat** und
antworten darf, sein Joker noch verfuegbar ist, keine Antwort eingeloggt ist,
keine andere Ziehung laeuft - und die Frage **wenigstens ein Ergebnis tragen
kann**.

Welche das sind, sagt `drawableJokerTypes(state)`, und zwar VOR der Muenze:

| Frage | Moeglich | Warum |
| --- | --- | --- |
| Auswahlfrage mit genug offenen Antworten | 50:50 **und** Publikum | der Normalfall, die Muenze entscheidet |
| Bilderkennen und andere freie Fragen | nur Publikum | es gibt keine Antworten zum Halbieren; der Saal zu fragen ist dort die einzige Hilfe, die etwas bedeutet |
| Auswahlfrage mit zu wenig offenen Antworten | nichts - nicht ziehbar | siehe unten |

Bei genau einer Moeglichkeit **faellt die Muenze aus**: `drawJokerType` gibt den
einen Typ zurueck und fasst `random` nicht an. Ein Wurf koennte sonst etwas
ergeben, was die Frage nicht tragen kann. Das Pult sagt in diesem Fall vorher,
was kommt (`view.joker.onlyType`) - der Operator soll es ansagen koennen und
nicht hinterher erklaeren muessen.

Die dritte Zeile der Tabelle ist der Grund, warum ueberhaupt vorher geprueft wird: Eine
Auswahlfrage, die keinen 50:50 tragen kann, ist gar nicht ziehbar. Sonst wuerde
man es nach dem Wurf merken und dem Spieler einen Publikumsjoker geben, weil
seine Frage zu kurz war - eine Lotterie auf der Lotterie. Am Pult ist der Knopf
dann deaktiviert und nennt den Grund. Bei einer Bilderfrage ist das etwas
anderes: Dort ist von vornherein nur ein Ergebnis im Spiel, und niemand verliert
eine Chance, die es nie gab.

### Das Bilderkennen im Besonderen

Fuer den Saal bleibt es derselbe Vorgang wie sonst: Die Karte loest sich, fliegt,
richtet sich auf, dreht sich und zeigt den Publikumsjoker. Die Animation verraet
nicht, dass hier nichts zu entscheiden war.

Die Ziehung laesst die Frage dabei vollstaendig in Ruhe. `DRAW_JOKER` und
`CONTINUE_JOKER` fassen weder `reveal` noch `buzzer` noch `phase` an, und die
Kartendrehung ist ausdruecklich **kein** Phasenwechsel (siehe
`isJokerRevealTransition` - sie wird auf die Phase geplant, in der sie schon
steht). Nach `Weiter` gilt deshalb:

* Das Bild steht auf dem Stand, auf dem der Buzzer es eingefroren hat - ein
  gueltiger Buzzer ruft `pauseReveal`, und nichts an der Ziehung ruft
  `resumeReveal` oder `resetReveal`.
* Die Restsekunden des Moderators laufen nicht neu an: Sie werden aus derselben
  Enthuellungsuhr abgeleitet, es gibt keinen zweiten Zeitgeber.
* `buzzer.acceptedPlayerId` und der offene Versuch bleiben, wie sie waren;
  Punkte gehen weiterhin an den Spieler, der gebuzzert hat.
* Sichtbar wechselt nur die Ziffer des aktiven Spielers auf das Gruppenzeichen -
  und zwar so lange, wie die Frage offen ist (`questionStillOpen`).

## Der 50:50

Geeignet heisst: Auswahlfrage mit genau einer richtigen Antwort und mindestens
**drei** offenen Antworten. Gezaehlt werden nur die **offenen**: Eine Antwort,
die in einem frueheren Versuch als falsch gewertet wurde, ist verbraucht. In der
zweiten Chance einer Dreier-Frage bleibt damit zu wenig uebrig, und die Ziehung
wird abgewiesen, statt die Loesung zu zeigen.

Bei der Ziehung bleibt die richtige Antwort stehen, genau **eine** falsche bleibt
stehen, alles andere verschwindet - bei drei Antworten eine, bei vier zwei, bei
mehr entsprechend viele. Die ueberlebende falsche Antwort wird **einmal, auf dem
Server** gezogen (`EngineContext.random`), und die IDs reisen im Snapshot mit.
Es wird keine Antwort fuer den Spieler ausgewaehlt.

Sichtbar wird das erst mit `CONTINUE_JOKER`. Dann behalten die weggefallenen
Antworten ihren Platz, ihre Hoehe und ihren Buchstaben und **treten nur
zurueck**: Deckkraft 0.45 und ohne Farbe, in 250 ms, bei mehreren Antworten um
110 ms versetzt. Kein Strich darueber - die Zeile bleibt lesbar, und eine Linie
waere eine zweite Aussage ueber der ersten. Unerreichbar werden sie im Bauteil
(`disabled`, `aria-hidden`), nie nur optisch. Beim Fragenwechsel verschwinden
die IDs, der Joker bleibt verbraucht.

## Der Publikumsjoker

Keine digitale Abstimmung. Der Spieler fragt den Saal, die Anwendung haelt fest,
dass der Joker verbraucht ist. Keine erfundenen Prozente, kein zufaelliges
Publikumsergebnis, kein zusaetzlicher Timer.

Nach `CONTINUE_JOKER` stehen Frage und **alle** Antworten unveraendert da. Das
Einzige, was sich aendert, ist die **Markierung des aktiven Antwortenden**: In
seiner Punktekarte tritt an die Stelle der Spielernummer das Gruppenzeichen,
mit einer Ueberblendung von 200 ms. Punktestand, Farben, Groesse und die Karte
des anderen Spielers bleiben unberuehrt.

**Am Antwortbesitz aendert das nichts.** `buzzer.acceptedPlayerId`, die Sperre
und spaeter die Punkte gehoeren weiter dem Spieler, der gebuzzert hat - es ist
eine Markierung, keine Umbuchung. Das Zeichen verschwindet, sobald der Versuch
gewertet ist oder die naechste Frage kommt (die Projektion gibt eine
`applied`-Ziehung nur aus, solange die Frage offen ist).

Anmerkung zur Vorgabe: Die Spielernummer des aktiven Antwortenden ist auf der
Buehne **nur** in seiner Punktekarte zu sehen - eine zweite Anzeige gibt es
nicht. "Scoreboards bleiben unveraendert" ist deshalb so umgesetzt: Layout,
Farben und Punktestaende bleiben, getauscht wird ausschliesslich die Ziffer des
aktiven Spielers, und nur solange der Joker wirkt.

## Die Jokerkarte auf der Buehne

`JokerCard` (in `hfroemmel/quiz-live`, `apps/web/src/components/`) zeigt eine
neutrale Karte - dieselbe fuer beide Spieler, ueber den normalen Build-Weg
importiert.

**Jede Gestaltungswelt hat ihre eigene Karte**, denn eine Jokerkarte ist ein
Gegenstand mit einem Gesicht und keine eingefaerbte Flaeche:

| `theme.skin` | Datei |
| --- | --- |
| `default` | `Jokerkarte_Livequiz_verfuegbar.png` |
| `kids` | `Jokerkarte_Kinderquiz_verfuegbar.webp` - Karlchen mit Narrenkappe |

Ausgewaehlt wird in `jokerCardArt.ts`, allein ueber `view.theme.skin` - nicht
ueber die Zielgruppe und nicht ueber einen Modusnamen. Dieselbe Funktion liefert
`--joker-card-ratio`: Beide Karten werden ueber ihre **Breite** gestellt und
holen ihre Hoehe aus der Datei, sodass unterschiedliche Proportionen weder
beschnitten werden noch einen Rand bekommen. Die kleine Karte am Scoreboard und
die fliegende im Overlay lesen dieselbe Variable - es ist derselbe Gegenstand.

Sie liegt **vor** dem Scoreboard und ueberlappt es zur Haelfte: bei Spieler 1
links aussen und leicht gegen den Uhrzeigersinn gedreht, bei Spieler 2 rechts
aussen, gespiegelt und andersherum gedreht. Seite, Drehung und Spiegelung stehen
allein im CSS und haengen an `data-player`.

Vor der Kachel und nicht dahinter, weil die Kachel Milchglas ist: Dahinter
verschluckte sie die halbe Karte und liess sie als Fleck durchscheinen.

Sie ist bewusst **kleiner als die Punktekarte**: 3.6cqw breit, ueber das
Seitenverhaeltnis 4.6cqw hoch, gedreht rund 5cqw - und bleibt damit innerhalb
der rund 6cqw hohen Kachel, statt oben aus der Kopfzeile zu stossen. Hervor
schaut knapp die Haelfte (1.9cqw von 3.6cqw); der Rest verschwindet hinter der
Kachel. Weiter nach innen geht nicht, denn die Kachel ist Milchglas - was
dahinter liegt, schimmert durch und legt sich als Fleck ueber Beschriftung und
Zahl. Der E2E-Test misst beides.

Sie verschiebt nichts: Die Kopfzeile stellt je Spieler einen relativ
positionierten Rahmen um die Punktekarte
(`StageHeaderSlots.besidePlayer` in `@hfroemmel/quiz-react`), und die Karte liegt
darin absolut positioniert mit `z-index: 1`. Die Scoreboards bleiben farbneutral
und behalten ihre Groesse und Position.

Beim Ziehen **hebt die Ziehung sie auf**: Die kleine Karte ist im selben Moment
weg, ohne Uebergang (`data-lifted`), weil die fliegende Karte im Overlay ab
diesem Frame an genau ihrer Stelle steht - zwei Karten waeren eine zu viel. Sie
bleibt nur deshalb im Dokument, weil die Ziehung ihre Position messen muss.

Danach kommt sie **nicht zurueck**: Der Joker ist verbraucht, und eine
zurueckkehrende Karte wuerde das Gegenteil behaupten. Kein leerer Platzhalter,
keine durchgestrichene zweite Karte.

Sie ist kein Bedienelement: kein Zeiger, kein Fokus, das Bild traegt `alt=""`
und `aria-hidden="true"`. Fuer die Sprachausgabe steht ein Satz im
Spielerbereich - `stage.joker.available` / `stage.joker.used` aus der
vorhandenen Uebersetzungsstruktur.

## Die Ziehung auf der Buehne

`JokerDrawOverlay` (in `hfroemmel/quiz-live`, `apps/web/src/components/`) liegt
als Ebene ueber der Buehne - eingehaengt in den vorhandenen Slot `pads.overlay`
von `StageScreen`, also INNERHALB der Buehnenflaeche mit ihren Farben,
Containereinheiten und ihrer Zoomstufe. Keine globale `sceneRoot`-Kennung, kein
eigenes Portal am Dokument.

Der Ablauf, alle Dauern aus `jokerDrawTiming` im Kern:

| Abschnitt | Dauer | Was passiert |
| --- | --- | --- |
| Abheben | 120 ms | Ebene blendet ein, Frage und Antworten dimmen und werden weichgezeichnet, die kleine Karte verschwindet |
| Flug | 580 ms | Die Karte fliegt in einem Bogen von ihrer **gemessenen** Position in die Mitte, richtet sich von der Neigung auf `0deg` auf und waechst auf Kartengroesse |
| Einrasten | 120 ms | Kurzes Ueberschwingen auf `scale(1.03)`, dann `scale(1)` |
| *(Server meldet `revealed`)* | | Erst jetzt kennt der Client den Jokertyp |
| Drehen | 680 ms | Die Karte dreht um die senkrechte Achse; bei 90 Grad wechselt das Bild |

**Der Start ist gemessen, nicht gesetzt.** Die Komponente liest die Position der
kleinen Karte mit `getBoundingClientRect()` und rechnet sie in die Koordinaten
der Buehne um (ein Faktor aus der eigenen Breite, weil die Buehne skaliert sein
kann). Feste Koordinaten waeren bei der ersten Aenderung der Kopfzeile falsch -
und in der kleinen Operatorvorschau ohnehin.

Gedreht wird mit `JokerFlipCard`: zwei deckungsgleiche Seiten in einem
`preserve-3d`-Kasten, jede mit `backface-visibility: hidden`, die Rueckseite von
Anfang an auf `rotateY(180deg)`. Deshalb wechselt das Bild exakt bei 90 Grad -
kein Aufblitzen des falschen Jokers, kein Kreuzblenden. Die Rueckseite zeigt das
Zeichen (`joker-fifty-fifty-icon.svg` / `joker-audience-icon.svg`, als Maske
ueber der Textfarbe) und den Namen als Wort.

**Fortsetzen statt neu anfangen:** Jede Animation startet mit einem negativen
Versatz, der aus `startedAtServerMs`, `revealAtMs` und der Serveruhr berechnet
wird. Ein Buehnenfenster, das mitten im Flug neu laedt, sieht die Karte dort, wo
sie gehoert; eines, das mitten in der Drehung dazukommt, steigt in die Drehung
ein, statt sie von vorn zu beginnen.

Die aufgedeckte Karte bleibt **unbegrenzt** stehen. Kein automatisches
Ausblenden - der Operator entscheidet. Mit `CONTINUE_JOKER` verkleinert sie sich
leicht und verschwindet in etwa 200 ms, die Ebene gibt die Frage frei, und
danach nimmt sich das Overlay selbst aus dem Dokument.

Bei `prefers-reduced-motion` gibt es **keinen Flug, keine starke Skalierung und
keine 3D-Drehung**: Die aufgedeckte Karte blendet in 150 ms in der Mitte ein.
Alle fachlichen Zustaende und Sperren sind identisch, und das Ergebnis bleibt
genauso bis zum Klick stehen.

## Das Pult

Die Jokersteuerung sitzt in `OperatorControls` **zwischen "Antwort einloggen"
und "Aufloesen"** - genau dort, wo der Joker hingehoert: Ein Spieler hat
gebuzzert, sich aber noch nicht festgelegt.

**Der Bereich IST der Knopf.** Ueberschrift und `Joker ziehen` erscheinen
gemeinsam und verschwinden gemeinsam; es gibt keinen erreichbaren Zustand, in
dem das eine ohne das andere steht:

```ts
showJokerSection === showDrawJokerButton
```

Die Bedingung ist `allowedCommands.includes('DRAW_JOKER')` - dieselbe
Regelfunktion, die der Server anwendet, wenn der Befehl ankommt
(`evaluateJokerDraw`). Das Pult leitet nichts selbst her und prueft nichts
doppelt. Der Bereich ist damit weg, sobald einer dieser Punkte zutrifft:

* der antwortende Spieler hat seinen Joker schon gezogen,
* es hat niemand gebuzzert bzw. niemand darf gerade antworten,
* eine Zwischenansicht laeuft (Richtig-, Falsch- oder Aufloesungsanimation),
* eine Antwort ist eingeloggt oder aufgeloest,
* eine Ziehung fliegt, liegt oder wirkt gerade,
* die Frage traegt keinen Joker.

Ein verbrauchter Joker bekommt **keinen** Ersatztext und kein graues Feld: Ein
Kasten "Joker", in dem nichts zu tun ist, sagt dem Operator nur, dass er etwas
verpasst hat.

| Zustand | Was zu sehen ist |
| --- | --- |
| ziehbar | Ueberschrift `Joker` und `Joker ziehen` |
| nur ein Ergebnis moeglich | dazu `Bei dieser Frage kann nur der Publikumsjoker gezogen werden.` |
| nicht ziehbar | gar nichts |
| `drawing` | `Joker wird gezogen …`, ohne Ueberschrift; alle Antwort- und Aufloeseknoepfe sind weg |
| `revealed` | `Weiter`, ohne Ueberschrift, an der Stelle jedes anderen `Weiter` |

Die laufende Ziehung steht bewusst **ausserhalb** des Bereichs: Waehrend die
Karte fliegt und liegt, gibt es nichts zu ziehen, und eine Ueberschrift "Joker"
waere dort eine Behauptung. `Weiter` muss es trotzdem geben - `CONTINUE_JOKER`
ist der einzige Befehl, den die Engine dann annimmt; ohne ihn bliebe die Karte
im Saal liegen und die Frage gesperrt. Es schickt `CONTINUE_JOKER` mit der
`sequenceId` und ausdruecklich nicht die allgemeine Weiter-Aktion - es laedt
keine neue Frage.

Das Ergebnis nennt das Pult **nicht**: Es steht gross auf der Buehne, und ein
zweites Mal am Pult waere nur eine weitere Stelle, die es sagen muss.

Alles davon kommt aus `view.joker`, also aus denselben Regelfunktionen, die die
Engine beim Command anwendet. Das Pult leitet nichts selbst her: Ein Knopf, der
verfuegbar aussieht, fuehrt zu einem Command, den der Server annimmt.

## Dateien

**`hfroemmel/quiz`**

| Datei | Was |
| --- | --- |
| `packages/core/src/contracts/joker.ts` | Typen, Regeln, `jokerDrawTiming`, `createJokerStates`, `jokerOf`, `activeJokerSequence`, `jokerTypeLabel` |
| `packages/core/src/contracts/state.ts` | `GameState.jokerByPlayer`, `GameState.jokerSequence` |
| `packages/core/src/contracts/commands.ts` | `DRAW_JOKER`, `CONTINUE_JOKER`, Rollen, Abweisungsgruende |
| `packages/core/src/contracts/viewModels.ts` | `PublicJokerStatus`, `PublicJokerDraw`, `PublicOption.eliminated`, `OperatorJokerControl` |
| `packages/core/src/engine/joker.ts` | `evaluateJokerDraw`, `evaluateJokerContinue`, `drawJokerType`, `pickEliminatedOptions`, `drawableOptionIds`, `jokerBlockedCommands` |
| `packages/core/src/engine/engine.ts` | `drawJoker`, `continueJoker`, der Aufdeckschritt als zeitgesteuerter Uebergang, die Sperre waehrend der Ziehung, Vorrat bei `START_GAME` (nur `operated`) |
| `packages/core/src/engine/allowedCommands.ts` | die Jokerbefehle, und was eine laufende Ziehung vom Pult nimmt |
| `packages/core/src/engine/projection.ts` | `jokerDraw`, weggefallene Antworten ab `applied`, der Operatorbereich |
| `packages/react/src/presentation/stage/jokerIcons.tsx`, `.module.css` | die beiden Jokerzeichen als Maske |
| `packages/react/src/assets/joker-*-icon.svg` | die Zeichen selbst |
| `packages/react/src/presentation/stage/AnswerList.tsx`, `.module.css`, `answerState.ts` | weggefallene Antworten treten an ihrem Platz zurueck |
| `packages/react/src/presentation/stage/Score.tsx`, `.module.css` | Gruppenzeichen statt Spielernummer, mit Ueberblendung |
| `packages/react/src/presentation/stage/StageHeader.tsx`, `.module.css` | der Slot `besidePlayer` und die Ableitung des Gruppenzeichens |
| `packages/react/src/presentation/animationPresets.ts` | Zuruecktreten, Ueberblendung, Ausblenden als Tokens |
| `packages/react/src/presentation/texts.ts` | `stage.joker.*` |

**`hfroemmel/quiz-live`**

| Datei | Was |
| --- | --- |
| `apps/web/src/assets/Jokerkarte_Livequiz_verfuegbar.png`, `Jokerkarte_Kinderquiz_verfuegbar.webp` | die Karten der beiden Gestaltungswelten |
| `apps/web/src/components/jokerCardArt.ts` | welche Karte welche Welt bekommt, samt Proportionen |
| `apps/web/src/components/JokerCard.tsx`, `.module.css` | die kleine Karte am Scoreboard und der Header-Slot |
| `apps/web/src/components/JokerDrawOverlay.tsx`, `.module.css` | die Ziehung: Ebene, Flug, Einrasten, Ausblenden |
| `apps/web/src/components/JokerFlipCard.tsx`, `.module.css` | die Karte mit Vorder- und Rueckseite |
| `apps/web/src/apps/stage/StageApp.tsx` | Karte und Ziehung im Buehnenfenster |
| `apps/web/src/apps/operator/OperatorControls.tsx`, `.module.css` | die Sektion `Joker` zwischen Einloggen und Aufloesen |
| `apps/web/src/apps/operator/OperatorApp.tsx` | Ziehung in der Vorschau; das alte `JokerPanel` ist entfallen |

## Tests

| Suite | Anzahl | Was |
| --- | --- | --- |
| `packages/core/test/joker.test.ts` | 53 | ein Joker je Spieler, nichts vor dem Buzzer, nur der Antwortende, kein zweites Mal, unabhaengige Spieler, doppelte Befehle, die Muenze aus injiziertem Zufall, verborgener Typ bis zur Aufdeckung, der Aufdeckschritt des Servers, die Sperre der Frage, `CONTINUE_JOKER` samt veralteter Kennung, alle 50:50-Regeln, das Bilderkennen von der Verfuegbarkeit ueber die ungefragte Zufallsquelle bis zum eingefrorenen Bildstand, der Publikumsjoker und der Antwortbesitz, Lebensdauer, jeder Zustand, in dem das Pult ziehen laesst oder eben nicht, der Operatorbereich, und ein Spiel ohne Joker |
| `packages/server/test/joker.test.ts` | 12 | der Server besitzt Muenze und Ergebnis, das Bilderkennen mit `audience` ueber einen Neustart hinweg, ein Snapshot fuer alle Rollen, Aufdecken von selbst, Anwenden erst mit `Weiter`, Neustart ohne neue Ziehung, wiederholter Command, veraltete Kennung, die Sperre, die Rollen, und ein Spiel ohne Joker |
| `test/e2e/joker.spec.ts` (quiz) | 3 | weggefallene Antworten bleiben an ihrem Platz und ohne Strich, Scoreboards unveraendert, und das Touchgeraet hat nichts davon |
| `test/e2e/joker.spec.ts` (quiz-live) | 14 | Ueberschrift und Knopf immer nur gemeinsam (ueber eine ganze Frage, beim Spielerwechsel und nach verbrauchtem Joker), der Knopf erst nach dem Buzzer und nur einer, die Bilderfrage mit dem Hinweis und dem Publikumsjoker, die eigene Karte des Kinderquiz, die Reihenfolge der Sektionen, der Flug vom richtigen Scoreboard in die Mitte, Aufdecken erst nach der Drehung und Stehenbleiben, Anwenden mit `Weiter` ohne neue Frage, Neuladen beider Ansichten, und der Modus ohne Bewegung |

Laufen mit `pnpm test` und `pnpm test:e2e` in beiden Repositories.
