# Designsystem

Verbindliche visuelle Grundlage fuer Operator-, Buehnen- und Moderatoransicht.
Die Werte stammen aus den siebzehn gelieferten Screendesigns und wurden am
Bildmaterial gemessen, nicht geschaetzt.

## Geltung und Rangfolge

1. **Die Entwicklungsspezifikation gewinnt.** Bei einem Widerspruch zwischen
   Screendesign und Spezifikation gilt die Spezifikation; das Design bestimmt
   dann nur noch das Aussehen, nicht die Funktion.
2. Das Design ergaenzt die Spezifikation um Farben, Raster, Typografie und
   Zustandsdarstellung. Es aendert weder Phasen, Befehle noch Rollenrechte.
3. Was in keinem Screen vorkommt, wird im gezeigten Stil entworfen und in
   [`docs/screens.md`](screens.md) festgeschrieben, bevor es gebaut wird.

## Die zentrale Strukturaussage

Die Operatoransicht ist **kein eigener Bildschirmentwurf**, sondern die
Buehnenausgabe plus Bedienrahmen:

```text
+--------------------------------------------------------------+
| Fensterrahmen des Betriebssystems                            |
+--------------------------------------------------------------+
| [Beenden]        +--------------------------+     [Vollbild] |
|                  |                          |     [Ton]      |
|                  |   BUEHNENFLAECHE 16:9    |                |
|                  |   = exakt das, was der   |                |
|                  |     Beamer zeigt         |                |
|                  +--------------------------+                |
|                                                              |
+--------------------------------------------------------------+
| Private Antwortzeile + [Zuruecksetzen]                       |
| 1. Runde | 2. Spieler ermitteln | 3. Antwort | [Weiter]      |
+--------------------------------------------------------------+
```

Daraus folgen zwei harte Regeln:

- **In der Buehnenflaeche wird ausschliesslich das oeffentliche View-Modell
  gerendert.** Dieselbe Komponente laeuft im Buehnenfenster im Vollbild. Es gibt
  keinen zweiten Renderpfad und damit keine Moeglichkeit, dass die Vorschau
  etwas anderes zeigt als der Beamer.
- **Alles Private liegt ausserhalb der Buehnenflaeche**, also in der unteren
  Bedienleiste. Die Loesung erscheint in der Buehnenflaeche erst in der
  Loesungsszene - unveraendert gegenueber Spezifikation 12.

Die Bedienelemente des Operators, die im Design **innerhalb** der Flaeche liegen
(die `+`/`-`-Tasten neben den Punktekacheln), sind eine Overlay-Schicht ueber der
Vorschau. Sie werden vom Buehnenfenster nicht gerendert.

## Geometrie

Gemessen an den Screens (1728 x 1152 Bildpunkte Vorlage):

| Groesse | Wert | Anteil |
|---|---|---|
| Buehnenflaeche Breite | 1234 px | 71,4 % der Fensterbreite |
| Seitliche Einzuege | je 247 px | 14,3 % - symmetrisch |
| Buehnenflaeche Seitenverhaeltnis | 1234 x 694 | exakt 16:9 |
| Oberkante Buehnenflaeche | 72 px unter dem Fensterrand | 6,4 % der Fensterhoehe |
| Bedienleiste (Spielansicht) | 259 px hoch | 23,2 % der Fensterhoehe |
| Bedienleiste (Startansicht) | 138 px hoch | ohne private Antwortzeile |
| Kopfzeile innerhalb der Flaeche | 70 px hohe Kacheln | 10 % der Flaechenhoehe |

Die Kopfzeile mit Punktekacheln und `Frage x/y` liegt **innerhalb** der
Buehnenflaeche und ist damit oeffentlich - so bestaetigt: der Beamer zeigt
Punktestand und Fragezaehler, aber keine Bedienelemente.

## Skalierung

| Ziel | Seitenverhaeltnis | Verhalten |
|---|---|---|
| Operatorlaptop | 16:10 | Rahmen fuellt das Fenster, Buehnenflaeche bleibt 16:9 und zentriert |
| Beamer | 16:9 | Buehnenflaeche fuellt den Bildschirm vollstaendig |
| Moderator-iPad | frei | eigene, textorientierte Anordnung (siehe `docs/screens.md`) |

Regel: **Die Flaeche wird gefuellt, die Typografie skaliert mit.** Umgesetzt wird
das ueber Container-Queries statt ueber Geraeteabfragen:

```css
.stage { container-type: size; container-name: stage; }
.stage__prompt { font-size: 2.8cqw; }
```

Damit ist die 1234 px breite Vorschau im Operatorfenster pixelgenau dieselbe
Komposition wie die 1920 px breite Beamerausgabe. Es gibt keine zweite
Typografieskala und keine Breakpoints im Buehnenlayout.

Der Bedienrahmen des Operators skaliert **nicht** mit: Beschriftungen und
Schaltflaechen stehen in `rem`, damit sie auf jedem Laptop gleich gross und
sicher treffbar bleiben.

## Farbtokens

Alle Farben sind CSS-Variablen. Kein Bauteil schreibt einen Farbwert direkt.

### Basis (Grundton der Anwendung)

| Token | Wert | Verwendung |
|---|---|---|
| `pageTop` | `#12161A` | Seitenhintergrund oben |
| `pageBottom` | `#171C21` | Seitenhintergrund unten (linearer Verlauf) |
| `stageTop` | `#171C21` | Buehnenflaeche oben |
| `stageBottom` | `#293139` | Buehnenflaeche unten |
| `controls` | `#12161A` | Bedienleiste |
| `tile` | `rgb(255 255 255 / 0.09)` | Kacheln, Buchstabenchips |
| `tileDisabled` | `rgb(255 255 255 / 0.05)` | gesperrte Flaeche |
| `tileQuiet` | `rgb(255 255 255 / 0.06)` | zurueckgenommene Kachel |
| `option` | `rgb(255 255 255 / 0.05)` | Antwortleiste, neutral |

Die Buehnenflaeche laeuft von oben nach unten heller und leicht ins Blaue - ein
kuehler Grund, vor dem das warme Licht der Fragenbilder wirkt.

**Die Flaechenfarben sind halbtransparent.** Das ist kein Detail, sondern der
Kern des Entwurfs: Hinter der Szene liegt das unscharfe Fragebild, und Kacheln,
Buchstaben und Antwortleisten lassen es als Milchglas durchscheinen, statt es
zuzudecken. Ein Token mit deckender Farbe wuerde die Tiefe sofort zerstoeren.

### Unscharfes Fragebild als Hintergrund

Hinter jeder Szene mit Bild liegt dasselbe Bild formatfuellend, stark
weichgezeichnet (`blur(3cqw)`), abgedunkelt (`brightness(0.72)`) und mit einem
Farbschleier aus `stageTop`/`stageBottom` bei 66 % Deckkraft ueberzogen. Jede
Frage bekommt damit ihre eigene Atmosphaere, ohne dass Text an Ruhe verliert.

Doppelt abgedunkelt wird bewusst am Bild UND am Schleier: Die Fragenbilder
reichen von der Nachtaufnahme bis zum wolkenlosen Sommerhimmel, und ein heller
Himmel wuerde die Buehne sonst ins Milchige kippen.

**Waehrend der Bildenthuellung** ist derselbe Hintergrund viel staerker
weichgezeichnet (`blur(9cqw)`, `brightness(0.5)`, Schleier 84 %). Die Aufgabe
ist dort, das Motiv zu erkennen; der Hintergrund darf keine Silhouette verraten -
9 cqw sind auf einem 1920er Beamer rund 170 Pixel Weichzeichnung.

### Radien und Schatten

`--stage-radius` steht bei `0.7cqw` - auf einem 1920 Pixel breiten Beamer rund
13 Pixel. Der Wert steht wie alle Groessen der Buehne in Containereinheiten,
damit die kleine Operatorvorschau und das Vollbild identisch aussehen.

`--stage-shadow` (`0 0.5cqw 1.6cqw rgb(0 0 0 / 0.35)`) liegt unter Bild,
Kacheln und Antwortleisten. Er dient ausschliesslich der raeumlichen Tiefe -
sichtbare Konturen oder Rahmen gibt es auf der Buehne nicht.

Das Cyan ist eine **Bedeutungsfarbe, keine Flaechenfarbe**: Es markiert den
aktiven Spieler, die gewaehlte Antwort, die Rubrik und Statuswechsel wie die
zweite Chance. Grosse Flaechen bleiben im kuehlen Grund.

### Schriftmischung auf der Buehne

Die Serifenschrift traegt Inhalt, die Groteske traegt Beschriftungen:

| Element | Schrift |
|---|---|
| Fragetext, Antworttexte, Kachelwerte, Sekunden, Ergebnis | Melior |
| `Spieler`, `Punkte`, `Frage`, Rubrik | Noto Sans Display |

Die Rubrik steht klein (1,15 cqw), halbfett und in `accent`: ein
Orientierungselement ueber der Frage, keine zweite Ueberschrift.

### Farben der Regieflaeche

Die achtzehn Token oben gehoeren der **Buehne**. Die Bedienoberflaeche des
Operators - und ebenso die Moderatoransicht - hat ein eigenes, festes
Farbsystem, das ein Moduswechsel NICHT umtaucht:

Auch diese Werte stehen in `packages/contracts/src/theme.ts` (`uiPalette`) und
nicht hier:

| Variable | Verwendung |
|---|---|
| `--ui-page` | Seitenhintergrund der Bedienoberflaeche |
| `--ui-surface` | Karten und Leisten: Bedienleiste, privater Bereich, Popups, Startpanel |
| `--ui-surface-quiet` | Kopf- und Fusszeile |
| `--ui-surface-raised` | aufgehellte Flaeche innerhalb einer Karte |
| `--ui-control` | Schaltflaechen, Icontasten |
| `--ui-control-disabled` | gesperrte Icontaste |
| `--ui-input` | Eingabefelder |
| `--ui-border` | Raender und Trennlinien |
| `--ui-border-quiet` | Trennlinie innerhalb einer Karte |
| `--ui-border-strong` | Kante eines Feldes, das sich absetzen soll |
| `--ui-scrim`, `--ui-scrim-quiet` | Flaeche hinter einem Popup, Grund einer Vorschaukachel |
| `--ui-text` | Text |
| `--ui-text-muted` | Beschriftungen, Nebeninformation |
| `--ui-accent` | primaere Handlung, richtige Antwort im privaten Bereich, Auswahlring |
| `--ui-correct` | `Antwort war richtig`, Markierung der richtigen Option |
| `--ui-incorrect` | `Antwort war falsch`, Warnungen |
| `--ui-warning-soft`, `--ui-error-soft` | hinterlegte Meldungen im Verbindungsband |

Der Grund fuer die Trennung ist praktisch, nicht gestalterisch: Der Saal soll die
Farbe des Quizmodus sehen, der Operator dagegen immer dieselbe Flaeche - er
findet seine Tasten sonst bei jedem Moduswechsel neu. Die dunkle Regieflaeche
laesst ausserdem die Buehnenvorschau als einziges helles Feld heraussstechen.

Die Variablen stehen am Wurzelelement und werden von `themeVariables` nicht
beruehrt; das setzt ausschliesslich `--color-*`. Ein Bauteil der Buehne greift nie
auf `--ui-*` zu und umgekehrt.

### Rollenfarben

Die Bedeutungsfarben stammen aus dem **Farbspektrum des Bundes**. Ausgewaehlt
wurde je Token der Ton mit dem kleinsten Abstand zur zuvor gesetzten Farbe
(CIELAB), damit die Buehne ihr Bild behaelt und trotzdem amtliche Werte traegt.
Die dunkle Fassung nimmt die Aufhellungen der Abstufungsreihe - der reine Ton
saeuft auf dunklem Grund ab -, die helle Fassung dieselben Farben bei 100 Prozent.

Die Werte stehen **nicht hier**, sondern in `packages/contracts/src/theme.ts`.
Eine Abschrift in dieser Datei wuerde beim naechsten Farbwechsel veralten, ohne
dass es jemandem auffiel.

| Token | CI-Farbe | Bedeutung |
|---|---|---|
| `accent` | Blau | aktiver Spieler, gewaehlte Antwort, Rubrik, Statuswechsel |
| `accentQuiet` | Petrol, abgedunkelt | dieselbe Bedeutung, aber abgeschlossen bzw. nicht mehr bedienbar |
| `primary` | Gruen | genau eine primaere Handlung je Bildschirm |
| `solution` | Gruen | Loesungsbalken in der Loesungsszene |
| `solutionChip` | Dunkelgruen | Buchstabenchip im Loesungsbalken |
| `correct` | Tuerkis | Kreis der Richtig-Rueckmeldung |
| `incorrect` | Rot, abgedunkelt | Kreis der Falsch-Rueckmeldung |
| `text` | - | Text auf allen dunklen Flaechen |
| `textMuted` | - | Kachelbeschriftungen, gesperrte Schaltflaechen |

`--accent-quiet` ist die wichtigste Erfindung des Designs: Sie zeigt
"das war die Auswahl" an, ohne noch zur Bedienung einzuladen. Sie erscheint an
der Spielertaste nach dem Buzzern und an der Antworttaste nach dem Aufloesen.

### Zustandsmatrix der Schaltflaechen

| Zustand | Flaeche | Text | Auftritt |
|---|---|---|---|
| bedienbar | `--surface-tile` | `--text` | Standard |
| gesperrt | `--surface-tile-disabled` | `--text-muted` | Befehl nicht in `allowedCommands` |
| gewaehlt, aktiv | `--accent` | `--text` | eingeloggte Antwort vor dem Aufloesen |
| gewaehlt, abgeschlossen | `--accent-quiet` | `--text` | nach dem Aufloesen, Buzzerzuordnung |
| primaer | `--primary` | `--text` | genau eine Taste je Zustand |

Die Zustaende werden **nicht** im Bauteil entschieden, sondern aus
`allowedCommands` und dem View-Modell abgeleitet (Spezifikation 10.4). Das Design
liefert die Darstellung, der Server die Wahrheit.

## Wo die Farben stehen

**In genau einer Datei: `packages/contracts/src/theme.ts`.** Dort stehen die
beiden Gestaltungswelten, die helle Fassung, die wenigen Farben, die keiner Welt
gehoeren, und der Bedienrahmen des Operators. Anderswo steht kein Farbwert;
`apps/web/test/palette.test.ts` prueft das bei jedem Testlauf.

Von dort aus laufen zwei Wege:

```text
theme.ts ──> pnpm content:build ──> content/dist/config.json ──> Server ──> Buehne
         └─> pnpm palette:build ──> apps/web/src/styles/palette.css
```

Das Quizpaket ist der Weg fuer den Betrieb: Der Server liefert die Farben des
aktiven Modus mit jedem Snapshot, und `themeVariables` schreibt sie als
Inline-Variablen auf den **Rahmen** um die Buehne. `palette.css` ist der zweite
Weg - die Rueckfallebene am Wurzelelement, bis der erste Snapshot da ist, und die
helle Fassung, die am Buehnenelement selbst stehen muss.

**Merksatz zur Kaskade:** Ein geerbter Inline-Wert schlaegt eine `:root`-Regel.
Wer eine Buehnenfarbe im Stylesheet aendert, aendert deshalb nichts - im Betrieb
gewinnt immer das Quizpaket. Nur eine Regel, die am Buehnenelement selbst haengt
(`.stage--default.stage--bright`), sticht den geerbten Wert.

Ein Theme in `config.json` nennt nur **Abweichungen** von seiner Gestaltungswelt:

```jsonc
{ "id": "senioren", "label": "Senioren", "colors": { "accent": "#e8b84b" } }
```

Beim Bauen wird daraus der vollstaendige Satz; das Paket bleibt allein lesbar.
Ein neuer Modus braucht damit **keine Codeaenderung** - genau wie in
`docs/neue-modi-und-presets.md` beschrieben.

Die Tokenliste steht neben den Werten und gilt an drei Stellen zugleich: Das
Quizpaket liefert die Werte, die Inhaltsvalidierung prueft die Vollstaendigkeit
(eine leer gelassene Farbe ist ein **Fehler**), und die Oberflaeche macht daraus
CSS-Variablen. Zusammengesetzte Werte wie der Flaechenverlauf werden bewusst erst
an der Verwendungsstelle gebildet - eine Variable, die ihre Farben schon am
Wurzelelement aufloest, wuerde spaetere Theme-Werte ignorieren.

Drei Namensraeume, drei Zustaendigkeiten:

| Praefix | Wem gehoert die Farbe | Beispiel |
|---|---|---|
| `--color-*` | dem Quizmodus - wechselt mit dem Theme | `--color-accent` |
| `--stage-*` | der Lage, nicht dem Thema - in jedem Modus gleich | `--stage-inkOnStrong` |
| `--ui-*` | dem Bedienrahmen - bleibt dunkel, egal welcher Modus laeuft | `--ui-surface` |

Die drei Modi der Startansicht (`Kinder`, `Erwachsene`, `Saarbruecken`) kommen aus
`catalog.modes`. Das Layout ist auf drei Eintraege ausgelegt; mehr Eintraege
laufen in eine zweite Zeile, statt die Leiste zu stauchen.

## Zwei Gestaltungswelten, zwei Fassungen

Es gibt genau **zwei Gestaltungswelten** (`theme.skin`):

| Welt | Klasse an der Buehne | Wer sie nutzt |
|---|---|---|
| `default` | `.stage--default` | Erwachsene und Saarbruecken |
| `kids` | `.stage--kids` | Kinder |

Beide teilen sich **dasselbe Markup**. Der einzige Unterschied ist die Klasse an
der Buehnenflaeche; jedes Bauteil bringt beide Welten in seinem eigenen CSS-Modul
mit (`:global(.stage--default)` / `:global(.stage--kids)`). Modusabhaengige
Komponenten oder Klassennamen gibt es nicht - `Score`, nicht `KidsScore`.

Die Welt `default` hat zusaetzlich **zwei Fassungen**:

| Fassung | Klasse | Wirkung |
|---|---|---|
| dunkel | `.stage--dark` | die Werte des Quizmodus, unveraendert |
| hell | `.stage--bright` | dieselben achtzehn Token in einer hellen Tafel |

Die Fassung aendert **ausschliesslich Farben, Transparenzen, Konturen und
Schatten**. Schriften, Bauteile, Positionen und Abstaende sind in beiden
identisch. Sie ist eine Ansichtssache des Bedienenden - sie steht im
`localStorage`, nicht im Snapshot, und der Server weiss nichts davon. Umgeschaltet
wird im Kopf der Operatoransicht, links neben dem Vollbildschalter; im
Kindermodus entfaellt der Schalter, weil diese Welt ihr eigenes Papier mitbringt.

**Warum die Themewerte am Rahmen stehen und nicht an der Buehne:** `themeVariables`
liefert die achtzehn Token als Inline-Stil, und ein Inline-Stil schlaegt jede
Klassenregel. Stuenden sie an der Buehne selbst, koennte `.stage--bright` seine
Farben nicht mehr setzen. Vom umgebenden Rahmen aus werden sie geerbt - und eine
Angabe am Element sticht jeden geerbten Wert.

## Typografie

Das Design verwendet durchgehend eine **Serifenschrift** - fuer Fragen,
Antworten, Kachelwerte und Schaltflaechen gleichermassen. Es gibt keine zweite
Schriftfamilie; Hierarchie entsteht ausschliesslich ueber Groesse, Gewicht und
Farbe.

| Rolle | Groesse | Einheit | Beispiel |
|---|---|---|---|
| Startbildtitel | 3,8 | cqw | `Bundestags-Quiz` |
| Rueckmeldung | 3,8 | cqw | `Richtig!` |
| Ergebnistitel | 2,8 | cqw | `Spieler 1 hat gewonnen!` |
| Fragetext | 2,8 | cqw | Fragestellung |
| Punktwert in der Kachel | 2,6 | cqw | `100` |
| Antworttext | 1,9 | cqw | Optionsleiste |
| Rubrik ueber der Frage | 1,7 | cqw, fett | `Saarbruecken` |
| Kachelbeschriftung | 1,0 | cqw | `Spieler`, `Punkte`, `Frage` |
| Bedienleiste | 1,0 | rem | Schaltflaechen und Gruppentitel |

### Gelieferte Schriften

| Familie | Dateien | Einsatz |
|---|---|---|
| **Melior** | `MeliorCom.ttf`, `-Bold`, `-Italic`, `-BoldItalic` | die Buehne: Rubrik, Frage, Antworten, Kachelwerte, Ueberschriften |
| **Noto Sans Display** | `-Regular`, `-SemiBold`, `-Bold` (+ weitere Schnitte im Bestand) | der Bedienrahmen des Operators und die Moderatoransicht |

Melior ist die Serifenschrift des Entwurfs. Noto Sans Display traegt die kleinen
Beschriftungen im Bedienrahmen, wo auf kurze Distanz gelesen wird - auf dem
Beamer erscheint sie nie. Wer eine einzige Familie ueberall moechte, aendert dafuer
genau eine Zeile: `--font-ui` in `apps/web/src/styles.css`.

Eingebunden wird lokal ueber `@font-face` mit `font-display: block` - niemals ueber
ein Netzwerk-CDN, weil die Anwendung offline lauffaehig bleiben muss
(Spezifikation 2). `block` statt `swap`, weil ein Schriftwechsel mitten in der
Show sichtbarer waere als ein kurzer Moment ohne Text.

Die Buehnenschrift steht zusaetzlich im Quizpaket (`theme.typography`): Ein Modus
kann damit eine eigene Schrift bekommen, ohne Codeaenderung.

Beschriftungen in der Oberflaeche verwenden **echte Umlaute** - und zwar
ueberall, wo Text den Nutzer erreicht: Tastenbeschriftungen, Ueberschriften,
Hinweise, Ablehnungsgruende des Servers und Protokolleintraege. Die Quelltexte
sind UTF-8; die ASCII-Schreibweise bleibt ausschliesslich in Kommentaren und in
dieser Dokumentation erhalten.

## Formen und Abstaende

| Token | Wert |
|---|---|
| `--radius-tile` | 6 px bei 1728 px Referenzbreite (0,35 % der Breite) |
| `--radius-option` | 6 px |
| `--radius-circle` | 50 % |
| `--gap-tight` | 4 px - zwischen `+` und `-` |
| `--gap-group` | 12 px - zwischen Schaltflaechen einer Gruppe |
| `--gap-section` | 28 px - zwischen den nummerierten Gruppen |

Es gibt im gesamten Entwurf **keine Schatten, keine Rahmen und keine
Transparenzflaechen**. Abgrenzung entsteht allein ueber Helligkeit.

## Symbole

| Symbol | Ort | Form |
|---|---|---|
| Vollbild | oben rechts | vier Eckwinkel, Strichstaerke 2 px, weiss |
| Ton aus | oben rechts darunter | Lautsprecher mit Schraegstrich |
| Haken | Richtig-Rueckmeldung | gelieferte Bewegtgrafik `correct.webm` |
| Kreuz | Falsch-Rueckmeldung | gelieferte Bewegtgrafik `wrong.webm` |

Das in den Vorlagen fehlende Kreuz ist damit geklaert: Es ist Bestandteil der
gelieferten Falsch-Grafik.

Vollbild und Ton werden als Inline-SVG mit `currentColor` gezeichnet. Es gibt
keine Icon-Schriftart und keine externen Symboldateien.

## Gelieferte Grafiken

| Datei | Ort im Projekt | Verwendung |
|---|---|---|
| `quiz-adults.svg` | `content/source/assets/branding/start-adults.svg` | Startbild Erwachsene: Adler bei 8 % Deckkraft, darueber das `?`. Der Titel ist Text der Anwendung, nicht Teil der Grafik |
| `quiz-kids.png` | `content/source/assets/branding/start-kids.png` | Startbild Kinder, 1024 x 828, randfuellend |
| `correct.webm`, `wrong.webm`, `trophy.webm`, `stars.webm`, `question-marks.webm` | `apps/web/src/assets/animations/` | Bewegtgrafiken, VP9 mit Alphakanal, 500 x 500, 30 fps, ohne Ton |
| `confetti.svg` | `apps/web/src/assets/animations/` | animiertes SVG fuer die Ergebnisansicht |

Die Startbilder sind Inhalt des Quizpakets und werden ueber
`mode.startVisualAssetId` zugeordnet - ein neuer Modus braucht dafuer keine
Codeaenderung. Die Bewegtgrafiken gehoeren zur Praesentationsschicht und sind in
`apps/web/src/presentation/animationAssets.ts` mit Laenge und Zeitpunkt der
vollstaendigen Aussage registriert.

**Offene Zulieferung:** Startbild fuer den Modus `Saarbruecken`; bis dahin bleibt
die Platzhaltergrafik im Bestand.

## Barrierefreiheit und Buehnentauglichkeit

- Kontrast: weisser Text auf `#444444` erreicht 8,9:1, auf `--primary` 2,4:1.
  Deshalb steht auf gruenen Flaechen ausschliesslich kurzer, fetter Text.
- Die Rueckmeldung `Richtig`/`Falsch` ist nie allein farbcodiert: Kreisfarbe,
  Symbol und Wort tragen dieselbe Aussage.
- `prefers-reduced-motion` schaltet jede Animation auf den im Katalog
  hinterlegten Kurzwert; die fachlichen Zeiten aendern sich dadurch nicht.

## Bauteilinventar

Die Umsetzung folgt drei Ebenen. Eine Ebene darf nur die darunterliegende
benutzen - das haelt die Oberflaeche frei von Sonderfaellen.

```text
Ebene 1  Global          styles/palette.css, tokens.css, base.css, controls.css,
                         motion.css, stage.css - bewusst keine Module
Ebene 2  Bauteile        presentation/stage/* und ui/*, je ein *.module.css
Ebene 3  Bereiche        StageScreen (+ Szenen), OperatorApp, ModeratorApp,
                         PreviewApp, je ein *.module.css
```

Nur sechs Stylesheets sind global, und jedes aus einem Grund:

| Datei | Warum global |
|---|---|
| `palette.css` | ERZEUGT aus `packages/contracts/src/theme.ts` - alle Farbwerte |
| `tokens.css` | Masse, Schriften und Dauern am Wurzelelement |
| `base.css` | Schriften, Reset, Grundtypografie |
| `controls.css` | `.button` und `.field` - jede Ansicht darf sie benutzen |
| `motion.css` | das Uebergangsregistry setzt Klassennamen als Zeichenkette |
| `stage.css` | `.stage--default` / `.stage--kids` / `.stage--bright` - der Schalter, auf den alle Bauteilmodule ueber `:global(...)` zugreifen |

| Bauteil | Aufgabe | Varianten |
|---|---|---|
| `Score` | Punktekarte eines Spielers | `header`, `result`, gespiegelt |
| `Counter` | Fragenzaehler | - |
| `QuestionComposition` | Anordnung von Bild, Frage und Antworten | untereinander, Portraet nebeneinander |
| `QuestionHead` | Medium und Fragetafel | mit und ohne Bild |
| `Media` | Bildrahmen, beim Bilderkennen mit Kacheldecke | `inline`, `reveal`, `solution`, `portrait` |
| `RevealTiles` | Kacheldecke des Bilderkennens | - |
| `AnswerList` | Antwortzeilen mit Buchstabenchip | `idle`, `selected`, `correct`, `incorrect`, `disabled` |
| `SecondChanceHint` | Hinweis auf die zweite Chance | - |
| `Mascot` | Figurenebene | nur in der Kinderwelt sichtbar |
| `ProgressRing` | Enthuellungsring mit Sekundenzahl | laufend, pausiert |

Jedes Bauteil kennt nur Tokens und seine eigenen Varianten. Kein Bauteil liest
das View-Modell, keines sendet Befehle, und keines kennt den Namen eines Modus.
Damit ist jede visuelle Aenderung eine Aenderung an genau einer Datei.

**Testhaken:** Klassennamen sind gehasht und taugen nicht als Selektor. Die
Bauteile tragen dafuer stabile Datenattribute (`data-answer`, `data-panel`,
`data-score`, `data-counter`, `data-media`, `data-prompt` ...); der Zustand einer
Antwortzeile steht in `data-state`.

## Anordnung nach Fragetyp

Frage- und Loesungsszene bauen ihre Inhalte nicht selbst zusammen, sondern
uebergeben sie an `QuestionComposition`. Nur dieses Bauteil kennt den Unterschied
zwischen den Anordnungen; beide Szenen bleiben dadurch gleich aufgebaut.

| Typ | Anordnung |
|---|---|
| `text-choice` | Rubrik und Frage ueber die volle Breite, Antworten darunter |
| `image-choice` | Bild links, Rubrik und Frage daneben, Antworten darunter |
| `person` | Portraet gross links, Rubrik, Frage und Antworten rechts daneben |

Die Buehne traegt den Typ als `data-presentation`. Bauteile, die sich in einer
Anordnung anders verhalten muessen - der linksbuendige Antworttext der
Portraetfrage etwa - haengen ihre Regel an dieses Attribut, statt eine eigene
Variante zu bekommen.

Beim Portraet haengen die Masse an der **Hoehe** der Buehne (`cqh`), nicht wie
sonst an ihrer Breite: Bild und Antwortspalte sollen gleich weit nach unten
reichen, und das Bild darf auf einer flachen Buehne nicht unten herausragen.
