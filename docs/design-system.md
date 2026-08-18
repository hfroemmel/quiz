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
| `--surface-page-top` | `#555555` | Seitenhintergrund oben |
| `--surface-page-bottom` | `#6E6E6E` | Seitenhintergrund unten (linearer Verlauf) |
| `--surface-stage-top` | `#5C5C5C` | Buehnenflaeche oben |
| `--surface-stage-bottom` | `#757575` | Buehnenflaeche unten |
| `--surface-controls` | `#555555` | Bedienleiste |
| `--surface-tile` | `#444444` | Kacheln, Schaltflaechen, Buchstabenchips |
| `--surface-tile-disabled` | `#4F4F4F` | gesperrte Schaltflaeche |
| `--surface-tile-quiet` | `#464646` | `Beenden` |
| `--surface-option` | `#777777` | Antwortleiste, neutral |

Der Verlauf laeuft in beiden Flaechen von oben nach unten heller. Die
Buehnenflaeche ist minimal heller als die Seite - dadurch hebt sie sich ohne
Rahmen und ohne Schatten ab.

### Rollenfarben

| Token | Wert | Bedeutung |
|---|---|---|
| `--accent` | `#3693B3` | aktiver Spieler, aktuell gewaehlte Antwort, aktive Auswahl |
| `--accent-quiet` | `#4E6A74` | dieselbe Bedeutung, aber abgeschlossen bzw. nicht mehr bedienbar |
| `--primary` | `#00CC9C` | genau eine primaere Handlung je Bildschirm |
| `--solution` | `#01A780` | Loesungsbalken in der Loesungsszene |
| `--solution-chip` | `#028365` | Buchstabenchip im Loesungsbalken |
| `--correct` | `#25A7B0` | Kreis der Richtig-Rueckmeldung |
| `--incorrect` | `#A62749` | Kreis der Falsch-Rueckmeldung |
| `--text` | `#FFFFFF` | Text auf allen dunklen Flaechen |
| `--text-muted` | `rgb(255 255 255 / 0.45)` | Kachelbeschriftungen, gesperrte Schaltflaechen |

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

## Themes je Modus

Bestaetigt: jeder Quizmodus bringt ein **komplettes Farbsystem** mit, nicht nur
eine Akzentfarbe. Das vorhandene `themes`-Feld in `content/source/config.json`
traegt deshalb ab sofort den vollstaendigen Tokensatz:

```jsonc
{
  "id": "adults",
  "label": "Erwachsene",
  "colors": {
    "pageTop": "#555555", "pageBottom": "#6E6E6E",
    "stageTop": "#5C5C5C", "stageBottom": "#757575",
    "controls": "#555555", "tile": "#444444", "tileDisabled": "#4F4F4F",
    "tileQuiet": "#464646", "option": "#777777",
    "accent": "#3693B3", "accentQuiet": "#4E6A74",
    "primary": "#00CC9C", "solution": "#01A780", "solutionChip": "#028365",
    "correct": "#25A7B0", "incorrect": "#A62749",
    "text": "#FFFFFF", "textMuted": "rgb(255 255 255 / 0.45)"
  }
}
```

Der Client setzt daraus die CSS-Variablen auf dem Wurzelelement der
Buehnenflaeche. Ein neuer Modus braucht damit **keine Codeaenderung**, sondern nur
einen Eintrag im Quizpaket - genau wie in `docs/neue-modi-und-presets.md`
beschrieben.

Die drei Modi der Startansicht (`Kinder`, `Erwachsene`, `Saarbruecken`) kommen aus
`catalog.modes`. Das Layout ist auf drei Eintraege ausgelegt; mehr Eintraege
laufen in eine zweite Zeile, statt die Leiste zu stauchen.

**Offene Zulieferung:** Die Farbsysteme fuer `Kinder` und `Saarbruecken` liegen
noch nicht vor. Bis dahin erben beide Modi die Werte von `Erwachsene`; nur der
Startbildschirm unterscheidet sich bereits (Kindermaskottchen auf `#C9284F`).

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

**Offene Zulieferung:** Die Schriftdateien (`woff2`) samt Name und Lizenz werden
geliefert. Bis dahin laeuft die Anwendung auf der Ersatzkette
`'Iowan Old Style', 'Palatino Linotype', 'Times New Roman', Georgia, serif`.
Eingebunden wird die Schrift lokal ueber `@font-face` mit `font-display: block` -
niemals ueber ein Netzwerk-CDN, weil die Anwendung offline lauffaehig bleiben
muss (Spezifikation 2).

Beschriftungen in der Oberflaeche verwenden ab sofort **echte Umlaute**
(`Aufloesen` wird zu `Auflösen`, `Zuruecksetzen` zu `Zurücksetzen`). Die
Quelltexte sind UTF-8; die ASCII-Schreibweise bleibt nur in Kommentaren und
Dokumentation erhalten.

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
Ebene 1  Tokens          styles/tokens.css, themeToCssVariables()
Ebene 2  Primitive       Tile, ActionButton, OptionBar, CircleBadge, ProgressRing,
                         SectionLabel, MediaFrame
Ebene 3  Bereiche        StageHeader, StageScreen (+ Szenen), OperatorChrome,
                         ControlBar, PrivateAnswerPanel
```

| Primitiv | Aufgabe | Varianten |
|---|---|---|
| `Tile` | Kachel mit kleiner Beschriftung und grossem Wert | `player`, `score`, `progress`, `result` |
| `ActionButton` | Schaltflaeche der Bedienleiste | `default`, `primary`, `quiet`, plus Zustand aus der Matrix |
| `OptionBar` | Antwortzeile mit Buchstabenchip | `neutral`, `chosen`, `solution`, `chipless` |
| `CircleBadge` | Kreis mit Symbol | `correct`, `incorrect` |
| `ProgressRing` | Enthuellungsring mit Sekundenzahl | `running`, `paused`, `completed` |
| `MediaFrame` | Bildrahmen mit Bildnachweis und Schaerfegrad | `inline`, `reveal`, `solution` |

Jedes Primitiv kennt nur Tokens und seine eigenen Varianten. Kein Primitiv liest
das View-Modell, kein Primitiv sendet Befehle. Damit ist jede visuelle Aenderung
eine Aenderung an genau einer Datei.
