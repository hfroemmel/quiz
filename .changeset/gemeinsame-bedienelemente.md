---
"@hfroemmel/quiz-core": minor
"@hfroemmel/quiz-content": minor
"@hfroemmel/quiz-themes": minor
"@hfroemmel/quiz-react": minor
"@hfroemmel/quiz-kiosk": minor
---

Die Bedienelemente des Operatorpults sind jetzt die gemeinsame Fassung fuer
alle Anwendungen: `@hfroemmel/quiz-themes/controls.css`. Startauswahl,
Einstellungen und Rueckfragen des Kiosks tragen dieselben Klassen (`button`,
`button--primary`, `button--large`, `button--selected`) und damit dieselbe
Flaeche, Kante, Schrift und Rueckmeldung beim Druecken. Am Geraet bleibt allein
die Groesse eine andere - ein Pult wird mit der Maus bedient, ein Foyergeraet
mit dem Daumen.

Die Rundung steht in `--ui-radius` (Vorgabe 6px), die Farben wie bisher in den
`--ui-*`-Token der Palette. Wer die Bedienelemente nutzt, importiert das
Stylesheet neben `palette.css`:

    import '@hfroemmel/quiz-themes/palette.css'
    import '@hfroemmel/quiz-themes/controls.css'

Die Buehne bleibt unberuehrt: Antwortzeilen, Buzzer und Punktekarten gehoeren
zur Vorstellung und tragen weiter deren Farben und Containereinheiten.
