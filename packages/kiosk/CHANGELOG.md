# @hfroemmel/quiz-kiosk

## 0.12.0

### Minor Changes

- ee2c6ff: Das Video tritt auf und ab - und danach wartet der Ablauf auf den Operator
  
  Die Videoflaeche waechst beim Eintritt in die Videoszene aus der Mitte heraus
  und blendet ein (`video-enter`, 640 ms). Ist das Video durchgelaufen, blendet
  sie wieder aus (`presentationTiming.videoExitMs`); das Element haelt erst an,
  wenn die Blende durch ist.
  
  Im gefuehrten Spiel geht ein durchgelaufenes Video nicht mehr von selbst in die
  Frage ueber. Die neue Phase `video-ended` haelt den Ablauf an, bis der Operator
  `SHOW_QUESTION_AFTER_VIDEO` sendet; erlaubt sind dort ausserdem `RESTART_VIDEO`
  und `SKIP_QUESTION`. Der Buzzer bleibt gesperrt, die Szene bleibt `video`. Am
  Geraet (`self-service`) folgt die Frage weiterhin unmittelbar.
  
  Die Restzeituhr der Operatorvorschau ist wieder ausgebaut. Die Vorschau spielt
  kein Video ab und zeigt nur noch den Stand: bereit, laeuft, angehalten, zu Ende
  (`[data-video-status]`). Mit ihr entfallen `videoProgress`, `formatiereDauer`
  und die Texte `video.remaining`, `video.paused` und `video.unknownDuration`;
  neu sind `video.status.ready`, `video.status.playing`, `video.status.paused`
  und `video.status.ended`.
  
  "Video neu starten" kommt jetzt auf der Buehne an. Die Szene erkannte einen
  Neustart daran, dass die gemeldete Position zurueckging - waehrend das Video
  laeuft, kommen aber keine Schnappschuesse, und die Position stand vor wie nach
  dem Neustart bei null. Verglichen wird nun mit der auf jetzt hochgerechneten
  Serverposition: Liegt das Element deutlich davor, war es ein Neustart.
  
  Gastgeber, die Phasen selbst abbilden, muessen `video-ended` kennen. Wer Medien
  selbst ausliefert, muss Range-Anfragen beantworten (206) - sonst ist das
  Videoelement nicht spulbar, und weder Neustart noch Angleichen greifen.

### Patch Changes

- Updated dependencies [ee2c6ff]
  - @hfroemmel/quiz-core@0.12.0
  - @hfroemmel/quiz-themes@0.12.0
  - @hfroemmel/quiz-react@0.12.0

## 0.11.0

### Minor Changes

- 73dacf9: The joker is drawn, not chosen
  
  A player who has buzzed asks for their joker, the operator draws it, and the
  SERVER flips a fair coin between the 50:50 and the audience joker. Nobody picks
  the variant - not the player, not the operator, and no client. A choice would be
  a tactical decision; a draw is a moment.
  
  `USE_JOKER { playerId, jokerType }` and `RESTORE_JOKER` are gone. In their place
  `DRAW_JOKER` (no payload at all: the coin belongs to the server, and the player
  follows from who holds the buzz) and `CONTINUE_JOKER { sequenceId }`, which
  applies what came out. A draw cannot be taken back - the joker is spent from its
  first moment, and no command hands it back.
  
  `GameState.jokerSequence` replaces `activeFiftyFifty` and carries the draw as it
  runs: `idle → drawing → revealed → applied`. The turn of the card is a server
  step, scheduled as a timed transition, so a client that reconnects mid-draw
  finds the same phase as everybody else and never re-draws. The variant reaches
  the clients with `revealed` and the eliminated answers with `applied` - early
  enough to show, too late to give away.
  
  A running draw holds the question: logging, resolving, continuing and buzzing
  are refused and are not offered in `allowedCommands`.
  
  `PublicOption.hidden` becomes `PublicOption.eliminated` and is drawn as a line
  struck across the answer; `PublicScore.joker` stays; `PublicQuizViewModel`
  gains `jokerDraw`, and the operator's `joker` control is now one button rather
  than four.
  
  New in `@hfroemmel/quiz-react`: `JokerTypeIcon` with the two joker faces (the
  audience shape doubles as the group mark that replaces the active player's
  number while an audience joker is in effect), and the timings for strike,
  marker crossfade and dismissal in `presentationTiming`.

### Patch Changes

- Updated dependencies [73dacf9]
  - @hfroemmel/quiz-core@0.11.0
  - @hfroemmel/quiz-themes@0.11.0
  - @hfroemmel/quiz-react@0.11.0

## 0.10.0

### Minor Changes

- 978a5db: One shared joker per player, for the live quiz alone
  
  Every player of an OPERATED game holds a single joker and may spend it either as
  a 50:50 or as an audience joker. Spending either one exhausts that player's
  joker for the whole game; it comes back only with a new game or the operator's
  explicit reset.
  
  LIVE QUIZ ONLY, WITHOUT A FLAG. `START_GAME` creates the supply only for
  `flowProfile: 'operated'`, so a kiosk, a standalone build or a touch device
  carries no joker state, no joker command and not one element more in the DOM
  than before. `gameHasJokers(state)` is the single place that decides it.
  
  New commands `USE_JOKER { playerId, jokerType }` and
  `RESTORE_JOKER { playerId }`, both operator-only and server-validated. New state
  `GameState.jokerByPlayer` and `GameState.activeFiftyFifty`, new snapshot fields
  `PublicScore.joker`, `PublicOption.hidden`,
  `PublicQuizViewModel.activeFiftyFifty` and `OperatorQuizViewModel.jokers`.
  
  `StageHeaderSlots` gains `besidePlayer`: a relatively positioned frame around
  each scoreboard, so a host can hang something behind a player's card without
  widening the header. The live quiz uses it for its joker card.
  
  This replaces the two separate lifelines, which were never released: the
  `USE_LIFELINE` / `RESTORE_LIFELINE` commands, `LifelineConfig`,
  `PlayerState.lifelines`, the `lifelineUsed` / `lifelineRestored` events and the
  exported `Lifelines` component are gone.

### Patch Changes

- 33add5d: Die Auswahlkarten der hellen Startauswahl sind Flaechen, keine Rahmen
  
  Eine gewaehlte Karte steht jetzt voll in demselben Blau, das im Spiel eine
  angetippte Antwort traegt - derselbe Wert aus derselben Palette; Titel, Zeile,
  Zeichen und Haekchen darauf in Weiss. Eine offene Karte ist das ruhige Grau
  einer nicht angetippten Antwort. Keine Kante, in keinem Zustand: Die
  Tastaturmarke ist ein weicher Schein und ein Hauch Groesse statt eines Rings,
  sodass sich Auswahl und Fokus nicht mehr zu zwei Linien uebereinanderlegen.
  Der sekundaere Knopf traegt dieselbe gefuellte Flaeche, der gruene Startknopf
  bleibt, wie er war.
  
  Neue Token: `--start-option`, `--start-option-hover` und `--start-option-icon`.
  Die Auswahlkarten hatten keinen eigenen Namen und hiessen `surface` wie das
  Einstellungsfenster und die Rueckfrage; in der hellen Fassung gehen sie
  getrennte Wege.
  
  Dunkle Fassung und Kinderwelt sind unveraendert - nachgemessen, Pixel fuer
  Pixel. Im Dunkeln behaelt die Karte ihre Kante: Dort liegt ein fast schwarzer
  Kasten auf fast schwarzem Grund, und ohne Kante schwaemmen die Karten.
- 44bc385: Die Spielerfarbe traegt allein der Buzzer
  
  Am Touchgeraet ist die Punktekarte jetzt neutral - dieselbe Milchglaskachel wie
  im Saal, im Einzelspiel wie im Duell und in jedem Zustand. Der Buzzer steht
  dafuer vollflaechig im reinen Ton seines Spielers, ohne Kante: rot links, blau
  rechts. Weisse Aufschrift auf beiden (5,9:1 und 8,4:1), und weder `hover`,
  `active`, `disabled` noch der geholte Zuschlag aendern Grund, Kante oder
  Deckkraft.
  
  Masse, Positionen und Funktion sind unveraendert. Die Kinderwelt ist
  unberuehrt: Ihr Buzzer ist eine gezeichnete Karte und trug nie eine
  Spielerfarbe.
- Updated dependencies [978a5db]
- Updated dependencies [33add5d]
- Updated dependencies [44bc385]
  - @hfroemmel/quiz-core@0.10.0
  - @hfroemmel/quiz-themes@0.10.0
  - @hfroemmel/quiz-react@0.10.0

## 0.9.1

### Patch Changes

- 3d262cd: Die Fussleiste des Touchgeraets liegt am unteren Bildrand
  
  Punktestand, Zaehler und die beiden Buzzer stehen an der Kante, an der jemand
  vor dem Geraet steht - auch auf einem Fenster, das hoeher als 16:9 ist. Der
  uebrige Platz liegt jetzt zwischen Szene und Leiste statt gleichmaessig
  darueber und darunter. Auf 16:9 aendert sich nichts.
- Updated dependencies [3d262cd]
  - @hfroemmel/quiz-core@0.9.1
  - @hfroemmel/quiz-themes@0.9.1
  - @hfroemmel/quiz-react@0.9.1

## 0.9.0

### Minor Changes

- 7fe9bd1: Die Breite ist das einzige Mass der Buehne
  
  Alle Groessen der Buehne und des Touchgeraets rechnen ab jetzt gegen die
  BREITE der Flaeche und gegen nichts sonst: `cqw` in der Buehne, `vw` in der
  Startauswahl davor. `clamp()`, `cqh` und `vh` sind verschwunden, ebenso die
  Schwelle `max-aspect-ratio` und die Ausnahme fuer flache Fenster - alles drei
  liessen die HOEHE mitentscheiden.
  
  Bezugsbreite ist 1440 px, die Zeichenflaeche der Entwuerfe (1440x810): Auf
  16:9 ist die Darstellung dieselbe wie vorher, Zahl fuer Zahl. Auf einer
  hoeheren Flaeche - 4:3-Bildschirm, Fenster eines Gastgebers, Einzelspiel ohne
  Buzzer - bleibt jetzt Luft, statt dass die Komposition sich streckt. Am
  Touchgeraet liegt sie gleichmaessig ueber und unter der Szene.
  
  Sichtbare Folge fuer Gastgeber: In einem Kasten, der hoeher als 16:9 ist,
  steht das Quiz kleiner als bisher und nutzt die Hoehe nicht aus. Dafuer zeigen
  zwei Geraete gleicher Breite dieselbe Frage in derselben Groesse.
- 2258ccf: Die Startauswahl steht jetzt in derselben Fassung wie die Buehne danach.
  
  **SIE KONNTE ES NICHT.** `.stage--bright` steht an der Buehne, und die entsteht
  erst mit dem Spiel - Startauswahl, Einstellungen und Rueckfragen liegen
  darueber. Sie waren deshalb immer dunkel, auch seit die Buehne im Zweifel hell
  ist: dunkles Menue, helles Spiel. Die Fassung steht jetzt als `data-theme` am
  Wurzelelement von `QuizGame`, und `palette.css` haengt die hellen
  `--start-*`-Farben daran (`[data-quiz-game][data-theme='bright']`). Ein
  Datenattribut und keine Klasse, weil dieses Stylesheet erzeugt wird und die
  Klassen der Bauteile gehasht sind.
  
  **Neu in der Palette: `brightStartPalette`** - und darin steht kein eigener
  Farbwert, wo es schon einen gibt. Papier, Tinte, das Blau der markierten
  Antwort, das Gruen des Knopfes, der aufloest: alles Verweise auf
  `brightPalette`. Eigene Werte hat nur, was die Buehne nicht kennt - das
  Milchglas der Karten und ihre Haarlinien. Und nur was ABWEICHT steht darin; der
  Rest kommt weiter aus `startPalette`.
  
  **DIE AUSWAHL IST NICHT DIE HANDLUNG.** Beide waren dasselbe Gruen, und im
  Dunkeln faellt das nicht auf. Auf Papier schon: Dort traegt die Auswahl das Blau
  der markierten Antwort, und Gruen gehoert allein dem Knopf, der das Spiel
  startet. Dafuer gibt es jetzt einen eigenen Satz Namen - `--start-selected`,
  `--start-selected-bright`, `--start-ink-on-selected`,
  `--start-meta-on-selected` - mit denselben Werten wie vorher, damit sich in der
  dunklen Fassung nichts aendert. Dazu getrennt: `--start-ink-on-green` ist die
  Aufschrift auf dem Startknopf (hell in beiden Fassungen),
  `--start-ink-on-badge` das Zeichen auf der gefuellten Auswahlmarke.
  
  Die beiden Lichter im Grund heissen nach ihrem PLATZ statt nach ihrer Farbe
  (`ambient-left`/`ambient-right`): In der hellen Fassung sind sie abgeschaltet,
  denn dort grenzt die Kante der Karte sie ab und nicht der Grund.
  
  Aufbau, Positionen, Groessen, Texte und die Skalierung sind unveraendert; die
  Kinderwelt bleibt ihre eigene Welt und meldet sich als `data-theme="kids"`.

### Patch Changes

- Updated dependencies [7fe9bd1]
- Updated dependencies [2258ccf]
  - @hfroemmel/quiz-core@0.9.0
  - @hfroemmel/quiz-themes@0.9.0
  - @hfroemmel/quiz-react@0.9.0

## 0.8.0

### Minor Changes

- bc9579a: Die Startauswahl gehoert jetzt auch in der Kinderwelt zum Kinderquiz.
  
  **Sie war es bisher nicht - und konnte es nicht sein.** Die Welt steht als
  `.stage--kids` an der Buehne, und die entsteht erst mit dem Spiel; Startauswahl,
  Einstellungen und Rueckfragen liegen darueber. Regeln, die an der Buehnenklasse
  haengen, greifen dort nie. Die Welt steht deshalb ab jetzt als `data-skin` am
  Wurzelelement von `<QuizGame>`, und die Namen der Welt - Tinte, Papier,
  Handschrift, Zeiten - stehen in `styles/stage.css` an `[data-skin='kids']`
  statt an der Buehnenklasse. Die Buehne selbst behaelt dort nur, was ihre Flaeche
  betrifft.
  
  **Die Welt kommt jetzt aus der Zielgruppe, nicht erst aus dem Spiel.** Vor dem
  Start meldet `theme` die Grundwelt - ein Kindergeraet zeigte damit die Auswahl
  der Erwachsenen und wechselte erst mit der ersten Frage. Der Katalog nennt die
  Gestaltungswelt deshalb je Zielgruppe (`catalog.audiences[].skin`), und die
  Startauswahl liest sie dort.
  
  **Gezeichnet statt gezogen.** Karten, Knoepfe und die Bedienspalte tragen die
  Zeichnungen aus dem Assetpaket des Kinderquiz - dieselben Dateien, die im Spiel
  die Antwortzeilen und die Fragetafel tragen, nicht nachgebaute. Eine gewaehlte
  Karte sieht aus wie eine gewaehlte Antwort: rote Karte, weisse Schrift. Der
  gruene Ring und die gruene Kante entfallen dort; sie sind die Auswahlfarbe der
  Erwachsenenauswahl und haben in dieser Welt keine Bedeutung.
  
  **Ein primaerer Knopf fuer die ganze Welt.** "Los geht's" in der Auswahl,
  "Weiter" und "Antwort abgeben und aufloesen" in der Fussleiste kommen aus
  EINEM Satz Token (`--kids-frame`, `--kids-frame-slice`, `--kids-frame-width`).
  Der Aufbau der gezeichneten Flaeche steht genau einmal; ein Ort, der dazukommt,
  nennt nur noch die drei Namen. Weil die Kontur ein `border-image` ist, behalten
  die Ecken bei jeder Knopfbreite ihre Groesse - gedehnt werden nur die Kanten.
  
  Der Erwachsenenmodus ist unveraendert.

### Patch Changes

- 49b3605: Die Markentafel des Startbildschirms traegt nur noch Motiv und Titel.
  
  Weg sind die Zeile mit dem Namen der Zielgruppe darueber und der Satz darunter.
  Uebrig bleibt das, was aus fuenf Metern wirkt: das Bild und die eine Zeile.
  
  Fuer Gastgeber heisst das: Eine `startDescription` (bzw. `startDescriptions`)
  im Inhalt wird auf dem Startbildschirm nicht mehr angezeigt. Das Feld bleibt im
  Schema und steht weiterhin als `theme.startDescription` im Ansichtsmodell -
  eine Aufstellung, die es gepflegt hat, muss nichts aendern.
- bc9579a: Das Rueckfallmotiv der Starttafel ist wieder da.
  
  `packages/kiosk/src/assets/quiz-mark.svg` war geloescht, die Adresse in
  `GameStart.tsx` blieb stehen. Der Build meldete das als Warnung und lieferte die
  Adresse unaufgeloest aus - eine Aufstellung ohne eigenes Startbild bekam damit
  kein Bild. Dazu drei Reste ohne Verwendung: das Funkenzeichen, die
  Schrittnummern-Hilfe und die Regeln der entfernten Tafelzeile.
- d233bda: Das Startmenue nach dem neuen Entwurf.
  
  **Die Stufenkarte ist dieselbe Zeile wie die Moduskarte**, nur ohne Zeichen:
  Text links, Haekchen rechts. Die Punktereihe darueber faellt weg - sie zaehlte
  die Stelle in der Liste und sagte damit nichts, was nicht schon in "5 Fragen"
  steht. Ohne sie ist die Karte flacher, und die beiden Reihen der Auswahl stehen
  nicht mehr verschieden hoch nebeneinander.
  
  **Der Startknopf traegt helle Schrift**, wie alles andere auf der Flaeche, und
  der Pfeil steht frei darauf statt in einer eigenen Scheibe. Der Balken ist die
  einzige volle Farbe der Auswahl; er braucht keine zweite Auszeichnung darin.
  
  **In der Kinderwelt steht die Auswahl auf Papier.** Der dunkle Verlauf mit den
  beiden farbigen Lichtern gehoert zur Auswahl der Erwachsenen; die Kinderwelt
  bekommt denselben Grund wie das Spiel danach. Damit ist auch der Titel der
  Markentafel dort wieder zu lesen.
- Updated dependencies [cdf1303]
- Updated dependencies [bc9579a]
  - @hfroemmel/quiz-react@0.8.0
  - @hfroemmel/quiz-core@0.8.0
  - @hfroemmel/quiz-themes@0.8.0

## 0.7.1

### Patch Changes

- 1aa4abb: Der Startbildschirm und zwei Buehnenbauteile ohne ihre Zierteile.
  
  Von der Startauswahl fallen weg: das Funkenzeichen auf der Markentafel, der
  Chip mit dem Umfang der gewaehlten Stufe, die beiden nummerierten
  Schrittueberschriften ueber Modus und Schwierigkeit und die Fussnote darunter.
  Was bleibt, sind die Karten selbst - sie sagen ohnehin, was sie sind, und die
  Reihenfolge steht schon in der Anordnung.
  
  Damit entfaellt auch der Oberflaechentext `kiosk.setupNote`. Ein Gastgeber, der
  ihn in seinen `interfaceStrings` stehen hat, muss nichts tun: Ein Schluessel,
  den niemand liest, stoert nicht.
  
  Auf der Buehne verlieren das Hochformat der Medienflaeche und die Kacheln der
  Bildenthuellung ihre eingesetzte Kantenlinie (`box-shadow: inset`).
- Updated dependencies [1aa4abb]
  - @hfroemmel/quiz-react@0.7.1
  - @hfroemmel/quiz-core@0.7.1
  - @hfroemmel/quiz-themes@0.7.1

## 0.7.0

### Minor Changes

- Ein Knopfsystem fuer die ganze Buehne - und eine eigene Flaeche fuer den
  Gastgeber darin.
  
  **Die Schaltflaechen der Buehne kommen jetzt aus einer Quelle.** `Weiter`,
  `Antwort abgeben und aufloesen` und der Buzzer waren drei Knoepfe aus zwei
  Dateien mit drei Groessen; nebeneinander sah das aus wie drei Systeme. Kasten,
  Hoehe, Rundung, Typografie und die Zustaende (gedrueckt, gesperrt, Tastaturfokus)
  stehen jetzt als Token und als globale Klasse `stage-button` in
  `@hfroemmel/quiz-react/styles/stage.css`, dazu `stage-button--primary` fuer die
  Handlungsfarbe. Was einen Knopf ausmacht, sagt er weiterhin selbst - der Buzzer
  seine Spielerfarbe, seine Groesse und seine Versalien -, und zwar ueber die
  Token statt ueber ueberschriebene Regeln. Die Regeln der Klasse stehen in
  `:where(...)` und haben damit kein Gewicht: Ein Bauteil, das sie benutzt, gewinnt
  immer, unabhaengig von der Reihenfolge der Stylesheets.
  
  Sichtbar aendert sich dabei eins: Die Aufschrift der Knoepfe in der Fussleiste
  ist kleiner (`--stage-button-size`, 1,5 cqw statt 2 cqw). `Antwort abgeben und
  aufloesen` ist der laengste Satz der Buehne und drueckte die Mitte der Leiste
  auseinander. Flaeche und Trefferfeld bleiben unveraendert - der Knopf fuellt
  weiterhin das ganze Hinweisfeld.
  
  **Der Gastgeber kann eine eigene Ebene IN die Buehne setzen** - `pads.overlay`
  an `QuizScene`/`StageScreen`, `overlay` an `QuizGame`. Sie wird ueber Szene,
  Fussleiste und Koernung gerendert, aber innerhalb der Buehnenflaeche: Nur dort
  gelten deren Farben, deren Containereinheiten und vor allem deren Zoomstufe.
  Daneben behielte so eine Ebene ihre volle Groesse, waehrend alles darunter
  kleiner wird. Gedacht ist sie fuer Schritte, die ein Gastgeber zwischen zwei
  Fragen einschiebt; mit `stage-button` sieht sein Knopf darin aus wie der der
  Buehne.
  
  **Im Einzelspiel gibt es keinen Buzzerklang mehr.** Es gibt dort auch keinen
  Buzzer: Der erste Fingertipp auf eine Antwort holt sich den Zuschlag selbst, und
  die Buehne quittierte diesen einen Tipp mit zwei Klaengen uebereinander - dem
  Auswahlton und dem Buzzer. Der Buzzer meldet, dass jemand einem anderen
  zuvorgekommen ist, und niemand ist da. Im Duell bleibt er unveraendert. Die
  Entscheidung steht als reine Funktion (`klaengeFuer`) und ist damit geprueft.
- Der Startbildschirm des Geraets nach dem Entwurf `Startmenue v1`
  (`docs/entwuerfe/startmenue/`) - und das Einstellungsfenster daran angeglichen.
  
  Statt eines mittigen Bogens aus Bild, Titel und zwei Fragen stehen jetzt zwei
  Spalten nebeneinander. Links die Markentafel: Zielgruppe, Motiv, Titel, ein Satz
  dazu und der Umfang der gewaehlten Stufe - sie wird nicht angefasst und ist das
  Plakat, das jemanden herholt. Rechts die Bedienung: zwei nummerierte Schritte
  mit Karten, darunter die Startschaltflaeche - alles beisammen und in der
  Reihenfolge, in der entschieden wird.
  
  Eine gewaehlte Karte ist an DREI Dingen zugleich zu erkennen: gruene Kante,
  gruen gekippte Flaeche und Haekchen. Eine Kante allein verschwindet aus zwei
  Metern und schraeg von der Seite - und genau so steht man an einem Geraet im
  Foyer.
  
  Im Einzelnen:
  
  - `quiz-themes`: neue `startPalette` (`--start-*`) - die Farbwelt des
    Startbildschirms, bewusst getrennt vom Bedienrahmen des Operators.
  - `quiz-core`: die Zielgruppe kann eine `startDescription` tragen, je Sprache
    als `startDescriptions` - wie schon Titel und Startbild. Sie steht als
    `theme.startDescription` im Ansichtsmodell.
  - `quiz-react`: fuenf neue Oberflaechentexte (`kiosk.setupTitle`,
    `kiosk.setupSubtitle`, `kiosk.soloHint`, `kiosk.duoHint`).
  - `quiz-kiosk`: neuer Aufbau der Startauswahl, Einstellungen und Rueckfragen in
    derselben Formensprache, das Quizmotiv des Entwurfs als mitgeliefertes
    Rueckfallbild.
  
  An Geraeten mit nur einer Spielerzahl - dem Kiosk - entfaellt der Modusschritt,
  und die Schwierigkeit traegt die 01. Untereinander stehen beide Spalten, sobald
  die Breite fehlt.
  
  Aendert sich fuer Gastgeber: Die Startauswahl setzt nicht mehr die globalen
  `button`-Klassen. Sie werden weiterhin mit `@hfroemmel/quiz-kiosk/styles.css`
  ausgeliefert - fuer die Umgebung, die der Gastgeber selbst baut.

### Patch Changes

- Startauswahl, Einstellungen und Rueckfragen setzen ihre Schaltflaechen jetzt in
  EINER Schriftgroesse.
  
  Der hervorgehobene Knopf war auch groesser gesetzt als die Knoepfe daneben -
  "Los geht's" groesser als "Allein", "Fertig" groesser als "An". Damit wurde aus
  einer Reihe gleichrangiger Ziele eine Treppe. Hervorgehoben ist der eine durch
  Farbe und Flaeche; seine Schrift muss dafuer nicht auch noch groesser sein.
  
  Die Groesse steht als `--kiosk-button-font-size` an der Startflaeche und an der
  Dialogkarte und damit an einer Stelle. Die beiden Eckknoepfe - Sprache und
  Zahnrad - bleiben davon unberuehrt: Sie stehen nicht in der Reihe, sondern am
  Rand.
- Updated dependencies
- Updated dependencies
- Updated dependencies
  - @hfroemmel/quiz-react@0.7.0
  - @hfroemmel/quiz-core@0.7.0
  - @hfroemmel/quiz-themes@0.7.0

## 0.6.1

### Patch Changes

- e144665: Die Videophase lief in eine Schleife: Bild flackerte, das Video kam nie zum
  Abspielen, und der Uebergang zur Frage wurde nie faellig.
  
  Der Buehnenclient haengt seinen Szenenknoten an die Kennung des letzten
  Uebergangs. Der Zeitgeber fuer das Videoende trug diese Kennung mit - jede
  Laufzeitmeldung erzeugte damit eine neue, React baute die Szene samt
  Videoelement neu auf, das frische Element meldete seine Laufzeit, und der Kreis
  begann von vorn. Mit zwei Fenstern, die dasselbe Video zeigen, schaukelten sich
  beide gegenseitig hoch.
  
  Behoben an drei Stellen:
  
  - Zeitgeber und Praesentationsuebergang sind getrennt. `scheduleTimedTransition`
    kennt jetzt eine stille Fassung: Beim Video animiert nichts, und seine
    Laufzeit ist keine Animationsdauer.
  - Eine Statusmeldung plant das Ende nur noch, wenn keines steht. Die Laufzeit
    meldet jeder Client, der das Video zeigt; nur ein Befehl - Starten,
    Fortsetzen, Zuruecksetzen - plant neu.
  - `PAUSE_VIDEO` nimmt den geplanten Uebergang zurueck. Sonst zeigte der Saal die
    Frage, waehrend der Operator gerade angehalten hatte, um etwas zu sagen.
- Updated dependencies [e144665]
  - @hfroemmel/quiz-core@0.6.1
  - @hfroemmel/quiz-themes@0.6.1
  - @hfroemmel/quiz-react@0.6.1

## 0.6.0

### Minor Changes

- 6856432: **Mehrsprachigkeit.** Fragen, Medien und Beschriftungen lassen sich in weiteren
  Sprachen hinterlegen; ein Umschalter im Startmenue erscheint, sobald mehr als
  eine Sprache konfiguriert ist.
  
  - `config.locales` meldet die Sprachen an - die erste ist die Grundsprache.
  - Fragen tragen `translations` je Sprache (Text, Optionen, Medium, Erklaerung).
    Optionen werden EINZELN nach Bezeichner ersetzt, damit eine Uebersetzung die
    Wertung nicht verschieben kann.
  - Alles mit einem `label` bekommt ein `labels`; Zielgruppen zusaetzlich
    `startTitles`.
  - `config.interfaceStrings` uebersetzt die Oberflaeche. Die deutschen Fassungen
    stehen im Code (`standardTexte` in `@hfroemmel/quiz-react`), damit ein Quiz
    ohne einen einzigen Eintrag laeuft.
  - Neuer Befehl `SET_LOCALE`; er greift wie `SET_SOUND_ENABLED` auch ohne
    laufendes Spiel. `QuizGame` nimmt `locale` als Vorgabe aus dem Config File.
  - Was fehlt, faellt auf die Grundsprache zurueck; eine unbekannte Sprache wird
    auf sie zurueckgeholt statt abgewiesen.
  
  **Video.** Ein durchgelaufenes Video geht jetzt in JEDEM Ablaufprofil von selbst
  in die Frage ueber - bisher blieb im gefuehrten Spiel ein schwarzes Bild stehen,
  bis der Operator umschaltete. Sein Knopf bleibt, um frueher umzuschalten. Das
  Ende wird ausserdem geplant, sobald das Video laeuft und die Laufzeit bekannt
  ist; bisher nur beim Melden der Laufzeit, was ein Video ohne Ende
  zuruecklassen konnte. `videoTailMs` ist deshalb von `selfServiceTiming` nach
  `gameTiming` gezogen.
  
  Die Operatorvorschau zeigt an der Stelle des Videos die **Restzeit** statt eines
  leeren Rechtecks. Im Saal steht sie nicht - dort laeuft das Bild.
  
  **Inhaltspipeline.** `quiz-content import-sheet` macht aus einer Google-Tabelle
  `questions.json`: Spaltenzuordnung als Konfigurationsdatei, `--print-headers`,
  `--dry-run`, Zeilenfehler mit Zeilennummer statt Abbruch.

### Patch Changes

- 723b035: Die Wortmarke oben links blieb im GEBAUTEN Paket ein weisser Balken. Sie ist
  eine Maske ueber einer Farbflaeche; der Bundler bettet die Grafik als
  `data:`-Adresse ein und schreibt deren Attribute mit Hochkommata
  (`width='339.417'`). In einem unquotierten `url()` ist das ein ungueltiges
  Zeichen - die Regel fiel stillschweigend aus, und die nackte Flaeche blieb
  stehen. In der Entwicklung fiel es nicht auf, weil dort eine Dateiadresse
  steht.
  
  Adressen in Inline-Stilen laufen jetzt durch `cssUrl()`, das sie in
  Anfuehrungszeichen setzt - auch das Fragebild im Hintergrund.
- Updated dependencies [723b035]
- Updated dependencies [6856432]
  - @hfroemmel/quiz-core@0.6.0
  - @hfroemmel/quiz-themes@0.6.0
  - @hfroemmel/quiz-react@0.6.0

## 0.5.0

### Minor Changes

- c68cb08: Die Bedienelemente des Operatorpults sind jetzt die gemeinsame Fassung fuer
  alle Anwendungen: `@hfroemmel/quiz-themes/controls.css`. Startauswahl,
  Einstellungen und Rueckfragen des Kiosks tragen dieselben Klassen (`button`,
  `button--primary`, `button--large`, `button--selected`) und damit dieselbe
  Flaeche, Kante, Schrift und Rueckmeldung beim Druecken. Am Geraet bleibt allein
  die Groesse eine andere - ein Pult wird mit der Maus bedient, ein Foyergeraet
  mit dem Daumen.
  
  Die Rundung steht in `--ui-radius` (Vorgabe 6px), die Farben wie bisher in den
  `--ui-*`-Token der Palette.
  
  `@hfroemmel/quiz-kiosk/styles.css` bringt die Klassen MIT - wer das Quiz
  einbettet, muss nichts nachtragen. Eine Anwendung mit eigener Oberflaeche
  ausserhalb des Quiz (das Operatorpult) importiert das Stylesheet neben der
  Palette:
  
      import '@hfroemmel/quiz-themes/palette.css'
      import '@hfroemmel/quiz-themes/controls.css'
  
  Die Buehne bleibt unberuehrt: Antwortzeilen, Buzzer und Punktekarten gehoeren
  zur Vorstellung und tragen weiter deren Farben und Containereinheiten.
- 36c0741: Einstellungen am Geraet: Der Startbildschirm von `QuizGame` bekommt ein
  Zahnrad, dahinter Ton an/aus, eine Tonprobe und die Anzeigegroesse. Es
  erscheint nur dort, wo der Gastgeber seine eigene Laufzeit mitbringt - haengt
  das Quiz an einem Server, gehoert der Ton der Vorstellung.
  
  Neue Props `soundEnabled` und `zoom` reichen die Vorgaben eines Config Files
  durch. `zoom` liegt zwischen 0,6 und 1; 1 ist die entworfene Groesse und damit
  das Maximum. Kleinere Werte verkleinern die Szene zur Mitte hin, waehrend Logo,
  Punktekarten und Fragezaehler am Bildrand bleiben und mitschrumpfen. Die Stufe
  steht als `--stage-zoom` ueber der Buehne.
  
  `SET_SOUND_ENABLED` greift jetzt auch, wenn kein Spiel laeuft: Der Ton gehoert
  dem Geraet, und am Kiosk sitzt der Schalter im Startbildschirm.
  
  Im laufenden Spiel steht oben rechts "Spiel beenden" mit einer Rueckfrage; er
  fuehrt zurueck in die Auswahl und erscheint nur, wenn der Serverstand
  `ABORT_GAME` erlaubt.
  
  Die Kopfzeile zeigt das Logo aus dem Inhalt (`themes[].logoAssetId`), wenn eines
  konfiguriert ist, und behaelt sonst die mitgelieferte Wortmarke. Am Touchgeraet
  hat sie mehr Luft nach oben.
  
  Die Startauswahl bekommt runde Ecken, vertikal mittig gesetzte Beschriftungen
  und groessere Zweitzeilen.
- 9e1bda7: Der Moderator darf den Zuschlag von Hand setzen (`SELECT_PLAYER_MANUALLY`) und
  die Antwort einloggen (`LOG_OPTION_ANSWER`). Am Buehnenabend steht er neben den
  Spielern und sieht als Erster, wer sich gemeldet hat; Punkte, Abbruch, Technik
  und Inhalte bleiben beim Operator.
  
  `QuizGame` und `GameStart` nehmen `playerCounts` entgegen - die Spielerzahlen,
  die ein Geraet anbietet. Bleibt nur eine uebrig, entfaellt die Frage danach
  ganz.

### Patch Changes

- dcc13bf: Die Zoomstufe steht jetzt in der eigenen CSS-Eigenschaft `scale` statt in
  `transform`. Auf der Szene liegen die Szenenuebergaenge, und die animieren
  `transform`: Als Transformation geschrieben wurde die Stufe davon
  ueberschrieben - eine Frage erschien in voller Groesse und sprang am Ende der
  Animation klein.
  
  Ausserdem folgen jetzt auch Startauswahl, Einstellungen, Rueckfrage,
  Abschlussleiste und der Beenden-Knopf der Zoomstufe. Sie ist eine Einstellung
  des Geraets, nicht eine des laufenden Spiels.
- Updated dependencies [c68cb08]
- Updated dependencies [36c0741]
- Updated dependencies [9e1bda7]
- Updated dependencies [dcc13bf]
  - @hfroemmel/quiz-core@0.5.0
  - @hfroemmel/quiz-themes@0.5.0
  - @hfroemmel/quiz-react@0.5.0

## 0.4.0

Diese Fassung und 0.3.0 wurden von Hand veroeffentlicht, weil die GitHub
Actions des Repositories stillstanden. Der Versionsstand, den
`changeset version` dabei schreibt, ist damals nicht ins Repository
zurueckgeflossen - das Repository fuehrte weiter 0.2.0, waehrend in der
Registry schon 0.4.0 lag. Dieser Eintrag holt den Stand nach; was in den
beiden Fassungen steckt, steht in der Git-Historie.

## 0.2.0

### Minor Changes

- 2aea7b1: `QuizGame` nimmt die Laufzeit vom Gastgeber entgegen (`runtime`-Prop). Ohne
  Angabe verbindet es sich wie bisher als Spieler mit dem ausliefernden Server;
  mit Angabe spielt es gegen jede `QuizRuntime` - insbesondere die
  `LocalQuizRuntime` der Offline-Anwendungen. Dazu neu: `useQuizSnapshot(runtime)`
  abonniert den Stand einer beliebigen Laufzeit, und `useQuizRuntime(null)` baut
  bewusst keine Verbindung auf.

### Patch Changes

- Updated dependencies [2aea7b1]
  - @hfroemmel/quiz-core@0.2.0
  - @hfroemmel/quiz-themes@0.2.0
  - @hfroemmel/quiz-react@0.2.0

## 0.1.0

### Minor Changes

- c00fcd5: Erste Veroeffentlichung der fuenf Quiz-Pakete: Kern (Vertraege, Engine,
  Laufzeit), Inhalts-Pipeline, Themes, React-Buehne und spielbares Quiz.

### Patch Changes

- Updated dependencies [c00fcd5]
  - @hfroemmel/quiz-core@0.1.0
  - @hfroemmel/quiz-themes@0.1.0
  - @hfroemmel/quiz-react@0.1.0
