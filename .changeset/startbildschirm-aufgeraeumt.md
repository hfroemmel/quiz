---
"@hfroemmel/quiz-react": patch
"@hfroemmel/quiz-kiosk": patch
---

Der Startbildschirm und zwei Buehnenbauteile ohne ihre Zierteile.

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
