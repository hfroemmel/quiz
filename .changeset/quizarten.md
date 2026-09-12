---
'@hfroemmel/quiz-core': minor
'@hfroemmel/quiz-content': minor
'@hfroemmel/quiz-themes': minor
'@hfroemmel/quiz-react': minor
'@hfroemmel/quiz-kiosk': minor
---

Make the quiz type a configured value, not a decision spread over the screens

The desk picks ONE thing before an evening: which quiz runs. Until now that was
three pickers - audience, preset, pool - and lately five cards that each carried
their own `START_GAME` payload. Both said the same thing twice, in two places
that could drift apart.

`quizzes` in the quiz package is now that one thing. An entry names its audience,
its theme, its pools and the difficulty presets it offers, each as a separate
value: "Bremen-Quiz" is a line in the configuration, not a condition in a
component. `START_GAME` takes `quizId` instead of `audience`, and the server
resolves the rest and writes it into the game state - so a reload or a
reconnect reads the confirmed configuration back instead of recomputing it.

The difficulty choice is not a flag beside the list, it FOLLOWS from it:
`presetIds` with one entry means there is nothing to choose, more than one means
the operator chooses. `catalog.quizzes[].supportsDifficulty` hands that decision
to the form already made, and the server refuses a difficulty for a quiz that
offers none - and a missing one for a quiz that does.

`PublicQuizViewModel` gains `quizOffers`, the names of the quizzes on offer, so a
stage can announce to the hall what there is to play. Deliberately without
audience, pools, presets or theme: the stage should not be able to derive any
configuration, only to write the names on the wall.

The selection palette loses `shadow-lifted` and `focus`. Those five cards moved
to the stage, where they are a poster: nothing about them can be hovered,
focused or picked. A colour kept for a state that no longer exists is an
invitation to build the state back in.
