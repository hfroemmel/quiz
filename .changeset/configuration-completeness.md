---
'@hfroemmel/quiz-core': minor
'@hfroemmel/quiz-content': minor
'@hfroemmel/quiz-themes': minor
'@hfroemmel/quiz-react': minor
'@hfroemmel/quiz-kiosk': minor
---

Put everything a start menu shows, and the rules of the house, into the configuration

Two things were in the wrong place. What the start menus show - which player
counts a quiz offers, which motif its card carries, how the cards are ordered -
lived in component properties and in lists inside the hosts: the kiosk took
`playerCounts` as a property, the Bundestags app kept its own offer list, the
live stage its own artwork table. And the rules of the house - points, timings,
jokers, idle watch - were constants in the code, so a second house meant a
second build.

Both are now in the quiz package.

`quizzes[]` grows by `playerCounts`, `artworkAssetId`, `emphasis` and `order`.
`deriveStartMenu(config, catalog, locale)` turns them into one model: offers in
menu order with their labels resolved, the player counts across all offers, the
language list, and per offer whether it can be started right now - with a
reason, before the attempt, instead of a rejection afterwards. A package
without `quizzes` is still a valid package: then its audiences are the offer, so
the model is never empty for a package that plays.

`config.rules` sets only rules the engine already has: scoring, the timings that
drive the phases, jokers on or off, the idle timeout and whether the detail text
gets its own step after the solution. Every value defaults to the constant used
until now, so a package without `rules` plays exactly as before - that is what
the new tests pin down. The bounds are part of the schema; the reveal grid and
the parameters of the selection algorithm stay in code, because they are
fairness and not taste.

For hosts nothing breaks: `QuizGame` still accepts `playerCounts` and
`idleTimeoutMs` as properties and they still win. Where they are absent, the
package answers.
