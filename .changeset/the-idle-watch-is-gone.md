---
'@hfroemmel/quiz-core': minor
'@hfroemmel/quiz-content': minor
'@hfroemmel/quiz-themes': minor
'@hfroemmel/quiz-react': minor
---

The idle watch is gone. A self-service device used to abort a running game after
`rules.idleTimeoutMs` without a touch and put the selection back up; a question
carries no time pressure on purpose, and that watch was the one thing that gave
it some - at an attended table it ended games in the middle of a conversation
about the question. Removed with it: the `idleTimeoutMs` property of `QuizGame`,
the `rules.idleTimeoutMs` field of the package configuration (the schema is
strict, so a `config.json` still carrying the line has to drop it) and
`catalog.rules.idleTimeoutMs` in the view model. A game now ends when a person
ends it.
