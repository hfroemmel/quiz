---
'@hfroemmel/quiz-core': minor
'@hfroemmel/quiz-content': minor
'@hfroemmel/quiz-themes': minor
'@hfroemmel/quiz-react': minor
'@hfroemmel/quiz-kiosk': minor
---

The joker is drawn, not chosen

A player who has buzzed asks for their joker, the operator draws it, and the
SERVER flips a fair coin between the 50:50 and the audience joker. Nobody picks
the variant - not the player, not the operator, and no client. A choice would be
a tactical decision; a draw is a moment.

`USE_JOKER { playerId, jokerType }` and `RESTORE_JOKER` are gone. In their place
`DRAW_JOKER` (no payload at all: the coin belongs to the server, and the player
follows from who holds the buzz) and `CONTINUE_JOKER { sequenceId }`, which
applies what came out. A draw cannot be taken back - the joker is spent from its
first moment, and no command hands it back.

`GameState.jokerSequence` replaces `activeFiftyFifty` and carries the draw as it
runs: `idle → drawing → revealed → applied`. The turn of the card is a server
step, scheduled as a timed transition, so a client that reconnects mid-draw
finds the same phase as everybody else and never re-draws. The variant reaches
the clients with `revealed` and the eliminated answers with `applied` - early
enough to show, too late to give away.

A running draw holds the question: logging, resolving, continuing and buzzing
are refused and are not offered in `allowedCommands`.

`PublicOption.hidden` becomes `PublicOption.eliminated` and is drawn as a line
struck across the answer; `PublicScore.joker` stays; `PublicQuizViewModel`
gains `jokerDraw`, and the operator's `joker` control is now one button rather
than four.

New in `@hfroemmel/quiz-react`: `JokerTypeIcon` with the two joker faces (the
audience shape doubles as the group mark that replaces the active player's
number while an audience joker is in effect), and the timings for strike,
marker crossfade and dismissal in `presentationTiming`.
