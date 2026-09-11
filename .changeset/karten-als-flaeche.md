---
'@hfroemmel/quiz-core': patch
'@hfroemmel/quiz-content': patch
'@hfroemmel/quiz-themes': patch
'@hfroemmel/quiz-react': patch
'@hfroemmel/quiz-kiosk': patch
---

Die Auswahlkarten der hellen Startauswahl sind Flaechen, keine Rahmen

Eine gewaehlte Karte steht jetzt voll in demselben Blau, das im Spiel eine
angetippte Antwort traegt - derselbe Wert aus derselben Palette; Titel, Zeile,
Zeichen und Haekchen darauf in Weiss. Eine offene Karte ist das ruhige Grau
einer nicht angetippten Antwort. Keine Kante, in keinem Zustand: Die
Tastaturmarke ist ein weicher Schein und ein Hauch Groesse statt eines Rings,
sodass sich Auswahl und Fokus nicht mehr zu zwei Linien uebereinanderlegen.
Der sekundaere Knopf traegt dieselbe gefuellte Flaeche, der gruene Startknopf
bleibt, wie er war.

Neue Token: `--start-option`, `--start-option-hover` und `--start-option-icon`.
Die Auswahlkarten hatten keinen eigenen Namen und hiessen `surface` wie das
Einstellungsfenster und die Rueckfrage; in der hellen Fassung gehen sie
getrennte Wege.

Dunkle Fassung und Kinderwelt sind unveraendert - nachgemessen, Pixel fuer
Pixel. Im Dunkeln behaelt die Karte ihre Kante: Dort liegt ein fast schwarzer
Kasten auf fast schwarzem Grund, und ohne Kante schwaemmen die Karten.
