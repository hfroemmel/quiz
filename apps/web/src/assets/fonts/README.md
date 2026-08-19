# Schriftdateien

Hier liegen die Schriftdateien der Oberflaeche. Sie werden ueber `@font-face` in
`apps/web/src/styles.css` eingebunden und von Vite mitgebaut - **nie** ueber ein
Netzwerk-CDN, weil die Anwendung offline lauffaehig bleiben muss
(Spezifikation 2).

## Erwartet wird

| Datei | Schnitt | Verwendung |
|---|---|---|
| `<name>-regular.woff2` | 400 | Fragetext, Antworten, Kachelwerte |
| `<name>-bold.woff2` | 700 | Rubrik ueber der Frage, Buchstabenchips |

Zwei Schnitte genuegen: Das Designsystem erzeugt Hierarchie ueber Groesse und
Farbe, nicht ueber weitere Schriftstaerken.

Zusaetzlich gebraucht werden Name und Lizenz der Schrift - beides gehoert in
diese Datei, damit spaeter nachvollziehbar bleibt, was ausgeliefert werden darf.

## Solange nichts hier liegt

Die Oberflaeche laeuft auf der Systemserifen-Kette aus
`apps/web/src/theme/designTokens.ts`. Der Austausch ist danach ein
`@font-face`-Block und ein geaenderter erster Familienname - kein Umbau.
