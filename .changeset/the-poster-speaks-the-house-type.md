---
'@hfroemmel/quiz-core': patch
---

The start view no longer wears the look of the quiz played last.

The state of a game that is over lives on - it carries the log, the language and
the sound switch - and its theme lived on with it. The projection read the quiz
and the audience out of that state even after the abort, so the view model
reported the finished game's theme for the `start` scene: after the children's
quiz the room's poster kept writing in its handwriting until the next game of
the show was started, because the host puts `--font-heading` and the stage
colours on the frame that holds the start view too.

`resolveTheme` now asks a state only while its game is running. Once it is
aborted the answer is the one the view gets before the first game: the theme of
the audience the device names (`previewAudienceId`) or the first one in the
configuration. The start view is the same announcement before the first game and
between two games, and it is now told so exactly once - the self-service menu of
`<QuizGame>` has been reading the audience out of the catalogue for this very
reason, and the two no longer disagree.

The language is deliberately not part of this: whoever switched the device to
another language keeps it after the game.
