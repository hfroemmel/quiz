---
"@hfroemmel/quiz-themes": minor
"@hfroemmel/quiz-kiosk": minor
---

Die Startauswahl steht jetzt in derselben Fassung wie die Buehne danach.

**SIE KONNTE ES NICHT.** `.stage--bright` steht an der Buehne, und die entsteht
erst mit dem Spiel - Startauswahl, Einstellungen und Rueckfragen liegen
darueber. Sie waren deshalb immer dunkel, auch seit die Buehne im Zweifel hell
ist: dunkles Menue, helles Spiel. Die Fassung steht jetzt als `data-theme` am
Wurzelelement von `QuizGame`, und `palette.css` haengt die hellen
`--start-*`-Farben daran (`[data-quiz-game][data-theme='bright']`). Ein
Datenattribut und keine Klasse, weil dieses Stylesheet erzeugt wird und die
Klassen der Bauteile gehasht sind.

**Neu in der Palette: `brightStartPalette`** - und darin steht kein eigener
Farbwert, wo es schon einen gibt. Papier, Tinte, das Blau der markierten
Antwort, das Gruen des Knopfes, der aufloest: alles Verweise auf
`brightPalette`. Eigene Werte hat nur, was die Buehne nicht kennt - das
Milchglas der Karten und ihre Haarlinien. Und nur was ABWEICHT steht darin; der
Rest kommt weiter aus `startPalette`.

**DIE AUSWAHL IST NICHT DIE HANDLUNG.** Beide waren dasselbe Gruen, und im
Dunkeln faellt das nicht auf. Auf Papier schon: Dort traegt die Auswahl das Blau
der markierten Antwort, und Gruen gehoert allein dem Knopf, der das Spiel
startet. Dafuer gibt es jetzt einen eigenen Satz Namen - `--start-selected`,
`--start-selected-bright`, `--start-ink-on-selected`,
`--start-meta-on-selected` - mit denselben Werten wie vorher, damit sich in der
dunklen Fassung nichts aendert. Dazu getrennt: `--start-ink-on-green` ist die
Aufschrift auf dem Startknopf (hell in beiden Fassungen),
`--start-ink-on-badge` das Zeichen auf der gefuellten Auswahlmarke.

Die beiden Lichter im Grund heissen nach ihrem PLATZ statt nach ihrer Farbe
(`ambient-left`/`ambient-right`): In der hellen Fassung sind sie abgeschaltet,
denn dort grenzt die Kante der Karte sie ab und nicht der Grund.

Aufbau, Positionen, Groessen, Texte und die Skalierung sind unveraendert; die
Kinderwelt bleibt ihre eigene Welt und meldet sich als `data-theme="kids"`.
