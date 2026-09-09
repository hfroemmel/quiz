---
"@hfroemmel/quiz-kiosk": patch
---

Die Markentafel des Startbildschirms traegt nur noch Motiv und Titel.

Weg sind die Zeile mit dem Namen der Zielgruppe darueber und der Satz darunter.
Uebrig bleibt das, was aus fuenf Metern wirkt: das Bild und die eine Zeile.

Fuer Gastgeber heisst das: Eine `startDescription` (bzw. `startDescriptions`)
im Inhalt wird auf dem Startbildschirm nicht mehr angezeigt. Das Feld bleibt im
Schema und steht weiterhin als `theme.startDescription` im Ansichtsmodell -
eine Aufstellung, die es gepflegt hat, muss nichts aendern.
