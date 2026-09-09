---
"@hfroemmel/quiz-react": minor
"@hfroemmel/quiz-kiosk": minor
---

Ein Knopfsystem fuer die ganze Buehne - und eine eigene Flaeche fuer den
Gastgeber darin.

**Die Schaltflaechen der Buehne kommen jetzt aus einer Quelle.** `Weiter`,
`Antwort abgeben und aufloesen` und der Buzzer waren drei Knoepfe aus zwei
Dateien mit drei Groessen; nebeneinander sah das aus wie drei Systeme. Kasten,
Hoehe, Rundung, Typografie und die Zustaende (gedrueckt, gesperrt, Tastaturfokus)
stehen jetzt als Token und als globale Klasse `stage-button` in
`@hfroemmel/quiz-react/styles/stage.css`, dazu `stage-button--primary` fuer die
Handlungsfarbe. Was einen Knopf ausmacht, sagt er weiterhin selbst - der Buzzer
seine Spielerfarbe, seine Groesse und seine Versalien -, und zwar ueber die
Token statt ueber ueberschriebene Regeln. Die Regeln der Klasse stehen in
`:where(...)` und haben damit kein Gewicht: Ein Bauteil, das sie benutzt, gewinnt
immer, unabhaengig von der Reihenfolge der Stylesheets.

Sichtbar aendert sich dabei eins: Die Aufschrift der Knoepfe in der Fussleiste
ist kleiner (`--stage-button-size`, 1,5 cqw statt 2 cqw). `Antwort abgeben und
aufloesen` ist der laengste Satz der Buehne und drueckte die Mitte der Leiste
auseinander. Flaeche und Trefferfeld bleiben unveraendert - der Knopf fuellt
weiterhin das ganze Hinweisfeld.

**Der Gastgeber kann eine eigene Ebene IN die Buehne setzen** - `pads.overlay`
an `QuizScene`/`StageScreen`, `overlay` an `QuizGame`. Sie wird ueber Szene,
Fussleiste und Koernung gerendert, aber innerhalb der Buehnenflaeche: Nur dort
gelten deren Farben, deren Containereinheiten und vor allem deren Zoomstufe.
Daneben behielte so eine Ebene ihre volle Groesse, waehrend alles darunter
kleiner wird. Gedacht ist sie fuer Schritte, die ein Gastgeber zwischen zwei
Fragen einschiebt; mit `stage-button` sieht sein Knopf darin aus wie der der
Buehne.

**Im Einzelspiel gibt es keinen Buzzerklang mehr.** Es gibt dort auch keinen
Buzzer: Der erste Fingertipp auf eine Antwort holt sich den Zuschlag selbst, und
die Buehne quittierte diesen einen Tipp mit zwei Klaengen uebereinander - dem
Auswahlton und dem Buzzer. Der Buzzer meldet, dass jemand einem anderen
zuvorgekommen ist, und niemand ist da. Im Duell bleibt er unveraendert. Die
Entscheidung steht als reine Funktion (`klaengeFuer`) und ist damit geprueft.
