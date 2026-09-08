---
"@hfroemmel/quiz-kiosk": patch
---

Startauswahl, Einstellungen und Rueckfragen setzen ihre Schaltflaechen jetzt in
EINER Schriftgroesse.

Der hervorgehobene Knopf war auch groesser gesetzt als die Knoepfe daneben -
"Los geht's" groesser als "Allein", "Fertig" groesser als "An". Damit wurde aus
einer Reihe gleichrangiger Ziele eine Treppe. Hervorgehoben ist der eine durch
Farbe und Flaeche; seine Schrift muss dafuer nicht auch noch groesser sein.

Die Groesse steht als `--kiosk-button-font-size` an der Startflaeche und an der
Dialogkarte und damit an einer Stelle. Die beiden Eckknoepfe - Sprache und
Zahnrad - bleiben davon unberuehrt: Sie stehen nicht in der Reihe, sondern am
Rand.
