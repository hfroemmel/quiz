---
'@hfroemmel/quiz-core': minor
'@hfroemmel/quiz-content': minor
'@hfroemmel/quiz-themes': minor
'@hfroemmel/quiz-react': minor
'@hfroemmel/quiz-kiosk': minor
---

Lifelines: a 50:50 and an audience lifeline per player

Two lifelines per player per game, spent once each, reset only by a new game.
The rules, the state and the commands live in the core; the status display is a
React component both the live stage and a kiosk use.

OFF UNLESS A HOST SWITCHES THEM ON. `LifelineConfig` belongs to the
installation, not to the game state: without it no dots, no commands, and not
one element more in the DOM than before. `LocalQuizRuntime` and `QuizService`
both take it; `activationMode` decides whether the operator triggers a lifeline
for a player or the player taps it themselves.

New commands `USE_LIFELINE` and `RESTORE_LIFELINE`, new snapshot fields
`PublicScore.lifelines`, `PublicOption.hidden`,
`PublicQuizViewModel.activeFiftyFifty` and `OperatorQuizViewModel.lifelines`,
new events `lifelineUsed` and `lifelineRestored`. The exported `Lifelines`
component renders the status dots and can optionally be interactive.
