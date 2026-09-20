# Screens: State by State

This file translates the seventeen screen designs into states of the state
machine and pins down the states for which no template exists. It is the
reference for implementation and acceptance.

All color tokens are defined in [`docs/design-system.md`](design-system.md),
all transitions in [`docs/animationskatalog.md`](animationskatalog.md).

## Mapping of the Templates

| Template | Phase | Scene | Notable feature |
|---|---|---|---|
| 9 | `idle` | `start` | Start screen for adults, mode and difficulty selection |
| 17 | `idle` | `start` | Start screen for kids, mascot edge-to-edge |
| 8 | `question-presented` | `question` | Image and question visible, options still hidden |
| 13 | `question-presented` | `question` | pure text question, category and question span the full width |
| 16 | `buzzer-open` | `question` | Options visible, both players can act |
| 7 | `answer-locked` | `question` | Player 1 has buzzed in, answer choice open |
| 15 | `answer-locked` | `question` | Answer B logged in, publicly blue, `Auflösen` ("Resolve") primary |
| 14 | `attempt-feedback` | `feedback` | Correct, text multiple-choice question |
| 2 | `attempt-feedback` | `feedback` | Correct, spoken-answer question |
| 6 | `attempt-feedback` | `feedback` | Incorrect - symbol missing, to be added |
| 5 | `solution` | `solution` | Solution with letter chip |
| 10 | `solution` | `solution` | Solution without chip (free-form answer) |
| 12 | `reveal-running` | `reveal` | Reveal at the start, image almost fully covered |
| 4 | `reveal-running` | `reveal` | Reveal shortly before the end |
| 3, 11 | `reveal-paused` or end of the reveal | `reveal` | Image fully open |
| 1 | `result` | `result` | Confetti, result tiles, `Spiel beenden` ("End game") |

Not included in the templates and therefore designed below: `pause-screen`,
`second-chance`, `aborted`, connection loss, resumption after restart,
moderator view.

## Shared Frame

### Ground and Atmosphere

The stage sits on its own ground and shows nothing behind the scene. The
question image used to be repeated there - filling the format, heavily blurred
and veiled - as the atmosphere of each question, and more heavily still during
an image reveal, so that no silhouette gave the motif away. That layer is
gone; what a question brings is shown where it is content: framed in the
scene.

Tiles, letter fields, and answer rows are semi-transparent surfaces over that
ground - no blur, no border, with a very soft shadow for spatial depth. The
values are in [`docs/design-system.md`](design-system.md).

### Wordmark

The wordmark (`apps/web/src/assets/images/logo.svg`) sits top left, mirrored
by the question counter top right. It is drawn as a CSS mask over a color
surface and thus always carries `--text` of the active mode - there is no
second, white version of the file. It is omitted on the start screen, where
the start graphic carries the branding instead.

### Header Bar (Public, Inside the Stage Area)

```text
[+][-] [Spieler|1][Punkte|100]   [Punkte|100][Spieler|2] [+][-]     [Frage|3/7]
```

- The two player groups are **mirrored**: for player 1, the player tile sits
  on the outer left; for player 2, on the outer right. The score tiles sit on
  the inside and meet in the middle.
- The `Spieler` ("Player") tile turns `--accent` as soon as that player is
  up.
- `Frage x/y` ("Question x/y") sits on the right and disappears in `start`
  and `result`.
- `+`/`-` belong to the operator and sit as an overlay over the preview.
  They do not appear on the projector. They are square. They keep their
  position even when the tiles next to them are hidden (result view).
- The `+`/`-` step size is `scoringRules.manualAdjustmentStep` - currently 50
  points.

### Control Bar (Operator Only)

Two rows:

1. **Private answer row.** Small label
   `Richtige Antwort (klicken um mehr zu erfahren)` ("Correct answer (click
   to learn more)"), below it the solution in the serif typeface; for
   multiple-choice questions with a leading letter, `(B) Bliesgau`. A click
   expands an extra area with `explanation.summary`, `explanation.details`,
   `explanation.source`, and `explanation.moderatorNotes`. The area
   automatically collapses again on every phase change, so the row never
   unexpectedly eats up space during live operation. `Zurücksetzen`
   ("Reset") sits on the far right.
2. **Numbered action groups.** Above each group sits a small ordinal number
   that teaches the flow:

   | Group | Content |
   |---|---|
   | `1. Runde` ("1. Round") | `Starten` ("Start") |
   | `2. Spieler ermitteln` ("2. Determine player") | `Spieler 1`, `Spieler 2`, `zurücksetzen` |
   | `3. Antwort auswählen` ("3. Select answer") | `A B C D` for multiple-choice questions, `Richtig`/`Falsch` ("Correct"/"Incorrect") for spoken-answer questions |
   | unnumbered | `Auflösen` ("Resolve") |
   | unnumbered, far right | `Weiter` ("Continue") or `Spiel beenden` ("End game"); after the result, `Zurück zur Startansicht` ("Back to start view") |

   Only the heading sits above the groups, nothing else. The attempt counter
   and the points of the running attempt do **not** appear there - the value
   already sits on the stage, and a second copy at this point would make the
   bar wrap on every change of attempt.

   The buttons in the answer group carry **only the letter**. The answer
   text already sits on the stage; repeating it costs space and glance time.
   The full text remains reachable as a tooltip, and only the operator sees
   the mark on the correct option.

   `Richtig`/`Falsch` appear exclusively for questions with manual
   evaluation, i.e. for image recognition. For a multiple-choice question,
   they would be a second evaluation path alongside the logged-in option;
   that decision is made server-side in `allowedCommands`, not in the
   interface.

   `Zurück zur Startansicht` sits in the same row as `Weiter` and not in the
   header bar: it is the continuation of the same flow, just after the last
   question. The operator always looks for the next action in one place.

   The groups stay **always visible and in the same place**. Buttons that
   aren't allowed are locked, never hidden - the operator should be able to
   find their buttons blind.

A note reading `Zweite Chance · 50 Punkte` ("Second chance - 50 points")
**no longer** exists on the stage: the audience can see that the other
player is up, and the halved point value is a rule of the game, not an
on-screen message. Operator and moderator still see the value in their own
view.

In the second chance, an option already scored as incorrect is **used up**:
on the stage its row appears withdrawn, its button is locked in the control
panel, and the server rejects logging it in again with
`option-already-answered`. A second "incorrect" on the same answer would
just be a wasted attempt.

`zurücksetzen` discards the player assignment and the logged-in answer of
the running attempt. Without an assigned player, the button is locked -
there would be nothing to undo. Locks from already-scored failed attempts
remain in place (specification 6.4).

### Control Bar: Layout

The action groups sit **side by side** and share the full width; the primary
action (`Weiter`, `Spiel beenden`) sits on the far right. This keeps the bar
readable in a single row, and the eye doesn't have to jump.

### Confirmation Prompts

Actions that cannot be undone - ending the game, resetting the reveal,
deactivating a question, discarding an interrupted game, a new event day -
ask for confirmation via a dialog **inside** the application. No browser
`confirm()`: that sits outside the design and looks like an error on an
event computer. The dialog states the consequence in plain language,
`Escape` cancels, and focus sits on `Abbrechen` ("Cancel").

### Session Code

Top right, to the left of the icon switches: small label `SESSION-CODE`,
below it the code in white. The moderator needs it to sign in on the iPad;
the operator looks for it where the window switches are.

### Foot Area

Technical status, log, and connection sit as a flat foot area at the bottom
edge of the window - one row when collapsed, the full diagnostics area when
expanded.

### Outside the Stage Area

`Beenden` ("Quit") top left; `Vollbild` ("Fullscreen") and `Ton` ("Sound")
as pure icon switches top right. They carry no label, but a mandatory
`aria-label` and a tooltip. In `idle`, `Beenden` is locked.

The operator view manages without explanatory labels: there is neither an
instruction row above the control bar nor headings like "What the audience
sees" or "For control room only". The layout itself says what's public and
what isn't - the stage area on top, everything private below.

### Question Correction

The `Fehlerhafte Frage korrigieren` ("Correct faulty question") area shows
the question text **and** the answer options in editable fields. Each
answer has one row: the letter in front, then the text field spanning the
full width of the column, a radio button at the back. The radio button
marks the correct answer and thereby sets `correctOptionId` - never the
order and never a mark in the text. Questions without a selection - image
recognition and any other free-form answer - have a field
`Richtige Antwort` ("Correct answer") instead of the option rows. It writes
`acceptedAnswerText`; multiple acceptable phrasings are separated by
semicolons. Without this field, the solution couldn't be corrected for
exactly these questions.

Only what was actually changed gets saved. The fields clear on question
change - otherwise the correction for the previous question would still be
sitting in the form.

### Footer

Flat bar at the bottom edge: on the left, the expandable area
`Technik, Protokoll und Verbindung` ("Technical status, log, and
connection"); on the far right, the `Spielprotokoll` ("Game log") button.
It opens a popup with the games played so far per quiz mode - total, of
which finished, of which aborted, and when it was last played. Every
configured mode appears in the table, even with zero games: otherwise a
missing entry looks like a mode that no longer exists.

`Protokoll zurücksetzen` ("Reset log") asks for confirmation within the
same area (`Wirklich zurücksetzen`, "Really reset") - a second popup on top
of the popup would be unusable. What gets reset is the **count**: the games
stay in the database with their score and audit log, and the log starts
counting anew from that point.

## Answer Options: Two to Four

The design shows four rows but doesn't require them. **Two to four**
options are allowed (`contentThresholds.minChoiceOptionCount` and
`maxChoiceOptionCount`); the rows share the full width regardless, and the
letters keep running on from A.

Below two options, it is **not a multiple-choice question**. A single
option would be the solution itself, right there on the stage. Such
questions run everywhere as free-form answers: the audience sees no answer
rows, the operator gets `Richtig`/`Falsch` instead of the letters, and the
solution comes from `acceptedAnswerText`. This is decided in exactly one
place - `isChoiceQuestion` in `packages/contracts/src/content.ts`;
validation, engine, command authorization, and projection all query it
there.

## Interstitial Screen (`pause-screen`, Scene `pause`)

- Logo of the mode, below it `Frage 3 von 7` ("Question 3 of 7"), below that
  the **category** of the question coming up next. The category fades in
  with a short delay, so the eye takes in the number first and the topic
  second.
- Only the category is transmitted (`upcomingCategoryLabel`). Question
  text, options, and image stay on the server until the question scene.
- The screen stands for `gameTiming.pauseScreenMs` (1.5 s) - it was three
  seconds; the pace of the round was asked to be twice as quick.

## Start View (`idle`, Scene `start`)

- Stage area: start image of the selected mode. Adults: eagle as a
  watermark, with a large `?` and the title above it. Kids: edge-to-edge
  graphic on its own background color.
- Header bar: no tiles, no `+`/`-`.
- Control bar: single row, without the private answer row. Group `Modus`
  ("Mode") with three chips from `catalog.modes`, group
  `Schwierigkeitsgrad` ("Difficulty") with the presets of the selected
  mode, `Spiel starten` ("Start game") in `--primary` on the right.
- **No name fields.** The players are called `Spieler 1` and `Spieler 2`;
  the stage shows no personal names, so there is nothing to enter either.
  The `START_GAME` command therefore carries no `playerLabels`, and the
  server sets its default names.
- The active chip is `--accent`. When the mode changes, the color system of
  the **stage area** and the start image change immediately. The control
  interface is unaffected by this - it carries its own, fixed color system
  (`--ui-*`, see `docs/design-system.md`), so the operator doesn't have to
  hunt for their buttons anew on every mode change.
- If a resumable game exists (`resumable`), `Spiel fortsetzen`
  ("Resume game") additionally appears to the left of `Spiel starten`; the
  start image then carries a line
  `Unterbrochenes Spiel gefunden: Frage 4 von 7`
  ("Interrupted game found: Question 4 of 7").

## Question Views

### Layout With Image (Templates 7, 8, 15, 16)

```text
+---------------------------------------------+
| [Image 4:3]  Category                        |
|              Question text (max. 2 lines)     |
|                                               |
| [A] Answer .................................  |
| [B] Answer .................................  |
| [C] Answer .................................  |
| [D] Answer .................................  |
+---------------------------------------------+
```

- The image sits on the left, about 18% of the area's width, ratio 4:3.
- The **category** above the question is the label of the question's
  **first category** (confirmed). For this, the public view model carries
  `question.categoryLabel`. It sits small, semi-bold, in the grotesque
  typeface and in `accent` - an orientation element, not a second heading.
- Option rows: letter chip `tile` on the left, text centered on `option`.
  Both are semi-transparent, carry the same radius, and sit only a narrow
  gap apart - the letter visibly belongs to its row.

### Layout Without Image (Template 13)

Category and question text span the **full width**, with the options below
- confirmed. It stays a two-zone layout: head zone (media + text) and
answer zone.

### Visibility Levels

| Phase | Head zone | Options | Actionable |
|---|---|---|---|
| `question-presented` | visible | **hidden** | `Antworten einblenden` ("Show answers") |
| `buzzer-open` | visible | visible, neutral | `Spieler 1`, `Spieler 2` |
| `answer-locked` | visible | visible, neutral | `A`-`D` or `Richtig`/`Falsch`, `Zurücksetzen` |
| `answer-locked`, answer logged in | visible | selected row `--accent` | additionally `Auflösen` primary |

The logged-in answer appears publicly in `--accent`: the audience sees the
commitment, but not its evaluation. Whether it's right is only revealed by
the solution scene.

The options only appear after being released (confirmed) - and are not
transmitted before then either. The moderator reads the question aloud
before anyone can buzz in. The logged-in answer is **publicly** visible -
the audience sees what the player has committed to, but not whether it's
right.

## Reveal (`reveal-ready`, `reveal-running`, `reveal-paused`)

- `reveal-ready` is the intermediate step before the start: the image is
  completely covered, the clock isn't running, and no one can buzz in. The
  operator starts it with `Enthuellung starten` ("Start reveal").
- The image fills the stage and sits under a grid of tiles (default 6 x 4)
  that disappear one after another during the reveal. Nothing changes about
  the image itself - no scaling, no movement, no opacity change; an opened
  tile shows its section fully immediately and stays open.
- The order is scattered but keeps the center of the image covered until
  last. It is tied to the image's address and is therefore the same on
  every screen.
- **There is no visible countdown** - neither a number nor a depleting
  ring. The tiles are the clock; anything alongside them would pull the eye
  away from the motif that is the whole point right now. The moderator
  still sees the remaining seconds in their own view.
- The resolution comes from **one** progress variable
  (`packages/domain/src/reveal.ts`). This is a fairness rule, not a design
  question. Grid size and scatter are in `revealGrid`
  (`packages/contracts/src/config.ts`).
- Paused: the image freezes, no further tile opens.
- Once it has run its course, the image is fully open, and the buzzers stay
  open.
- If a player buzzes in during the reveal, **the stage stays in this
  scene** and freezes the image. Jumping to the question layout would take
  the motif off the screen right when it's the very thing being talked
  about (`sceneForPhase` in `packages/domain/src/projection.ts`).
- **Nothing sits next to the image.** The directorial notes `pausiert`
  ("paused") and `Buzzern weiterhin möglich` ("Buzzing still possible")
  used to exist in the operator preview; they came and went with the phase
  and pushed the motif aside in doing so - right at the moment when
  everyone is looking at it. What they said is in the control bar anyway.

## Feedback (`attempt-feedback`)

- Graphic and word sit centered in the **entire** stage area, not just in
  the zone below the header bar. The compensation sits as extra padding at
  the bottom, in `.scene--feedback`.
- Central circle, with the word below it. Correct: `--correct`, white check
  mark, short spark particles flying outward. Incorrect: `--incorrect`,
  white cross, **no** particles.
- The score tile of the evaluated player **counts up during the correct
  animation** (confirmed) and sits at the new value by the end of the
  animation. The value itself comes from the snapshot; the animation only
  interpolates between the old and new snapshot value. On an increase, the
  supplied star graphic additionally plays over the tile.
- The tile carries the server value as `data-score`. This means no
  evaluation - neither test nor diagnostics - depends on the state of a
  running animation.
- The durations are tied to `gameTiming.correctFeedbackMs` and
  `gameTiming.incorrectFeedbackMs` respectively, and are marked `locked` in
  the animation catalog.

## Second Chance (`second-chance`) - Designed

No template, fixed in the style shown; confirmed: visibly marked.

- The stage area keeps the question layout.
- The other player is marked `--accent` and is now up; the first player
  stays visible, their player tile sits in `--accent-quiet` with a lock
  icon. This mark is the entire indication - there is no line stating the
  halved point value (see "Shared Frame").
- Control bar: group 2 is locked (the turn is set), group 3 is open.

## Solution (`solution`)

- Head zone unchanged, below it the line `Richtige Antwort:`
  ("Correct answer:") and the solution bar in `--solution` spanning the
  full width.
- Multiple-choice questions keep the letter chip in `--solution-chip`;
  free-form answers show the bar without a chip.
- For image-recognition questions, the image moves to the top right and is
  shown in focus; the bar sits below it.
- **Only the correct answer carries color.** All other options remain in
  place and step back evenly - including the one a player had previously
  chosen. Two colored rows side by side would dilute the point of the
  scene: from here on it's only about what is correct.
- **No explanatory text on the stage.** The background information belongs
  to the moderator, who narrates it; it is therefore never transmitted
  publicly in the first place. It remains unchanged in the operator's
  private area.

## Result (`result`)

- Header bar without player and question tiles; only the operator's `+`/`-`
  stay in their position.
- The heading `Spieler 1 hat gewonnen!` ("Player 1 has won!") or
  `Unentschieden!` ("Draw!") sits in the middle, below it two large result
  tiles - mirrored again: `Spieler|Punkte` on the left, `Punkte|Spieler` on
  the right.
- Confetti falls over the entire area, **without** darkening the
  background.
- Control bar: all game buttons locked, `Spiel beenden` in `--primary` on
  the right; the private answer row still shows the last solution.
- The result tiles count up just like the header bar: if the operator
  still corrects points here, it's the same motion as during the game.

## Pause Screen (`pause-screen`) - Designed

Time-driven interim state per specification 6.2.

- The stage area shows the mode's start image as a calm watermark at 35%
  opacity, with `Frage 4 von 7` in result-title size above it.
- The header bar stays fully visible - the score is exactly what's
  interesting right now.
- Control bar: everything locked; the server advances on its own after
  `gameTiming.pauseScreenMs`.

## Abort (`aborted`) - Designed

After `Beenden`: the stage area returns to the mode's start image. There is
deliberately **no** winner view (specification 6.6). The control bar shows
only `Neues Spiel` ("New game").

## Connection and Error States - Designed

- **Stage window without a connection:** the last snapshot stays on screen.
  A 4px-high strip in `--incorrect` slides in at the bottom edge of the
  stage area. There is no error message in the picture, because the
  audience is watching along.
- **Operator without a connection:** a banner
  `Keine Verbindung zum Server - Wiederverbindung laeuft`
  ("No connection to the server - reconnecting") in `--incorrect` appears
  above the control bar; all buttons are locked until a snapshot arrives.
- **Command rejected:** a brief note in the control bar with the server's
  plain-language message, visible for three seconds. The state is never
  "repaired" locally - the next snapshot rules.

## Moderator View - Designed

Its own text-oriented layout without a stage preview (specification 21):

```text
Question 3/7 · Person · mittel
Question text (large)
Solution: Bundestagsadler
Background: ...
Next step: Antworten einblenden
Score: 100 : 100
```

The same color system and the same typeface apply; the font sizes here are
in `rem`, because the iPad is not a stage image.
