# The Joker in the Live Quiz

Every player has **one** joker per game. It is **drawn**, not
chosen: whoever has buzzed asks for their joker, the operator draws it, and
the **server** decides with a 50:50 flip whether it becomes a **50:50 joker** or an
**audience joker**. Neither the player nor the operator can determine the type -
a choice would be a tactical decision, a draw is a moment.

The coin only falls where both outcomes are possible. An
image-recognition question has no answers to halve; there
the audience joker is the only possible outcome (see
[What This Question Allows](#what-this-question-allows)).

The joker only comes back with a new game. Not with a new question,
not with a new round, not by reloading, not by a reconnect -
and there is no command that undoes a draw. It is final from its
first moment: the player status switches to `used` before the card
has left the scoreboard.

In the source code it is always called **joker**; German words appear only in
text that a human reads.

## Live Quiz Only

The standalone quiz, the kiosk, the app collection, and the local runtimes have **no
joker**: no state, no UI, no configuration.

There is **no flag** for this. What decides is the game's flow profile:

| Flow profile | Who runs it | Joker |
| --- | --- | --- |
| `operated` | an operator at the console (live quiz) | yes |
| `self-service` | the players themselves on the device | no |

`START_GAME` only creates the stock for `operated`. The state thus describes itself:
a game **with** jokers carries `jokerByPlayer`, a game without
does not carry the field - even after a server restart, and even for a game
that was saved before this feature existed. That is exactly what
`gameHasJokers(state)` checks, and only this one place decides it.

## The Sequence

```
                 DRAW_JOKER              Server, after 820 ms
available   ────────────────►  drawing  ────────────────────►  revealed
                                                                  │
                                                   CONTINUE_JOKER │
                                                                  ▼
        idle  ◄────────────────────────────────────────────   applied
              Answer graded (mark) / new question (either way)
```

When drawing, the server decides **everything at once**: the joker type and - for
the 50:50 - the answers that disappear. Both are stored in the
game state from this moment on. No later step and no client rolls the dice
again.

The `drawing -> revealed` step also belongs to the server: it schedules it as
a timed transition (`pendingTransition`, the same mechanism as the
feedback animation) and switches over itself after `jokerRevealAtMs` - exactly
when the card has arrived in the middle. That's why a client that
joins mid-draw finds the same state as everyone else.

**The flip comes after, not before.** While `drawing`, no client knows
the joker type (see below) - a card that flipped beforehand would show an empty
back and would deliver the result belatedly. The snapshot with the result is
therefore the same one that starts the flip: no timer in the client, nothing that
could drift apart.

## Commands

| Command | Roles | Effect |
| --- | --- | --- |
| `DRAW_JOKER` | `operator` | Draws the joker of the player who buzzed: type and hidden answers are determined, the joker is now considered used, the card flies |
| `CONTINUE_JOKER { sequenceId }` | `operator` | Applies the result and releases the question again |

`DRAW_JOKER` **carries no payload**. No joker type, because the server
flips the coin - whoever could name it could choose it. And no
`playerId`: only whoever has the floor may draw, and the server knows that. A
field for it would be a field that would have to be checked against the active
player, and the check would be "is it the active player anyway".

`CONTINUE_JOKER` names the draw it refers to. A late click - the
operator view has re-rendered, the connection dropped and came back -
then arrives with the identifier of a draw that is over, and is
rejected instead of skipping a step of the current one.

**While `drawing` and `revealed`, the question rests.** Logging in, grading,
resolving, continuing, skipping, buzzing - all rejected
(`joker-sequence-active`) and not even offered in `allowedCommands`. An
answer under a card that covers the screen would be a decision made
behind the audience's back. One list, two readers: `jokerBlockedCommands`.

Rejections carry a structured reason: `joker-already-used`,
`joker-not-applicable`, `joker-sequence-active`, `joker-no-sequence`,
`joker-sequence-stale`, `joker-no-answering-player`, plus the general
`invalid-phase` and `answer-not-logged`. A rejected draw consumes
**nothing**.

## Events

There is no event channel to the clients - they get complete
snapshots. The event is therefore the entry in the game log, named in the
data section:

- `jokerDrawn { playerId, jokerType, questionId, sequenceId }` (for the 50:50
  additionally `eliminatedOptionIds`)
- `jokerApplied { playerId, jokerType, sequenceId }`

`deriveQuizEvents` - the events for an embedding host - deliberately does
**not** know about the joker: this interface belongs to the kiosk, and
there is no joker there.

## State

Two things, deliberately kept separate, because they have two lifetimes:

- `GameState.jokerByPlayer` - what a player has done in **this** game:
  `{ status: 'available' }` or
  `{ status: 'used', type, usedAtQuestionId, usedAt }`, per player ID. Always
  read via `jokerOf(jokerByPlayer, playerId)`. Persists across every question
  and ends with the game.
- `GameState.jokerSequence` - the draw as it is **running**:
  `{ phase: 'idle' }` or
  `{ phase: 'drawing' | 'revealed' | 'applied', sequenceId, playerId,
  questionId, type, startedAt, eliminatedOptionIds? }`. Set back to `idle`
  at the one place where a new question arrives - and with it
  the hidden answers disappear.

A single field could not do both: it would either bring back the hidden
answers on the next question or keep the joker drawable forever. The
`questionId` is also why an old draw can never
affect a new question - the projection compares it with
the question that is actually current.

In the snapshot:

- `PublicScore.joker` (`{ used }`, absent in a game without jokers),
- `PublicOption.eliminated`,
- `PublicQuizViewModel.jokerDraw` (`phase`, `sequenceId`, `playerId`,
  `startedAtServerMs`, `revealCompleteMs`, and `type`),
- `OperatorQuizViewModel.joker` - a ready-to-display section with `canDraw`,
  `blockedReason`, `playerLabel`, `used`, and the running `sequence`.

**The joker type doesn't go out on the wire until the card has flipped.**
While `drawing`, all roles learn THAT a draw is running, whose it
is, and when it started - the flight needs that. What came out arrives with
`revealed`, i.e. at the moment the card shows it anyway. The same goes for the
hidden answers: decided at the draw, transmitted only with
`applied`. A stage that knew it earlier could give it away - and one
that had to be trusted would be the wrong design.

## What This Question Allows

A draw can only happen if a question is running, **the answers are visible**,
and it has not yet been resolved, a player has **validly buzzed**
and is allowed to answer, their joker is still available, no answer is
logged in, no other draw is running - and the question **can carry
at least one outcome**.

Which ones qualify is decided by `drawableJokerTypes(state)`, and BEFORE the
coin flip:

| Question | Possible | Why |
| --- | --- | --- |
| Choice question with enough open answers | 50:50 **and** audience | the normal case, the coin decides |
| Image recognition and other free-form questions | audience only | there are no answers to halve; asking the room is the only help there that means anything |
| Choice question with too few open answers | nothing - not drawable | see below |

With exactly one possibility, **the coin flip is skipped**: `drawJokerType` returns
the single type and does not touch `random`. A flip could otherwise
produce something the question cannot support. In that case the console tells
in advance what will come (`view.joker.onlyType`) - the operator should be able
to announce it instead of having to explain afterward.

The third row of the table is the reason a check happens beforehand at all: a
choice question that cannot support a 50:50 is simply not drawable. Otherwise
it would only be noticed after the flip and the player would get an audience
joker because their question was too short - a lottery on top of the
lottery. On the console, the button is then disabled and names the reason. For
an image question it's different: there only one outcome is ever in play, and
no one loses a chance that never existed.

### Image Recognition in Particular

For the room it stays the same process as always: the card detaches, flies,
straightens up, flips, and shows the audience joker. The animation gives away
nothing that here there was nothing to decide.

The draw leaves the question completely untouched. `DRAW_JOKER` and
`CONTINUE_JOKER` touch neither `reveal` nor `buzzer` nor `phase`, and the
card flip is explicitly **not** a phase change (see
`isJokerRevealTransition` - it is scheduled onto the phase it is
already in). After `Weiter` ("Continue"), the following therefore holds:

* The image stays at the state at which the buzzer froze it - a
  valid buzz calls `pauseReveal`, and nothing in the draw calls
  `resumeReveal` or `resetReveal`.
* The host's remaining seconds do not restart: they are derived from the same
  reveal clock, there is no second timer.
* `buzzer.acceptedPlayerId` and the open attempt remain as they were;
  points still go to the player who buzzed.
* Visibly, only the digit of the active player switches to the group symbol -
  and only for as long as the question is open (`questionStillOpen`).

## The 50:50

Eligible means: a choice question with exactly one correct answer and at least
**three** open answers. Only the **open** ones are counted: an answer
that was already graded as wrong in an earlier attempt is used up. In the
second chance of a three-answer question, too little then remains, and the
draw is rejected instead of showing the solution.

When drawing, the correct answer stays, exactly **one** wrong answer stays,
everything else disappears - one out of three answers, two out of four,
correspondingly more for more. The surviving wrong answer is drawn **once, on
the server** (`EngineContext.random`), and its ID travels along in the snapshot.
No answer is selected for the player.

This only becomes visible with `CONTINUE_JOKER`. The eliminated answers then
keep their place, their height, and their letter and only **step back**:
opacity 0.33, in their own colours, over 250 ms, staggered by
110 ms for multiple answers. No strikethrough - the row stays readable, and a
line would be a second statement on top of the first. They become unreachable
in the component (`disabled`, `aria-hidden`), never only visually. When the
question changes, the IDs disappear, the joker remains used.

## The Audience Joker

No digital vote. The player asks the room, the application records
that the joker is used. No invented percentages, no random
audience result, no additional timer.

After `CONTINUE_JOKER`, the question and **all** answers remain unchanged. The
only thing that changes is the **marking of the active respondent**: in
their score card, the group symbol replaces the
player number, with a 200 ms crossfade. Score, colors, size, and the other
player's card remain untouched.

**Answer ownership is unaffected.** `buzzer.acceptedPlayerId`, the lock,
and later the points still belong to the player who buzzed - it is
a marking, not a reassignment. The symbol disappears as soon as the attempt
is graded or the next question comes (the projection only emits an
`applied` draw while the question is open).

Note on the spec: the player number of the active respondent is visible
on the stage **only** in their score card - there is no
second display. "Scoreboards remain unchanged" is therefore implemented as
follows: layout, colors, and scores remain, only the digit of the
active player is swapped, and only for as long as the joker is in effect.

## The Two Symbols

Each joker type has a symbol, and it lives **once** in the package:

| File | Drawing | Aspect ratio |
| --- | --- | --- |
| `joker-audience-icon.svg` | three figures, the middle one highlighted | 640 : 398 |
| `joker-fifty-fifty-icon.svg` | the lettering `50:50` between two arcs | 704 : 553 |

They are displayed with `JokerTypeIcon`, in one of two tones:

| `tone` | How | For |
| --- | --- | --- |
| `text` (default) | mask over `currentColor` | anywhere the surrounding context sets the color |
| `art` | the drawing with its own colors | a card surface with a **light** background |

**The mask is the default, and that is not a reservation against the drawing.**
The 50:50 lettering is set in a very dark gray; on the dark
adult stage it nearly disappears into it. As a mask, the same symbol
carries the text color of its surroundings and works on both stages. `art` must
therefore be explicitly requested - by a surface that knows its own background.

The same applies to the group symbol in the score card: it **replaces**
a digit and must carry that digit's color, never a color of its own.

**The width comes from the file.** Neither of the two symbols is square,
and they are not cropped identically. Only the height is set (`1em`), and
`--joker-icon-ratio` calculates the width from it - so both symbols stand equally
tall, and neither is squeezed. A field with its own dimensions still doesn't get a
distorted symbol: the mask sits inside it with `contain`.

## The Joker Card on Stage

`JokerCard` (in `hfroemmel/quiz-live`, `apps/web/src/components/`) shows a
neutral card - the same one for both players, imported via the
normal build path.

**Every design world has its own card**, because a joker card is an
object with a face, not a tinted surface:

| `theme.skin` | File |
| --- | --- |
| `default` | `Jokerkarte_Livequiz_verfuegbar.png` |
| `kids` | `Jokerkarte_Kinderquiz_verfuegbar.webp` - Karlchen with a jester's cap |

Selected in `jokerCardArt.ts`, solely via `view.theme.skin` - not
via the target audience and not via a mode name. The same function supplies
`--joker-card-ratio`: both cards are positioned via their **width** and
derive their height from the file, so that different proportions are neither
cropped nor given a margin. The small card at the scoreboard and
the flying one in the overlay read the same variable - it is the same object.

It sits **in front of** the scoreboard and overlaps it by half: for player 1
on the far left and rotated slightly counter-clockwise, for player 2 on the
far right, mirrored and rotated the other way. Side, rotation, and mirroring are
entirely in the CSS and depend on `data-player`.

In front of the tile and not behind it, because the tile is semi-transparent:
behind it, it would swallow half the card and show through as a smudge.

It is deliberately **smaller than the score card**: 3.6cqw wide, 4.6cqw
tall via the aspect ratio, rotated about 5cqw - and thus stays within
the roughly 6cqw-tall tile instead of pushing out of the top of the header.
Just under half of it shows (1.9cqw out of 3.6cqw); the rest disappears behind
the tile. Going further in isn't possible, because the tile is
semi-transparent - what lies behind it shows through and lays a smudge over
the caption and number. The E2E test measures both.

It shifts nothing: the header places a relatively
positioned frame around the score card for each player
(`StageHeaderSlots.besidePlayer` in `@hfroemmel/quiz-react`), and the card sits
inside it, absolutely positioned, with `z-index: 1`. The scoreboards remain
color-neutral and keep their size and position.

When drawing, **the draw lifts it away**: the small card is gone in the same
moment, without a transition (`data-lifted`), because the flying card in the
overlay stands at exactly its spot from that frame on - two cards would be
one too many. It stays in the document only because the draw needs to
measure its position.

After that it **does not come back**: the joker is used, and a
returning card would claim the opposite. No empty placeholder,
no crossed-out second card.

It is not a control element: no pointer, no focus, the image carries `alt=""`
and `aria-hidden="true"`. For screen readers there is a sentence in the
player area - `stage.joker.available` / `stage.joker.used` from the
existing translation structure.

## The Draw on Stage

`JokerDrawOverlay` (in `hfroemmel/quiz-live`, `apps/web/src/components/`) sits
as a layer over the stage - mounted into the existing slot `pads.overlay`
of `StageScreen`, i.e. INSIDE the stage area with its colors,
container units, and its zoom level. No global `sceneRoot` identifier, no
own portal on the document.

The sequence, all durations from `jokerDrawTiming` in the core:

| Section | Duration | What happens |
| --- | --- | --- |
| Lift-off | 120 ms | layer fades in, question and answers dim and blur, the small card disappears |
| Flight | 580 ms | the card flies in an arc from its **measured** position to the center, straightens from its tilt to `0deg`, and grows to card size |
| Settle | 120 ms | brief overshoot to `scale(1.03)`, then `scale(1)` |
| *(server reports `revealed`)* | | only now does the client know the joker type |
| Flip | 680 ms | the card rotates around the vertical axis; at 90 degrees the image switches |

**The start is measured, not fixed.** The component reads the position of the
small card with `getBoundingClientRect()` and converts it into the coordinates
of the stage (a factor from its own width, because the stage can be
scaled). Fixed coordinates would be wrong the first time the header
changes - and would be wrong anyway in the small operator preview.

The flip is done with `JokerFlipCard`: two identically sized faces in a
`preserve-3d` box, each with `backface-visibility: hidden`, the back
face set to `rotateY(180deg)` from the start. That's why the image switches
exactly at 90 degrees - no flash of the wrong joker, no cross-fade. The
back shows the symbol (`joker-fifty-fifty-icon.svg` / `joker-audience-icon.svg`,
as a mask over the text color) and the name as a word.

**Resume instead of restart:** every animation starts with a negative
offset calculated from `startedAtServerMs`, `revealAtMs`, and the server clock.
A stage window that reloads mid-flight sees the card where it
belongs; one that joins mid-flip
enters the flip in progress instead of starting it from the beginning.

The revealed card stays **indefinitely**. No automatic
fade-out - the operator decides. With `CONTINUE_JOKER` it shrinks
slightly and disappears in about 200 ms, the layer releases the question, and
after that the overlay removes itself from the document.

With `prefers-reduced-motion` there is **no flight, no strong scaling, and
no 3D flip**: the revealed card fades in over 150 ms in the center.
All functional states and locks are identical, and the result remains
in place exactly the same way until the click.

## The Console

The joker control sits in `OperatorControls` **between "Antwort einloggen"
("Log in answer") and "Aufloesen" ("Resolve")** - exactly where the joker
belongs: a player has buzzed but hasn't yet committed.

**The section IS the button.** The heading and `Joker ziehen` ("Draw joker")
appear together and disappear together; there is no reachable state in
which one exists without the other:

```ts
showJokerSection === showDrawJokerButton
```

The condition is `allowedCommands.includes('DRAW_JOKER')` - the same
rule function the server applies when the command arrives
(`evaluateJokerDraw`). The console derives nothing itself and checks nothing
twice. The section is therefore gone as soon as one of these conditions
applies:

* the answering player has already drawn their joker,
* no one has buzzed, or no one is currently allowed to answer,
* an intermediate view is running (correct, incorrect, or resolution animation),
* an answer is logged in or resolved,
* a draw is flying, lying, or currently taking effect,
* the question doesn't carry a joker.

A used-up joker gets **no** replacement text and no gray box: a
box saying "Joker" with nothing to do in it would only tell the operator that
he missed something.

| State | What is shown |
| --- | --- |
| drawable | heading `Joker` and `Joker ziehen` |
| only one outcome possible | plus `Bei dieser Frage kann nur der Publikumsjoker gezogen werden.` ("Only the audience joker can be drawn for this question.") |
| not drawable | nothing |
| `drawing` | `Joker wird gezogen …` ("Drawing joker …"), without heading; all answer and resolve buttons are gone |
| `revealed` | `Weiter`, without heading, in the place of every other `Weiter` |

The running draw is deliberately kept **outside** the section: while the
card is flying or lying there, there's nothing to draw, and a
heading "Joker" would be a false claim there. `Weiter` still has to be
there - `CONTINUE_JOKER` is the only command the engine accepts at that
point; without it the card would stay lying in the room and the question would
remain locked. It sends `CONTINUE_JOKER` with the
`sequenceId` and explicitly not the general `Weiter` action - it doesn't
load a new question.

The console does **not** name the result: it is shown large on the stage, and
a second time on the console would just be another place that has
to say it.

All of this comes from `view.joker`, i.e. from the same rule functions the
engine applies for the command. The console derives nothing itself: a button
that looks available leads to a command the server accepts.

## Files

**`hfroemmel/quiz`**

| File | What |
| --- | --- |
| `packages/core/src/contracts/joker.ts` | types, rules, `jokerDrawTiming`, `createJokerStates`, `jokerOf`, `activeJokerSequence`, `jokerTypeLabel` |
| `packages/core/src/contracts/state.ts` | `GameState.jokerByPlayer`, `GameState.jokerSequence` |
| `packages/core/src/contracts/commands.ts` | `DRAW_JOKER`, `CONTINUE_JOKER`, roles, rejection reasons |
| `packages/core/src/contracts/viewModels.ts` | `PublicJokerStatus`, `PublicJokerDraw`, `PublicOption.eliminated`, `OperatorJokerControl` |
| `packages/core/src/engine/joker.ts` | `evaluateJokerDraw`, `evaluateJokerContinue`, `drawJokerType`, `pickEliminatedOptions`, `drawableOptionIds`, `jokerBlockedCommands` |
| `packages/core/src/engine/engine.ts` | `drawJoker`, `continueJoker`, the reveal step as a timed transition, the lock during the draw, stock at `START_GAME` (only `operated`) |
| `packages/core/src/engine/allowedCommands.ts` | the joker commands, and what a running draw removes from the console |
| `packages/core/src/engine/projection.ts` | `jokerDraw`, eliminated answers from `applied` onward, the operator section |
| `packages/react/src/presentation/stage/jokerIcons.tsx`, `.module.css` | the two joker symbols, as a mask or as a drawing, along with their aspect ratios |
| `packages/react/src/assets/joker-*-icon.svg` | the symbols themselves |
| `packages/react/src/presentation/stage/AnswerList.tsx`, `.module.css`, `answerState.ts` | eliminated answers step back in place |
| `packages/react/src/presentation/stage/Score.tsx`, `.module.css` | group symbol instead of player number, with crossfade |
| `packages/react/src/presentation/stage/StageHeader.tsx`, `.module.css` | the `besidePlayer` slot and the derivation of the group symbol |
| `packages/react/src/presentation/animationPresets.ts` | step-back, crossfade, fade-out as tokens |
| `packages/react/src/presentation/texts.ts` | `stage.joker.*` |

**`hfroemmel/quiz-live`**

| File | What |
| --- | --- |
| `apps/web/src/assets/Jokerkarte_Livequiz_verfuegbar.png`, `Jokerkarte_Kinderquiz_verfuegbar.webp` | the cards of the two design worlds |
| `apps/web/src/components/jokerCardArt.ts` | which card goes with which world, along with proportions |
| `apps/web/src/components/JokerCard.tsx`, `.module.css` | the small card at the scoreboard and the header slot |
| `apps/web/src/components/JokerDrawOverlay.tsx`, `.module.css` | the draw: layer, flight, settle, fade-out |
| `apps/web/src/components/JokerFlipCard.tsx`, `.module.css` | the card with front and back |
| `apps/web/src/apps/stage/StageApp.tsx` | card and draw in the stage window |
| `apps/web/src/apps/operator/OperatorControls.tsx`, `.module.css` | the `Joker` section between log-in and resolve |
| `apps/web/src/apps/operator/OperatorApp.tsx` | draw in the preview; the old `JokerPanel` has been removed |

## Tests

| Suite | Count | What |
| --- | --- | --- |
| `packages/core/test/joker.test.ts` | 53 | one joker per player, nothing before the buzz, only the respondent, no second time, independent players, duplicate commands, the coin flip from injected randomness, hidden type until reveal, the server's reveal step, the question lock, `CONTINUE_JOKER` including a stale identifier, all 50:50 rules, image recognition from availability through the unused random source to the frozen image state, the audience joker and answer ownership, lifetime, every state in which the console allows or disallows a draw, the operator section, and a game without jokers |
| `packages/server/test/joker.test.ts` | 12 | the server owns the coin flip and the result, image recognition with `audience` across a restart, a snapshot for all roles, self-triggered reveal, applying only with `Weiter`, restart without a new draw, repeated command, stale identifier, the lock, the roles, and a game without jokers |
| `test/e2e/joker.spec.ts` (quiz) | 3 | eliminated answers stay in place and without a strikethrough, scoreboards unchanged, and the touch device knows nothing of it |
| `test/e2e/joker.spec.ts` (quiz-live) | 14 | heading and button always only together (across an entire question, on a player change, and after a used joker), the button only after the buzz and only once, the image question with the note and the audience joker, the kids quiz's own card, the order of sections, the flight from the correct scoreboard to the center, reveal only after the flip and staying in place, applying with `Weiter` without a new question, reloading both views, and the mode without motion |

Run with `pnpm test` and `pnpm test:e2e` in both repositories.
