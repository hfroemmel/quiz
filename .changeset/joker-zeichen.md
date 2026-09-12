---
'@hfroemmel/quiz-core': minor
'@hfroemmel/quiz-content': minor
'@hfroemmel/quiz-themes': minor
'@hfroemmel/quiz-react': minor
'@hfroemmel/quiz-kiosk': minor
---

Give the two jokers their drawn signs

The joker signs were placeholders: three outlined circles for the audience, a
split circle for the 50:50. They are now the drawn artwork - three figures with
the middle one carried forward, and the `50:50` lettering between two arcs.

Both signs keep the mask over `currentColor` as their default, and that is a
decision rather than a leftover. The 50:50 is lettered in a near-black grey; on
the dark stage of the adults' quiz it would sink into the ground, and the group
mark in a score card has to carry the colour of the digit it replaces, never one
of its own. A face whose ground is known to be light can ask for the drawing
with its own colours: `<JokerTypeIcon type="audience" tone="art" />`.

Neither sign is square, and they are not cut alike. `JokerTypeIcon` now sets
only the height and derives the width from the file, so both stand equally tall
wherever they appear together and neither is squeezed into a square box - the
audience mark would otherwise have stood beside the player number at 62 per cent
of its height. The proportions ship as `jokerIconRatios` for a host that shapes
its own box around the file.
