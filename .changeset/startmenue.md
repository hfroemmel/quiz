---
"@hfroemmel/quiz-core": minor
"@hfroemmel/quiz-react": minor
"@hfroemmel/quiz-themes": minor
"@hfroemmel/quiz-kiosk": minor
---

Der Startbildschirm des Geraets nach dem Entwurf `Startmenue v1`
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
  `kiosk.setupSubtitle`, `kiosk.soloHint`, `kiosk.duoHint`, `kiosk.setupNote`).
- `quiz-kiosk`: neuer Aufbau der Startauswahl, Einstellungen und Rueckfragen in
  derselben Formensprache, das Quizmotiv des Entwurfs als mitgeliefertes
  Rueckfallbild.

An Geraeten mit nur einer Spielerzahl - dem Kiosk - entfaellt der Modusschritt,
und die Schwierigkeit traegt die 01. Untereinander stehen beide Spalten, sobald
die Breite fehlt.

Aendert sich fuer Gastgeber: Die Startauswahl setzt nicht mehr die globalen
`button`-Klassen. Sie werden weiterhin mit `@hfroemmel/quiz-kiosk/styles.css`
ausgeliefert - fuer die Umgebung, die der Gastgeber selbst baut.
