# Startmenue - Entwurf v1

Die Quelle, aus der der Startbildschirm des Geraets gebaut ist
(`packages/kiosk/src/game/GameStart.tsx`, `Game.module.css`).

- `quiz-standalone-startmenu-v1.svg` - die verbindliche Layoutquelle. Sie
  traegt die Masse in Pixeln auf einer Zeichenflaeche von 1440x810.
- `quiz-standalone-startmenu-v1-preview.png` - dieselbe Datei als Bild, zum
  Danebenhalten.

## Wie die Masse in das Stylesheet kommen

Eine Zahl aus dem Entwurf geteilt durch **8,1** ergibt ihren `vh`-Wert
(810 Pixel Hoehe sind 100 vh). Aus 92 Pixel Kartenhoehe wird so `11.4vh`; die
`clamp()`-Grenzen darum halten das Bild vom 10-Zoll-Tablet bis zum grossen
Touchtisch lesbar. Waagerechte Masse stehen als Anteil derselben Hoehe oder als
`fr`-Verhaeltnis im Raster (535 zu 646 fuer die beiden Spalten).

## Wo die Farben stehen

NICHT hier und nicht im Stylesheet, sondern in
`packages/themes/src/palettes.ts` als `startPalette` (Praefix `--start-`).
Der Entwurf legte sie als `tokens.css` bei; uebernommen sind die Werte der
Masterdatei, weil daraus auch das Vorschaubild gerendert wurde.
`packages/themes/test/palette.test.ts` haelt fest, dass anderswo kein Farbwert
auftaucht.

## Was bewusst abweicht

- **Die Startschaltflaeche heisst "Los geht's"**, nicht "Quiz starten". Der Text
  kommt aus `kiosk.start` und ist uebersetzbar; die Wortwahl gehoert zum
  Bestand, nicht zum Entwurf.
- **Die Fussnote sagt "Die Auswahl gilt fuer dieses Spiel."** und nicht
  "Auswahl kann jederzeit im Menue geaendert werden": Waehrend gespielt wird,
  gibt es kein Menue, in dem sich Modus oder Schwierigkeit verstellen liessen.
- **Die Marke oben links ist die Zielgruppe** aus dem Inhalt ("Erwachsene"),
  nicht der feste Text des Entwurfs.
- **Motiv, Titel und Beschreibungstext der Tafel kommen aus dem Inhalt**
  (`startVisualAssetId`, `startTitle(s)`, `startDescription(s)` der Zielgruppe).
  Bringt der Inhalt kein Motiv mit, traegt die Tafel das mitgelieferte
  `packages/kiosk/src/assets/quiz-mark.svg` aus diesem Entwurf.
- **Die Zahl der Stufen ist nicht drei.** Welche Presets ein Geraet anbietet,
  steht in der Konfiguration; das Raster fuellt sich selbst auf, und die
  Farbfolge der Punkte beginnt nach der dritten Stufe von vorn.
