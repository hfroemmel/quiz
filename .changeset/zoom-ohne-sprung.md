---
"@hfroemmel/quiz-core": patch
"@hfroemmel/quiz-content": patch
"@hfroemmel/quiz-themes": patch
"@hfroemmel/quiz-react": patch
"@hfroemmel/quiz-kiosk": patch
---

Die Zoomstufe steht jetzt in der eigenen CSS-Eigenschaft `scale` statt in
`transform`. Auf der Szene liegen die Szenenuebergaenge, und die animieren
`transform`: Als Transformation geschrieben wurde die Stufe davon
ueberschrieben - eine Frage erschien in voller Groesse und sprang am Ende der
Animation klein.

Ausserdem folgen jetzt auch Startauswahl, Einstellungen, Rueckfrage,
Abschlussleiste und der Beenden-Knopf der Zoomstufe. Sie ist eine Einstellung
des Geraets, nicht eine des laufenden Spiels.
