# Animation catalog (approved)

This catalog describes every movement the application shows. Sections A
through F are approved and are entered one-to-one into
`apps/web/src/presentation/transitions/`.

How animations are technically set up and changed is described in
[`docs/animationen.md`](animationen.md). This file defines **what** moves.

## Rules that apply to every row

1. **Animations never control the game state.** The server ends phases after
   fixed times; a missing `animationend` must never block anything.
2. **Locked durations** (`locked`) are bound to `gameTiming`. They may only be
   changed there, never in the animation.
3. **Every row has a reduced-motion value.** Under `prefers-reduced-motion`,
   movement is omitted, not information: it fades in instead of moving.
4. **Sound only from the audio master.** The sound cue belongs to the
   transition but is played by exactly one client only.
5. **Nothing blinks, nothing pulses continuously.** On a stage, continuous
   animation is unrest.

## A - Scene transitions

| ID | From → To | Duration | Reduced | Easing | What moves | Sound |
|---|---|---|---|---|---|---|
| `scene-fade` | any → `pause` | 400 ms | 120 ms | standard | cross-fade of the whole area | `scene-change` |
| `question-enter` | `pause`/`start` → `question` | 420 ms | 120 ms | emphasized | media and text rise 12 px and fade in | `question-appear` |
| `options-stagger` | within `question` | 70 ms offset per row | 0 ms | standard | answer bars slide in one after another from the left, 16 px | - |
| `reveal-enter` | `question` → `reveal` | 420 ms | 120 ms | emphasized | the covered image area fades in | `question-appear` |
| `video-enter` | any → `video` | 640 ms | 120 ms | emphasized | video area grows from the center (90% → 100%), rises slightly, and fades in | - |
| `solution-reveal` | `feedback` → `solution` | 520 ms | 150 ms | emphasized | solution bar grows from the center to full width, text fades in 120 ms later | `solution` |
| `result-celebration` | `solution` → `result` | 6000 ms | 0 ms | standard | confetti falls, result tiles rise 20 px | `result` |
| `start-return` | any → `start` | 400 ms | 120 ms | standard | cross-fade to the start image | `scene-change` |

`options-stagger` is not a scene transition of its own, but the entry rule of
the answer zone. It also runs when the options only appear after `Starten`
("Start").

## B - State changes within a scene

| ID | Trigger | Duration | Reduced | What moves | Sound |
|---|---|---|---|---|---|
| `player-activate` | player gets the turn | 220 ms | 80 ms | player tile colors to `--accent`, brief pop to 1.04 | `buzz` |
| `player-lock` | player is locked out | 220 ms | 80 ms | tile changes to `--accent-quiet`, lock icon fades in | - |
| `option-choose` | answer logged in | 200 ms | 80 ms | chosen bar colors to `--accent` | - |
| `option-clear` | `Zurücksetzen` ("Reset") | 200 ms | 80 ms | coloring falls back to neutral | - |
| `options-appear` | `Starten` ("Start") | 420 ms | 120 ms | answer zone expands, then `options-stagger` | `question-appear` |
| `video-exit` | video finished playing (`video.status = ended`) | 700 ms (`videoExitMs`) | 1 ms | video area fades out and recedes slightly; the element only stops afterward | - |
| `score-count-up` | score changes | 600 ms | n/a | digits count up from the old to the new snapshot value | `score` |
| `score-stars` | score **increases** | 1000 ms | n/a | delivered graphic `stars.webm` plays over the score tile | - |

Both are implemented in `apps/web/src/presentation/ScoreTile.tsx`. The
animation does not produce a value of its own: it interpolates between two
snapshot values and always ends exactly on the server value. If a new
snapshot arrives mid-count, it continues from the current display toward the
new target value. Under reduced motion, the value updates instantly and the
stars are omitted.
| `second-chance-hint` | switch to `second-chance` | 260 ms | 80 ms | hint line slides in 8 px from above | - |
| `progress-step` | `Frage x/y` ("Question x/y") increases | 200 ms | 0 ms | number changes with a brief flash | - |

`score-count-up` deliberately runs **during** the correct-answer animation, so
the point gain and the checkmark are read together (confirmed).

## C - Feedback (drawn, not delivered)

Correct and incorrect are drawn in code: a disc that springs in, then a symbol
drawn along its own path (`AnswerResultAnimation` in quiz-react). They used to
be delivered files - VP9 WebM with an alpha channel, 500 x 500 pixels - and that
was the one statement on the stage that could not follow the theme: the clip's
turquoise and its red were baked in, whatever palette the running stage carried.

| Mark | Sequence | Statement complete after | Colours |
|---|---|---|---|
| Checkmark | disc scales in over 480 ms with a short overshoot, checkmark draws from 250 ms over 360 ms | 0.61 s | disc `--color-correct`, symbol `--stage-inkOnStrong` |
| Cross | the same motion, two strokes as one path | 0.61 s | disc `--color-incorrect`, symbol `--stage-inkOnStrong` |

This resolves the previously open point "the incorrect circle is missing a
cross": the cross is drawn on the disc.

The disc measures 92 percent of `--feedback-size` (14.2 cqw), which puts it on
the stage at the size the two clips had - they carried a lot of transparent
margin, so their frames were 34 and 16 cqw for discs of the same size. Reduced
motion keeps the mark and drops the movement, as the clips' still frame did.

### Consequence for the phase durations

A phase must run at least until the statement is complete, otherwise the state
transition cuts into the movement. The numbers in `gameTiming` were once matched
to the files:

| Value | Value | Reason |
|---|---|---|
| `correctFeedbackMs` | **2000 ms** | matched to the old clip; the mark now stands complete after 0.61 s and rests for the remainder |
| `incorrectFeedbackMs` | **1800 ms** | the same |

They are **kept** as the pacing of the moment, not as a constraint from a file:
the room needs a beat to read the mark, and the score counts up underneath it
meanwhile. The specification explicitly names these two numbers as example
values to be set during visual fine-tuning; only the ten seconds of the image
reveal are binding. Both transitions remain `locked`: the server ends the phase
after exactly this time.

| ID | Duration | Reduced | Sound | Binding |
|---|---|---|---|---|
| `correct-feedback` | `gameTiming.correctFeedbackMs` = 2000 ms | still frame, no movement | `answer-correct` | **locked** |
| `incorrect-feedback` | `gameTiming.incorrectFeedbackMs` = 1800 ms | still frame, no movement | `answer-incorrect` | **locked** |

Under `prefers-reduced-motion`, the file is not omitted but set to its final
frame and paused: same statement, no movement.

The correct graphic is set to **34 cqw**, the incorrect graphic to 16 cqw: the
checkmark is the moment the room waits for, the cross stays understated. The
scene under the incorrect graphic no longer shifts sideways - it only fades
in, so the graphic does not drift along with it.

The word `Richtig!` ("Correct!") or `Falsch!` ("Incorrect!") sits close under
the graphic. Both files bring transparent margin with them - the checkmark
swings wide with sparks, the cross sits tightly framed. The offset therefore
hangs on `--feedback-pull` per variant and scales with the graphic. The score
counts up at the same time in the header (`score-count-up`).

## C2 - Interstitial screen

The screen between two questions shows the question number and category. The
category fades in with `pause-category-in`: 600 ms, delayed by 400 ms,
rising from below. The delay is the point of the animation - first the
number, then the topic.

| ID | Duration | Reduced | Sound | Binding |
|---|---|---|---|---|
| `pause-category-in` | 600 ms, 400 ms delay | no movement, instantly visible | - | free |

The screen itself stands for `gameTiming.pauseScreenMs` = 3000 ms.

## D - Reveal (fairness)

| ID | Duration | What moves | Sound |
|---|---|---|---|
| `reveal-progress` | `gameTiming.imageRevealDurationMs` = 10 s | grid tiles disappear one after another | - |
| `reveal-pause` | 160 ms | the image freezes, no tile is added | - |
| `reveal-complete` | 300 ms | the last tile falls | `question-appear` |

**Not negotiable:** the resolution is computed from the server's progress
variable and never from an independent CSS animation. There is no visible
countdown on the stage - neither number nor ring. Nothing changes on the
image itself - no zoom, no movement (confirmed); it is only released piece by
piece. A tile that is once open stays open and immediately shows its section
in full.

## D2 - Further delivered motion graphics

Their use is approved in two places:

| File | Length | Use |
|---|---|---|
| `trophy.webm` | 2.0 s | results view, above the line `Spieler 1 hat gewonnen!` ("Player 1 has won!"). Not shown on a draw |
| `stars.webm` | 1.0 s | over the score tile, whenever the score increases - in every mode, together with `score-count-up` |

Not used and without any application in the inventory:

| File | Reason |
|---|---|
| `question-marks.webm` | the pause image stays calm |
| `trophy.webm` | the results view already works with confetti and tiles |

## E - Operator control frame

The frame is a tool, not a performance. It gets exactly three movements:

| ID | Duration | What moves |
|---|---|---|
| `control-state` | 120 ms | color and text change of each button |
| `answer-expand` | 220 ms | additional area of the private answer row expands and collapses |
| `banner-slide` | 200 ms | connection or error banner slides in over the control bar |

## F - What is deliberately **not** animated

- Switching between modes and difficulty levels on the start view: instant
  color change, so the operator can try things quickly before the show.
- Revealing the solution in the private answer row: it always appears
  instantly.
- The score change on `+`/`-` by the operator: instant value, because it is a
  correction, not a game action.
- Showing and hiding the stage window: the operating system handles that.

## Approval

| Point | Status |
|---|---|
| Sections A through F | **approved** |
| Use of `stars` | **approved** (see D2) |
| `question-marks.webm`, `trophy.webm` | remain unused |
| Locked durations in C and D | follow from the specification and the delivered files |
| Sound cues | delivered audio files, mapping below |

## Sounds

The sounds are delivered as files from `apps/web/src/assets/audio/`.

| Event | Cue | File |
|---|---|---|
| new question appears | `question-appear` | `opener.mp3` |
| answers are faded in | `options-appear` | `swoosh.mp3` |
| player gets the turn | `buzz` | `buzzer.mp3` |
| answer logged in | `answer-logged` | `decide.mp3` |
| resolved correctly | `answer-correct` | `correct.mp3` **and** `applause.wav` |
| resolved incorrectly | `answer-incorrect` | `wrong.mp3` |
| score counts up | `score` | `score.mp3` |

Four rules for this:

1. **Only the audio master makes sound.** The server determines it in this
   order: local stage window, otherwise any stage window, otherwise the
   operator. The last step is the sound during rehearsals and in pure browser
   operation - without it, the application would stay silent as long as no
   stage window is open. Once a stage joins, the operator immediately hands
   the sound authority back over; exactly one client sounds at any time.
   Which window that currently is shows up in the diagnostics under
   `Tonausgabe` ("Audio output").
2. **Unlocking needs an interaction per window.** Browsers block audio
   output until a click or tap has occurred in the respective document.
   Operator and stage therefore play every file silently once on the first
   click and reset it (`unlockAudio`). A mere `load()` is not enough for
   this.
3. **Every cue depends on the server state, not the click.** A rejected
   command stays silent - the buzz sound, for instance, only comes with the
   phase transition the server has confirmed.
4. **If a file is missing, the cue stays silent.** The files are collected
   via `import.meta.glob`; neither the build nor the game flow depends on it.
