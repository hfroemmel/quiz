---
'@hfroemmel/quiz-core': minor
---

The catalogue names the correction step, so the desk can say it.

The operator's two score-correction buttons are announced as "plus 50" and
"minus 50" - and that figure came from the engine's constant, not from the
package being played. A package that set `scoring.manualAdjustmentStep` therefore
moved the score by its own step while the desk announced 50, and a screen
reader read out a number nothing in the room used.

`catalog.rules` carries `manualAdjustmentStep` now, next to the two values that
were already there (`idleTimeoutMs`, `showDetailsAfterSolution`). It is the
resolved figure: the package's where it sets one, the engine's otherwise. No
behaviour changes - the step itself was always the resolved one, only its label
was not.
