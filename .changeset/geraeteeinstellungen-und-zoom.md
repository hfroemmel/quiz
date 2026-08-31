---
"@hfroemmel/quiz-core": minor
"@hfroemmel/quiz-content": minor
"@hfroemmel/quiz-themes": minor
"@hfroemmel/quiz-react": minor
"@hfroemmel/quiz-kiosk": minor
---

Einstellungen am Geraet: Der Startbildschirm von `QuizGame` bekommt ein
Zahnrad, dahinter Ton an/aus, eine Tonprobe und die Anzeigegroesse. Es
erscheint nur dort, wo der Gastgeber seine eigene Laufzeit mitbringt - haengt
das Quiz an einem Server, gehoert der Ton der Vorstellung.

Neue Props `soundEnabled` und `zoom` reichen die Vorgaben eines Config Files
durch. `zoom` liegt zwischen 0,6 und 1; 1 ist die entworfene Groesse und damit
das Maximum. Kleinere Werte verkleinern die Szene zur Mitte hin, waehrend Logo,
Punktekarten und Fragezaehler am Bildrand bleiben und mitschrumpfen. Die Stufe
steht als `--stage-zoom` ueber der Buehne.

`SET_SOUND_ENABLED` greift jetzt auch, wenn kein Spiel laeuft: Der Ton gehoert
dem Geraet, und am Kiosk sitzt der Schalter im Startbildschirm.

Im laufenden Spiel steht oben rechts "Spiel beenden" mit einer Rueckfrage; er
fuehrt zurueck in die Auswahl und erscheint nur, wenn der Serverstand
`ABORT_GAME` erlaubt.

Die Kopfzeile zeigt das Logo aus dem Inhalt (`themes[].logoAssetId`), wenn eines
konfiguriert ist, und behaelt sonst die mitgelieferte Wortmarke. Am Touchgeraet
hat sie mehr Luft nach oben.

Die Startauswahl bekommt runde Ecken, vertikal mittig gesetzte Beschriftungen
und groessere Zweitzeilen.
