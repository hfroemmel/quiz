---
"@hfroemmel/quiz-kiosk": patch
---

Das Rueckfallmotiv der Starttafel ist wieder da.

`packages/kiosk/src/assets/quiz-mark.svg` war geloescht, die Adresse in
`GameStart.tsx` blieb stehen. Der Build meldete das als Warnung und lieferte die
Adresse unaufgeloest aus - eine Aufstellung ohne eigenes Startbild bekam damit
kein Bild. Dazu drei Reste ohne Verwendung: das Funkenzeichen, die
Schrittnummern-Hilfe und die Regeln der entfernten Tafelzeile.
