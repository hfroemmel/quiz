# Kinderquiz: illustrierte Spieleransicht

Umsetzung der Karlchen-Adler-Welt mit dem Boxen-Assetpaket: die Flaechen sind
die ORIGINALPFADE des Entwurfs (aus `Boxes.svg` geschnitten) und skalieren per
9-Slice, die Figuren und die Hintergrundszene liegen als Vektor bzw. WebP bei.
Diese Datei ist die Referenz fuer Aufbau, Zustaende und Abnahme dieser Ansicht.

## 1. Bestandsaufnahme vor der Umsetzung

| Frage | Befund |
|---|---|
| Wer rendert die Spieleransicht? | `StageApp` → `StageScreen` → Szenenkomponenten unter `presentation/scenes/`. Eine eigene Kinderansicht gab es nicht; die Modi unterschieden sich nur in den Farbtoken. |
| Woher kommen Frage, Antworten, Bild, Kategorie, Spieler, Punkte, Fragezaehler? | Ausschliesslich aus `PublicQuizViewModel`: `question.prompt`, `question.categoryLabel`, `question.imageUrl`, `visibleOptions[]`, `playerScores[]`, `progress`. |
| Welche Zustaende existieren? | `PublicOption.state` mit `chosen`, `correct`, `chosen-incorrect`; dazu die Szene (`question`, `solution`, …) und die Phase. |
| Was ist wiederverwendbar? | `optionLetter` (A–D), das View-Modell, die Uebergangs- und Klanglogik von `StageScreen`. Die dunklen Primitive (`OptionBar`, `Tile`, `MediaFrame`) nicht - sie tragen eine andere Bildsprache. |
| Wo stehen Themes, Fonts, Styles, Assetpfade? | Farben im Quizpaket (`content/source/config.json`), Schriften und Layout in `apps/web/src/styles.css`, Medien ueber `/media/<assetId>` vom Server. |
| Welche Viewports? | Der Buehnenscreen ist ein Container (`container-type: size`); alle Groessen stehen in `cqw`/`cqh`. Getestet werden 16:9 und 16:10. |
| Welche Tests? | Vitest fuer Domain, Inhalt, Persistenz und Server; Playwright mit den Projekten `live` (echter Server) und `preview` (serverfreie Szenenvorschau, mit Screenshot-Baselines). |

## 2. Auswahl der Gestaltungswelt

Die Welt haengt am **Theme**, nicht am Modusnamen:

```jsonc
// content/source/config.json
{ "id": "kids", "skin": "kids", "colors": { … } }
```

`quizThemeSchema.skin` (`stage` | `kids`) wird ueber das View-Modell an die
Buehne durchgereicht. `StageScreen` liest `view.theme.skin` - im Client steht
nirgends ein Modusname. Ein weiterer Modus bekommt die Kinderwelt damit ohne
Codeaenderung.

## 3. Dateien

```text
apps/web/public/assets/kinderquiz/     Assetpaket (boxes/, characters/, fonts/)
apps/web/src/styles/kids.css           Farben, Layout, Zustaende, Breakpoints
apps/web/src/presentation/kids/
├── kidsAssets.ts                      einzige Stelle mit Assetpfaden
├── answerVisualState.ts               einzige Ableitung des Antwortzustands
├── KidsSurface.tsx                    gezeichnete Flaeche hinter beliebigem Inhalt
├── KidsQuizScreen.tsx                 Komposition, Szenenabdeckung
├── QuizHeader.tsx                     Wortmarke, Spielerkarten, Fragenzaehler
├── QuestionStage.tsx                  Fragebild, Fragepanel, Karlchen
└── AnswerList.tsx                     Antwortzeilen (eine Komponente fuer alle vier)
```

## 4. Ebenen

| Ebene | Inhalt | Verhalten |
|---|---|---|
| 1 | `karlchen-quiz-scene-16x9.webp` | `cover`, rechts zentriert, dekorativ |
| 2 | Wortmarke, Karten, Frage, Foto, Antworten | echte DOM-Inhalte |
| 3 | Karlchen (gross und klein) | `pointer-events: none`, ohne Alternativtext |
| 4 | gezeichnete SVG-Flaechen | Pseudoelement `::before`, 9-Slice via `border-image` |
| 5 | `paper-grain.svg` | Overlay ueber Karten UND Figuren, abschaltbar |

Zum 9-Slice: Handgezeichnete Ecken duerfen nicht verzerrt werden. Jede Box wird
deshalb nach dem Muster des Pakets (`boxes.css`) in neun Felder zerlegt - Ecken
bleiben unverzerrt, Kanten und Mitte strecken sich. Der Slice-Wert je Element
stammt aus `boxes.json` (Prop `slice` von `KidsSurface`), die Randbreite setzt
die Komponentenklasse in `cqw`: Bei 1920 Containerbreite entspricht sie genau
dem Quellwert. Drei Dateien sind abgeleitet, weil der Entwurf sie nicht
enthaelt (der Weg steht im README des Pakets): `answer-box-correct`
(Papier -> Gruen), `answer-box-incorrect` (Rot -> gedecktes Rot) und das lila
Feld in `chip-score-player2`.

Das Fragefoto traegt einen inhaltlichen Alternativtext, alle dekorativen Bilder
einen leeren.

## 5a. Aufbau einer Antwortzeile

Chip und Karte sind **zwei getrennte Zeichnungen** mit einer sichtbaren Luecke
(`clamp(10px, .9cqw, 18px)`):

```text
li.kids-answer                Raster, ohne eigene Zeichnung
├── span.kids-answer__chip    quadratische Chipzeichnung, feste Spalte
└── span.kids-answer__surface breite Kartenzeichnung
    └── span.kids-answer__text
```

Die breite Karte liegt nie auf der Zeile - sonst saesse der Buchstabe mit auf
ihr, und genau daran war die erste Fassung als Standard-UI zu erkennen.

## 5. Zustaende der Antworten

Abgeleitet wird an genau einer Stelle: `answerVisualState`.

| Serverzustand | Darstellung | Flaeche | Chip |
|---|---|---|---|
| `state = 'chosen'` | `selected` | `answer-box-b` (rot) | `badge-letter-b` (gelb) |
| Loesungsszene, `state = 'correct'` | `correct` | `answer-box-correct` (gruen) | Papier-Badge der Zeile |
| Loesungsszene, alles uebrige | `disabled` | Papier-Box der Zeile, 55 % Deckkraft | Papier-Badge der Zeile |
| `state = 'chosen-incorrect'` | `incorrect` | `answer-box-incorrect` (gedecktes Rot) | Papier-Badge der Zeile |
| sonst | `idle` | Papier-Box der Zeile | Papier-Badge der Zeile |

„Der Zeile": Im Entwurf hat jede Antwortzeile ihre eigene Zeichnung (a bis d,
verschieden wackelnd); Zeile B liegt nur rot vor und nutzt im Ruhezustand eine
Nachbarzeichnung. Die Zuordnung steht in `kidsAssets.answerSurface`.

Zur Loesungsszene: Dort traegt **ausschliesslich die richtige Antwort** Farbe -
dieselbe Regel wie auf der dunklen Buehne. `chosen-incorrect` bedeutet ausserhalb
der Loesung „diese Antwort ist in der zweiten Chance verbraucht"; dafuer ist die
Flaeche `answer-incorrect` gedacht.

## 6. Layout

- Raster und Anteile der Designreferenz: Bild 27 %, Frage der Rest, Karlchen 25 %.
- Zwischen Fragebild und Frageflaeche steht eine sichtbare Fuge von
  `clamp(16px, 1.4cqw, 28px)`; beide beruehren sich nie.
- Antwortzeilen und Loesungszeile enden bei 75 % der Breite, damit die
  Figurenflaeche frei bleibt.
- Karlchen steht am unteren rechten Rand der **ganzen Ansicht**, nicht in der
  Fragezeile - so steht er wie in der Referenz auf dem Boden. Er ist rund halb
  so hoch wie die Ansicht (`clamp(240px, 51cqh, 560px)`) und praesentiert mit
  dem ausgestreckten Fluegel nach links zu den Antworten.
- Der kleine Karlchen schaut mittig ueber die obere Bildkante; seine Unterkante
  steckt 8 bis 13 Pixel hinter der Rahmenzeichnung, damit die Haende auf dem
  Rand aufzuliegen scheinen.
- Ohne Fragebild uebernimmt die Frageflaeche die Bildspalte
  (`.kids-stage--textonly`). Die Reihenfolge Bild → Frage → Antworten aendert
  sich nie.

### Wer gibt nach

Die Fragezeile ist der nachgiebige Teil: Sie waechst in den freien Platz, damit
die Komposition wie in der Referenz die ganze Hoehe traegt, und gibt ihn wieder
her, sobald vier zweizeilige Antworten mehr Raum brauchen. Die Antwortzeilen
geben nichts her - sie sind der Inhalt, um den es geht.

### Masseinheiten

Das Assetpaket nennt seine Werte in `vw`/`vh` und meint den Buehnenscreen im
Vollbild. Umgesetzt sind sie in `cqw`/`cqh`: Bei Vollbild ist das derselbe Wert,
und zusaetzlich stimmt die Komposition in der kleinen Operatorvorschau. Kein Wert
wird doppelt gepflegt.

### Schmalere Ansichten

| Breite | Verhalten |
|---|---|
| ab 1100 px | Referenzkomposition vollstaendig |
| unter 1100 px | Antworten auf 88 % Breite, Karlchen kleiner, Frageflaeche breiter |
| unter 768 px | Entwickler- und Operatorvorschau: Inhalte scrollen, Karlchen wird zur schwachen Dekoration; nichts wird entfernt |

## 7. Schriften

**Patrick Hand** (400) traegt alles Gelesene: Frage, Antworten, Kategorie und
Beschriftungen. **Melior** (700) traegt die Zahlen (Spielernummer,
Punktestaende, Fragenzaehler) und die Buchstaben A–D - dieselbe Serife wie auf
der grossen Buehne, dort muessen Ziffern beim Hochzaehlen ruhig stehen
(`tabular-nums`).

Die Handschrift kommt aus dem Assetpaket und liegt unter
`apps/web/public/assets/kinderquiz/fonts/`. Sie wird bewusst nicht gebuendelt:
Nur so behaelt sie eine feste Adresse, die `apps/web/index.html` vorladen kann.
`font-display: block` verhindert, dass auf der Buehne kurz eine Systemschrift zu
sehen ist; der Rueckfall ist eine Schreibschrift, keine System-Sans. Melior ist
im regulaeren Schriftbestand gebuendelt (`apps/web/src/styles.css`).

Es gibt **keine gerechnete Fettschrift**: Patrick Hand hat genau einen Schnitt
(400), Melior liegt als echter Bold-Schnitt vor.

## 8. Abnahme

`test/e2e/kids-quiz.spec.ts` prueft im Projekt `preview`:

- Wortmarke, beide Spielerkarten, Zaehler, Bild, Frage, vier Antworten
- gespiegelte Spielerkarten, genau ein aktiver Spieler
- dreistellige Punktestaende, Zaehler `7/7`, Tabellenziffern
- Zustandsabbildung `idle` / `selected` / `incorrect` / `correct` / `disabled`
  samt zugehoeriger Flaechen- und Chipdatei
- kein CSS-Rahmen, kein CSS-Radius, kein gerechneter Schatten an Karten,
  Chips, Antworten, Bild, Spielerkarten und Zaehler
- Chip und Antwortkarte als getrennte Flaechen mit sichtbarer Luecke
- Patrick Hand fuer Text, Melior fuer Zahlen und Buchstaben, beide wirklich geladen
- sichtbare Fuge zwischen Fragebild und Frageflaeche
- Karlchen 42 bis 52 Prozent der Bildhoehe, rechts, am Boden, ohne die
  Antworten zu beruehren; kleiner Karlchen mittig ueber dem Bildrahmen
- lange Texte in allen vier Zielformaten: kein Abschneiden, mehrzeilige Frage,
  zweizeilige Antworten, Chip in fester Groesse und mittig
- Rueckfall ohne Fragebild
- `prefers-reduced-motion`
- Screenshots bei 1920×1080, 1440×900, 1280×720 und 1024×768

Fuer die Belastungsprobe hat die Entwicklungsvorschau den Schalter
**Lange Texte**; er setzt die Testtexte aus `ASSET_INTEGRATION.md` ein.

## 9. Offene Punkte

1. **Nur Frage und Loesung sind gestaltet.** Pausenscreen, Rueckmeldung,
   Enthuellung, Video, Start und Ergebnis behalten ihre gemeinsame Komposition
   und stehen auf dem illustrierten Grund mit Papierfarben. Das Boxen-Paket
   enthaelt fuer diese Szenen keine Vorlagen.
2. **Ein einziger Radius bleibt**: der Beschnitt des Fragefotos
   (`.kids-media__image`). Er ist aus der Innenkontur von `media-frame.svg`
   abgelesen und verhindert, dass rechtwinklige Fotoecken aus der gerundeten
   Innenform der Zeichnung herausstehen (Assetpaket, Abschnitt 10). Alle
   gezeichneten Bauteile sind radienfrei.
3. **Die Wortmarke** ist das bereits im Projekt vorhandene freigegebene Asset
   (`apps/web/src/assets/images/logo.svg`), nicht die Zeichnung aus dem Paket.
4. **Der Kindermodus hat noch keine eigenen Startgrafiken.** Startbild und
   Pausenlogo kommen weiterhin aus der Konfiguration.
