---
'@hfroemmel/quiz-core': minor
'@hfroemmel/quiz-content': minor
'@hfroemmel/quiz-themes': minor
'@hfroemmel/quiz-react': minor
'@hfroemmel/quiz-kiosk': minor
---

Die Breite ist das einzige Mass der Buehne

Alle Groessen der Buehne und des Touchgeraets rechnen ab jetzt gegen die
BREITE der Flaeche und gegen nichts sonst: `cqw` in der Buehne, `vw` in der
Startauswahl davor. `clamp()`, `cqh` und `vh` sind verschwunden, ebenso die
Schwelle `max-aspect-ratio` und die Ausnahme fuer flache Fenster - alles drei
liessen die HOEHE mitentscheiden.

Bezugsbreite ist 1440 px, die Zeichenflaeche der Entwuerfe (1440x810): Auf
16:9 ist die Darstellung dieselbe wie vorher, Zahl fuer Zahl. Auf einer
hoeheren Flaeche - 4:3-Bildschirm, Fenster eines Gastgebers, Einzelspiel ohne
Buzzer - bleibt jetzt Luft, statt dass die Komposition sich streckt. Am
Touchgeraet liegt sie gleichmaessig ueber und unter der Szene.

Sichtbare Folge fuer Gastgeber: In einem Kasten, der hoeher als 16:9 ist,
steht das Quiz kleiner als bisher und nutzt die Hoehe nicht aus. Dafuer zeigen
zwei Geraete gleicher Breite dieselbe Frage in derselben Groesse.
