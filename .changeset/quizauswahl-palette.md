---
'@hfroemmel/quiz-core': minor
'@hfroemmel/quiz-content': minor
'@hfroemmel/quiz-themes': minor
'@hfroemmel/quiz-react': minor
'@hfroemmel/quiz-kiosk': minor
---

Add the colours of the quiz selection, and the wordmark as a file

The live quiz replaces its start form with a screen of five quiz cards, and two
things it needs belong in the packages rather than beside them.

`quizSelectPalette` is the colour set of that screen, prefixed `quiz-select-` in
the generated palette. It is its own set on purpose: the operator shell is dark
and wants nothing, the stage belongs to the quiz that has not been chosen yet,
and the device start screen is a different design altogether.

`brandWordmarkUrl` exports the bundled Bundestag wordmark as an address. The
stage header lays it over a colour area as a mask so it follows the ink of the
world; a host that simply needs the file - a selection screen on a light ground -
now gets the same one instead of keeping a second copy.
