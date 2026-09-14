# Operator quick reference for live operation

## Before the event

1. `pnpm content:validate` - no errors, warnings read deliberately.
2. `pnpm content:build` - note the package version.
3. Start the application (`pnpm dev:desktop` or `pnpm server` plus browser).
4. Connect the projector, move the presentation window to the second display,
   press `Bühne Vollbild` (stage fullscreen).
5. Test the buzzer: key `A` = player 1, key `B` = player 2.
6. Test sound (`Ton an` (sound on) in the header).
7. If a host is present: read the session code from "Technik, Protokoll und
   Verbindung" (technology, protocol, and connection) and enter it on the
   iPad.

## One game

| Step | Action |
|---|---|
| 1 | Choose quiz mode and difficulty preset |
| 2 | `Spiel starten` (start game) |
| 3 | The question is shown - the host reads it aloud |
| 4 | `Antworten einblenden` (show answers) or `Enthüllung starten` (start reveal) - only now may buzzing happen |
| 5 | Player buzzes - or `… manuell auswählen` (select manually), if the hardware is stuck |
| 6 | Log the stated answer (click the letter, or `Antwort war richtig/falsch` (answer was correct/incorrect)) |
| 7 | `Auflösen und bewerten` (resolve and score) |
| 8 | `Weiter zur nächsten Frage` (continue to the next question) |
| 9 | After the seventh question: `Weiter zum Ergebnis` (continue to the result) |
| 10 | `Zurück zur Startansicht` (back to the start screen) for the next pair of games |

How many games have already run in which mode is shown behind the
`Spielprotokoll` (game log) button at the bottom right of the footer. The
numbers live in the database and therefore survive a restart.

The private area to the right of the stage area always shows the correct
answer and additional information. The audience sees none of it.

## Scoring

* First correct answer: **100**
* Correct second chance: **50**
* Image recognition after at least one failed attempt: **50**
* Wrong, pass, resolve without an answer: **0** - never a deduction
* Manual correction: `+50` / `−50` in the header, also on the results screen.
  The score never drops below zero; every correction is logged.

## Image recognition

* The image starts fully covered; it only uncovers after `Enthüllung
  starten` (start reveal). So the read-aloud time costs no time at all.
* The reveal then runs for ten seconds.
* A valid buzz freezes the image immediately.
* After a wrong answer, the reveal continues from the same point, and
  **both** players may buzz again - any number of times.
* Buzzing remains allowed even after the image is fully revealed. The ten
  seconds are a reveal duration, not an answer time limit.
* `Bild vollständig aufdecken` (fully reveal image) reveals immediately and
  does **not** lock the buzzer.
* `Enthüllung auf Anfang zurücksetzen` (reset reveal to the start) is a
  technical correction and deliberately different from `zurücksetzen`
  (reset).

## Video questions

There is **one** button: `Video starten` (start video). It plays the video
on the stage from the beginning. There is no pause or seek - if something
goes wrong, just press `Video starten` again; it then starts again from
zero. The buzzer is locked during the video phase. Playback happens only on
the stage; the desk area stays empty so the composition remains legible.

**The desk shows no video status** - not ready, not playing, not finished.
That is intentional: none of it is needed. Looking at the audience says it
better than any indicator.

Nothing happens automatically at the end; the last frame stays on screen
until `Frage einblenden` (show question) is pressed, then `Antworten
einblenden` (show answers).

If the area stays black, the file is the problem on the stage computer.
Options: press `Video starten` again, continue without the video via `Frage
einblenden`, or `Frage überspringen` (skip question).

## When something goes wrong

| Situation | What to do |
|---|---|
| Wrong player got the buzz | `zurücksetzen` (reset), then release again |
| Buzzer does not respond | use `… manuell auswählen` (select manually) - same rules |
| Question is factually wrong | `Fehlerhafte Frage korrigieren` (correct faulty question) → `Frage überspringen` (skip question) |
| Question should be removed for the rest of the evening | `Frage deaktivieren` (disable question) there |
| Typo in the question text | correct the text there; "Jetzt übernehmen" (apply now) only while the question is currently visible |
| Presentation window is gone | reopen it - the game keeps running, the snapshot arrives immediately |
| Host iPad is gone | ignore it - single-laptop operation is fully self-sufficient |
| Application was restarted | the start screen offers "Resume game"; a running reveal comes back paused |
| Message "The game state has changed" | the view is already up to date, just repeat the action |
| Message about saving | take no further action, check the save location, inform the team |

## After the event

* `Änderungsbericht exportieren` (export change report) in the diagnostics
  area - lists every live hotfix with question ID, field, old and new value,
  timestamp, reason, and base version.
* Back up `runtime/` if the history should be preserved.
* On the next event day, start either automatically (new calendar day) or
  deliberately via "Start new event day".

## Keyboard

| Key | Effect |
|---|---|
| `A` | Buzzer player 1 (operator window only) |
| `B` | Buzzer player 2 (operator window only) |
| `F` | Toggle fullscreen (in the stage window) |
| Double-click | Toggle fullscreen (in the stage window) |
