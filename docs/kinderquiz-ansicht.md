# Kinderquiz: illustrierte Spieleransicht

Umsetzung des Assetpakets „Kinderquiz – Web Asset Pack" (Karlchen-Adler-Welt).
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
apps/web/public/assets/kinderquiz/     Assetpaket, unveraendert
apps/web/src/assets/fonts/             Fredoka und Nunito als WOFF2
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
| 4 | gezeichnete SVG-Flaechen | Pseudoelement `::before` hinter dem Inhalt |
| 5 | `paper-grain.svg` | Overlay, abschaltbar ueber `<html class="no-grain">` |

Das Fragefoto traegt einen inhaltlichen Alternativtext, alle dekorativen Bilder
einen leeren.

## 5. Zustaende der Antworten

Abgeleitet wird an genau einer Stelle: `answerVisualState`.

| Serverzustand | Darstellung | Flaeche | Chip |
|---|---|---|---|
| `state = 'chosen'` | `selected` | `answer-selected` (rot) | `answer-active` (gelb) |
| Loesungsszene, `state = 'correct'` | `correct` | `answer-correct` | `answer-correct` |
| Loesungsszene, alles uebrige | `disabled` | `answer-default`, 55 % Deckkraft | `answer-neutral` |
| `state = 'chosen-incorrect'` | `incorrect` | `answer-incorrect` | `answer-incorrect` |
| sonst | `idle` | `answer-default` | `answer-neutral` |

Zur Loesungsszene: Dort traegt **ausschliesslich die richtige Antwort** Farbe -
dieselbe Regel wie auf der dunklen Buehne. `chosen-incorrect` bedeutet ausserhalb
der Loesung „diese Antwort ist in der zweiten Chance verbraucht"; dafuer ist die
Flaeche `answer-incorrect` gedacht.

## 6. Layout

- Raster und Anteile der Designreferenz: Bild 27 %, Frage 46 %, Karlchen 25 %.
- Antwortzeilen und Loesungszeile enden bei 75 % der Breite, damit die
  Figurenflaeche frei bleibt.
- Karlchen steht am unteren rechten Rand der **ganzen Ansicht**, nicht in der
  Fragezeile - so steht er wie in der Referenz auf dem Boden.
- Ohne Fragebild uebernimmt die Frageflaeche die Bildspalte
  (`.kids-stage--textonly`). Die Reihenfolge Bild → Frage → Antworten aendert
  sich nie.

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

Fredoka traegt Frage, Punktestaende, Fragenzaehler und die Buchstaben A–D;
Nunito die Antworten, Kategorien und Beschriftungen. Beide liegen als lokale
WOFF2-Dateien (Latin und Latin Extended) im Projekt - der Betrieb ist offline,
ein Font-CDN kommt nicht in Frage. Beide Familien stehen unter der SIL Open Font
License. Punktestaende und Fragenzaehler nutzen `tabular-nums`, damit die
Zahlen beim Hochzaehlen nicht springen.

## 8. Abnahme

`test/e2e/kids-quiz.spec.ts` prueft im Projekt `preview`:

- Wortmarke, beide Spielerkarten, Zaehler, Bild, Frage, vier Antworten
- gespiegelte Spielerkarten, genau ein aktiver Spieler
- dreistellige Punktestaende, Zaehler `7/7`, Tabellenziffern
- Zustandsabbildung `idle` / `selected` / `incorrect` / `correct` / `disabled`
  samt zugehoeriger Flaechen- und Chipdatei
- kein CSS-Rahmen an Karten, Antworten, Bild, Spielerkarten und Zaehler
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
   und stehen auf dem illustrierten Grund mit Papierfarben. Das Assetpaket
   enthaelt fuer diese Szenen keine Vorlagen; `generic-contour-9slice.svg` liegt
   fuer spaetere Karten bereit.
2. **Karlchen-Figuren sind freigestellte PNGs** aus den Illustrationsreferenzen.
   Liegen offizielle transparente Originaldateien vor, ersetzen sie die Dateien
   unter `characters/` ohne Layoutaenderung.
3. **Die Wortmarke** ist das bereits im Projekt vorhandene freigegebene Asset
   (`apps/web/src/assets/images/logo.svg`), nicht die Zeichnung aus dem Paket.
4. **Der Kindermodus hat noch keine eigenen Startgrafiken.** Startbild und
   Pausenlogo kommen weiterhin aus der Konfiguration.
