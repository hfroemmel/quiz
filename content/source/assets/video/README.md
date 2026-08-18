# Videodateien

Hier liegen die Videoquellen der Videofragen.

Das mitgelieferte Beispielpaket enthaelt bewusst **keine** Videodatei, weil dem
Repository kein freigegebenes Videomaterial beiliegt. Die Beispielfrage
`a-video-01` ist deshalb auf `"enabled": false` gesetzt und wird nie gespielt.
Die Validierung meldet dafuer eine Warnung, keinen Fehler.

## Videofrage aktivieren

1. Eine vom Browser abspielbare Datei ablegen, z. B. `demo-clip.mp4`
   (H.264/AAC in MP4 oder VP9/Opus in WebM).
2. Falls der Dateiname abweicht, `filename` des Assets `vid-demo-clip` in
   `content/source/assets.json` anpassen.
3. In `content/source/questions.json` bei `a-video-01` `"enabled": true` setzen.
4. `pnpm content:validate && pnpm content:build`.

Ab dann steht die Frage im Pool. Der Operator startet das Video bewusst; waehrend
des Videos ist der Buzzer gesperrt. Nach `Frage einblenden` laeuft der normale
Multiple-Choice-Ablauf.

Faellt eine Videodatei zur Laufzeit aus, meldet der Buehnenclient den Fehler an den
Server. Der Operator sieht eine verstaendliche Meldung und kann die Frage
ueberspringen (`Frage ueberspringen`).
