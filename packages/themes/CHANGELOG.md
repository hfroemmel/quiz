# @hfroemmel/quiz-themes

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
  - @hfroemmel/quiz-core@0.9.0

## 0.8.0

### Patch Changes

- Updated dependencies [bc9579a]
  - @hfroemmel/quiz-core@0.8.0

## 0.7.1

### Patch Changes

- @hfroemmel/quiz-core@0.7.1

## 0.7.0

### Minor Changes

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

- Updated dependencies
  - @hfroemmel/quiz-core@0.7.0

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

## 0.1.0

### Minor Changes

- c00fcd5: Erste Veroeffentlichung der fuenf Quiz-Pakete: Kern (Vertraege, Engine,
  Laufzeit), Inhalts-Pipeline, Themes, React-Buehne und spielbares Quiz.

### Patch Changes

- Updated dependencies [c00fcd5]
  - @hfroemmel/quiz-core@0.1.0
