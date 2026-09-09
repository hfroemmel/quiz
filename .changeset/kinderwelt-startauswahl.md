---
"@hfroemmel/quiz-core": minor
"@hfroemmel/quiz-react": minor
"@hfroemmel/quiz-kiosk": minor
---

Die Startauswahl gehoert jetzt auch in der Kinderwelt zum Kinderquiz.

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
