---
'@hfroemmel/quiz-core': patch
'@hfroemmel/quiz-react': patch
'@hfroemmel/quiz-themes': patch
---

The room learns what the desk has chosen, the result can be taken off the screen, and every photo names where it comes from.

THREE THINGS FOR THE EVENING WITH AN OPERATOR:

  1. `SELECT_QUIZ` - WHAT THE DESK HAS SET UP BUT NOT YET STARTED. The choice
     used to live in the console's own window, so the offer overview in the
     room knew nothing of it: the card the operator had picked was marked on
     their screen and nowhere else. It travels with the state now
     (`selectedQuizId` for the room, `quizSelection` with the level for the
     desk), so both mark the same card - and a console that reloads
     mid-evening finds its choice again. A start consumes it: the form says of
     itself that nothing is pre-selected there, and the next group should not
     find the last one's decision standing in it.

  2. `SHOW_START_SCREEN` - THE RESULT GOES, THE GAME STAYS. Between two rounds
     the operator talks, the audience changes, and two strangers' scores hung
     on the stage until somebody started the next game. The desk has a step of
     its own for that now; the game keeps its status, its log and its
     statistics, and only what the room is looking at changes
     (`resultClosed`). It is offered on the result view and nowhere else, once.

  3. THE LICENCE LINE OF A PHOTO travels with the picture - in the question
     and in the solution (`imageCredit`) - and the image frame shows it
     wherever a photo is shown. It is the smallest type in the scene: on the
     adults' stage under the picture in the quiet ink, in the children's world
     in its lower left corner in white with a light shadow, because the frame
     there is a drawing with nothing under it to write on. Where the content
     names no origin, nothing stands there.

AND A TOKEN FOR INK THAT LIES ON A MOTIF (`--stage-inkOnMotif`): white in
every world, for the mark on the right/wrong disc and for that licence line.
`inkOnStrong` follows the SURFACE of a variant, which on the bright stage
turned the checkmark black.
