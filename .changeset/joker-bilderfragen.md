---
'@hfroemmel/quiz-core': minor
'@hfroemmel/quiz-content': minor
'@hfroemmel/quiz-themes': minor
'@hfroemmel/quiz-react': minor
'@hfroemmel/quiz-kiosk': minor
---

Allow the joker on picture questions, where only the audience joker can come out

A question without answer options has nothing for a 50:50 to halve, so until now
it refused the draw altogether. It is now drawable, and the only result it can
produce is the audience joker - asking the room is the one help that means
anything there.

New `drawableJokerTypes(state)` says which variants a question can produce, and
`drawJokerType(random, possible)` takes that set: with a single possibility it
returns it and never touches `random`, so a draw cannot come out as something
the question cannot carry. `OperatorJokerControl.onlyType` carries the same
information to the desk before the draw.

A choice question with too few open answers stays undrawable, with the reason it
had before.
