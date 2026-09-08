---
"@hfroemmel/quiz-core": patch
"@hfroemmel/quiz-content": patch
"@hfroemmel/quiz-themes": patch
"@hfroemmel/quiz-react": patch
"@hfroemmel/quiz-kiosk": patch
---

Die Wortmarke oben links blieb im GEBAUTEN Paket ein weisser Balken. Sie ist
eine Maske ueber einer Farbflaeche; der Bundler bettet die Grafik als
`data:`-Adresse ein und schreibt deren Attribute mit Hochkommata
(`width='339.417'`). In einem unquotierten `url()` ist das ein ungueltiges
Zeichen - die Regel fiel stillschweigend aus, und die nackte Flaeche blieb
stehen. In der Entwicklung fiel es nicht auf, weil dort eine Dateiadresse
steht.

Adressen in Inline-Stilen laufen jetzt durch `cssUrl()`, das sie in
Anfuehrungszeichen setzt - auch das Fragebild im Hintergrund.
