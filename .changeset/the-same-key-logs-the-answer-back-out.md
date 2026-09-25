---
'@hfroemmel/quiz-core': patch
'@hfroemmel/quiz-content': patch
'@hfroemmel/quiz-themes': patch
'@hfroemmel/quiz-react': patch
---

The same answer key logs the answer back out. Logging in is a note and not a
decision - the decision is "Auflösen und bewerten" - so the key that set the
note now clears it, which is what the pressed button at the desk looks like it
would do anyway. A manual verdict behaves the same. Everything that hangs on
"nothing is committed yet" comes back with it: the resolve button goes dark, and
the joker can be drawn again.
