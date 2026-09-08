---
"@hfroemmel/quiz-core": patch
"@hfroemmel/quiz-content": patch
"@hfroemmel/quiz-themes": patch
"@hfroemmel/quiz-react": patch
"@hfroemmel/quiz-kiosk": patch
---

Die Videophase lief in eine Schleife: Bild flackerte, das Video kam nie zum
Abspielen, und der Uebergang zur Frage wurde nie faellig.

Der Buehnenclient haengt seinen Szenenknoten an die Kennung des letzten
Uebergangs. Der Zeitgeber fuer das Videoende trug diese Kennung mit - jede
Laufzeitmeldung erzeugte damit eine neue, React baute die Szene samt
Videoelement neu auf, das frische Element meldete seine Laufzeit, und der Kreis
begann von vorn. Mit zwei Fenstern, die dasselbe Video zeigen, schaukelten sich
beide gegenseitig hoch.

Behoben an drei Stellen:

- Zeitgeber und Praesentationsuebergang sind getrennt. `scheduleTimedTransition`
  kennt jetzt eine stille Fassung: Beim Video animiert nichts, und seine
  Laufzeit ist keine Animationsdauer.
- Eine Statusmeldung plant das Ende nur noch, wenn keines steht. Die Laufzeit
  meldet jeder Client, der das Video zeigt; nur ein Befehl - Starten,
  Fortsetzen, Zuruecksetzen - plant neu.
- `PAUSE_VIDEO` nimmt den geplanten Uebergang zurueck. Sonst zeigte der Saal die
  Frage, waehrend der Operator gerade angehalten hatte, um etwas zu sagen.
