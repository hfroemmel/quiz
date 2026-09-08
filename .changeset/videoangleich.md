---
"@hfroemmel/quiz-react": patch
---

Das Videobild flackerte, sobald zwei Fenster nebeneinander liefen.

Der Client glich die Position des Videoelements bei JEDEM Schnappschuss an die
Serverposition an. Die fuehrt der Server mit der Wanduhr, eine Wiedergabe haelt
da nie exakt mit - und jeder Ausgleichssprung setzte den Dekoder zurueck, was
Zeit kostete, was die naechste Abweichung erzeugte. Mit zwei Fenstern um
denselben Dekoder wurde daraus ein sichtbares Flackern.

Angeglichen wird jetzt nur noch, wenn dabei nichts zu zerstoeren ist: wenn das
Element steht - der Fall eines Fensters, das mitten im Video dazukommt - oder
wenn die Serverposition zurueckgeht, was nur ein Neustart tut. Ein Vorlauf des
Servers bleibt unbeantwortet; die Frage kommt ohnehin zur Serverzeit.

Dazu zwei kleinere Korrekturen an derselben Stelle: Die gemessene Laufzeit wird
nur gemeldet, wenn der Server sie noch nicht kennt - jede Meldung ist ein
Befehl, der gespeichert und an alle verteilt wird, und zwei Fenster messen
dieselbe Datei. Und ein Element, das am Ende steht, wird nicht mehr gestartet:
`play()` spulte dort von selbst zurueck und spielte das Video ein zweites Mal.
