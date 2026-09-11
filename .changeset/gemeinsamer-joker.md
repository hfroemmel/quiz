---
'@hfroemmel/quiz-core': minor
'@hfroemmel/quiz-content': minor
'@hfroemmel/quiz-themes': minor
'@hfroemmel/quiz-react': minor
'@hfroemmel/quiz-kiosk': minor
---

One shared joker per player, for the live quiz alone

Every player of an OPERATED game holds a single joker and may spend it either as
a 50:50 or as an audience joker. Spending either one exhausts that player's
joker for the whole game; it comes back only with a new game or the operator's
explicit reset.

LIVE QUIZ ONLY, WITHOUT A FLAG. `START_GAME` creates the supply only for
`flowProfile: 'operated'`, so a kiosk, a standalone build or a touch device
carries no joker state, no joker command and not one element more in the DOM
than before. `gameHasJokers(state)` is the single place that decides it.

New commands `USE_JOKER { playerId, jokerType }` and
`RESTORE_JOKER { playerId }`, both operator-only and server-validated. New state
`GameState.jokerByPlayer` and `GameState.activeFiftyFifty`, new snapshot fields
`PublicScore.joker`, `PublicOption.hidden`,
`PublicQuizViewModel.activeFiftyFifty` and `OperatorQuizViewModel.jokers`.

`StageHeaderSlots` gains `besidePlayer`: a relatively positioned frame around
each scoreboard, so a host can hang something behind a player's card without
widening the header. The live quiz uses it for its joker card.

This replaces the two separate lifelines, which were never released: the
`USE_LIFELINE` / `RESTORE_LIFELINE` commands, `LifelineConfig`,
`PlayerState.lifelines`, the `lifelineUsed` / `lifelineRestored` events and the
exported `Lifelines` component are gone.
