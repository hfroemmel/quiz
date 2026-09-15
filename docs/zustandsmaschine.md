# State machine and phases

All phase transitions happen exclusively in `packages/domain/src/engine.ts`.

## Phase overview

| Phase | Meaning | Buzzer |
|---|---|---|
| `idle` | no game active | locked |
| `pause-screen` | pause/logo screen between two questions (timed) | locked |
| `question-presented` | question visible, answers still hidden | locked |
| `video` | video part of a video question; only the client knows whether the video is currently playing | locked |
| `buzzer-open` | normal question, buzzer open | **open** |
| `answer-locked` | a player has claimed the turn | locked |
| `attempt-feedback` | correct/incorrect animation (timed) | locked |
| `second-chance` | second chance for the other player | locked (no buzzing needed) |
| `reveal-ready` | image recognition, image blurred, reveal not yet started | locked |
| `reveal-running` | image recognition, reveal active or completed | **open** |
| `reveal-paused` | image recognition, reveal frozen | **open** |
| `solution` | solution visible, question completed | locked |
| `result` | results view | locked |
| `aborted` | game aborted, no result | locked |

The buzzer column is not a second source of truth: it follows from
`buzzablePhases` in `packages/domain/src/buzzer.ts`. This means `video` can
structurally never have an open buzzer.

## Normal multiple-choice question

```text
pause-screen ──(time)───> question-presented   (only the question, no answers)
                              │ OPEN_BUZZER   ("Antworten einblenden" / "Show answers")
                              ▼
                         buzzer-open
                              │ BUZZ / SELECT_PLAYER_MANUALLY
                              ▼
                        answer-locked
                              │ LOG_OPTION_ANSWER | MARK_MANUAL_ANSWER
                              │ RESOLVE_ATTEMPT
                              ▼
                       attempt-feedback
             correct ─────────┴──────── incorrect (1st attempt)
                │                              │
                ▼                              ▼
            solution                     second-chance
                                               │ RESOLVE_ATTEMPT / PASS_SECOND_CHANCE
                                               ▼
                                        attempt-feedback ──> solution
```

From `question-presented`, `buzzer-open`, `answer-locked`, and
`second-chance`, `RESOLVE_WITHOUT_ANSWER` is possible at any time: no points,
straight to the solution. There is no binding waiting time.

## The intermediate step before every round

Every question first sits still: the moderator reads it aloud without anyone
being able to buzz. Only the operator's release fades in the answer options
or starts the reveal - and thereby opens the buzzer.

This is not a purely display-related question: in `question-presented`, the
server does not transmit the answer options at all, and in `reveal-ready` the
clock does not run. The read-aloud time therefore does not cost a single
second of the countdown.

### Control profile

`START_GAME` optionally carries `flowProfile`; without it, an operator
(`operated`) is in control. The phases are the same in both profiles - there
is no second state machine. The only difference is who triggers a
transition:

| Point | `operated` | `self-service` |
|---|---|---|
| Question appears | operator opens the buzzer | `question-presented`, then automatically `buzzer-open` after `questionLeadInMs` |
| Image recognition | operator starts the reveal | starts directly in `reveal-running` |
| Answer | operator logs in and resolves | the same sequence performed by the players themselves: `BUZZ` locks out the other player, `LOG_OPTION_ANSWER` marks it (still changeable), `RESOLVE_ATTEMPT` submits and evaluates it |
| after the solution | operator presses `Weiter` ("Continue") | a PLAYER presses `Weiter` (`CONTINUE`); nothing is timed here |
| Video question | operator starts it; at the end the video fades out and the flow holds until the operator shows the question | starts after `videoLeadInMs`, the question follows from the reported playback duration |

All automatic transitions use the same mechanism as feedback and the pause
screen: a `pendingTransition` with a server-side fallback time. A missing
report from a browser therefore cannot halt the flow.

Two spots are deliberately NOT timed, but require a tap instead:

- **Before the answers**, the server waits `questionLeadInMs`. No one reads
  the question aloud at the device; this delay replaces that. While it runs,
  the buzzer is closed and the options do not even go out over the wire.
- **After the solution**, the server waits for `CONTINUE` from a player. A
  timed transition would pull the image out from under whoever is currently
  reading why their answer was wrong. If the device stalls there, the shell's
  idle supervision takes over.

The transition out of `solution` is not a phase change in itself, but the
same decision as `CONTINUE`: draw the next question or show the result.

Questions that only a human can evaluate (`manual-correct-incorrect`) cannot
be resolved on the device. If such a question is drawn in self-service
operation, the server draws a replacement and logs it; if an entire question
slot is unsuitable, it is skipped. If no answerable question can be found at
all, the game ends with the result - a frozen screen would be the worst
outcome on an unattended device.

### Player count

A game has one or two players (`START_GAME` with `playerCount`; two without
one). The phases are the same in both cases, only the second chance depends
on it: it requires another player who may still answer this question. In a
single-player game there is none, so `solution` follows immediately after a
failed attempt. This is decided in exactly one place - `eligibleOpponent` in
`packages/domain/src/buzzer.ts`.

The result also depends on the player count: in a duel, the higher score
wins (a tie on a draw), in a single-player game there is neither a winner nor
a draw, only score and hit count. Which version applies is stated by
`result.mode` in the view model - the interface does not count the scores
itself.

## Image recognition

```text
pause-screen ──(time)───> reveal-ready   (image blurred, clock stopped, buzzer locked)
   ▲                          │ START_IMAGE_REVEAL
   │                          ▼
   │                     reveal-running   (reveal active, buzzer open)
   │                          │ BUZZ
   │                          ▼
   │                     answer-locked   (reveal frozen)
   │                          │ RESOLVE_ATTEMPT
   │                          ▼
   │                   attempt-feedback
   └───── incorrect ──────────┤
                             └── correct ──> solution (image fully in focus)
```

After a failed attempt, it goes back to `reveal-running`, not to
`reveal-ready`: the question has already been read aloud.

Unlimited failed attempts; after each one, the reveal continues from the same
point and **both** players may buzz again. `PAUSE_IMAGE_REVEAL` and
`RESUME_IMAGE_REVEAL` switch between `reveal-running` and `reveal-paused`.

## Video question

```text
pause-screen ──(time)───> video ──SHOW_QUESTION_AFTER_VIDEO──> question-presented
                           │ ▲                                        │
                           └─┘ START_VIDEO                            └──> normal flow
                          (an instruction, not a phase change)
```

Video and question are two phases of the **same** question, not two
questions.

**The flow moves in one direction.** `START_VIDEO` (with the `questionId` of
the running question) writes a playback request into the state:

```ts
interface VideoPlaybackRequest {
  questionId: string
  requestId: string   // new on every accepted click
  requestedAt: string
}
```

The stage locally remembers the last executed ID and starts from zero on any
other one. Nothing more happens: the server knows neither the loading state
nor the playback duration nor the end, schedules no transition based on a
video's length, and waits for no confirmation. The video's end is **not** a
state transition - the last frame stays on screen until the operator presses
`Frage einblenden` ("Show question"). A second click on `Video starten`
("Start video") creates a new request and plays from the start again;
`SKIP_QUESTION` remains possible.

A command is rejected if it names a question other than the running one
(`video-question-mismatch`), one for a question with no video attached
(`video-source-missing`), and any command outside the video phase
(`invalid-phase`).

The request is dropped once the question is shown, and it does not survive a
**server restart** - otherwise the video would start playing again on its own
in the room. A **stage reconnect** is different: there, it remains pending
and is replayed exactly once.

On the device (`self-service`) there is no podium: there, the server issues
the request itself after `videoLeadInMs`, and the device shows the question
itself after the video ends - or if the file cannot be played. This is the
only place where a client sends anything after the video, and there it is its
own operator.

## Timed phases

`attempt-feedback` and `pause-screen` carry a `pendingTransition` with
`endsAtMs` and `transitionId`. The server sets a timer for this and then
sends `ADVANCE_TIMED_PHASE`.

* The business transition **never** depends on a browser's `animationend`
  event.
* A duplicate report is a no-op, because the `transitionId` no longer matches
  after the first transition.
* The durations live in `gameTiming` (`packages/contracts/src/config.ts`).

## Result

`CONTINUE` always means the same thing: on a non-final question, go to the
next question; on the final question, go to the results view. It never means
"evaluate answer" or "release the second player" - there are separate
commands for that.

The higher score wins, a tie produces `Unentschieden` ("Draw"). There is no
manual winner selection and no decision question. An aborted game shows no
result.
