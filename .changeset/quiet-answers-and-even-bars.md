---
'@hfroemmel/quiz-core': patch
'@hfroemmel/quiz-content': patch
'@hfroemmel/quiz-themes': patch
'@hfroemmel/quiz-react': patch
---

Let spent answers fade, and give the start bars one height

An answer that is wrong or no longer available used to be repainted: quiet ink
on a thinned ground. It now simply steps back as a whole, at a third of its
strength - one value instead of two, and it reads the same on every ground the
stage can stand on.

The start bar and the way back are exactly as tall as each other and no longer
grow with their label, and the bar drops the edge it did not need. The window
that asks before ending a round sits on more air and takes its corner from the
stage's radius instead of a number of its own. On paper the surface behind that
window is more opaque, so the text on it stays legible where a card shows
through.

On the score card the group mark is smaller and carries the ink meant for
strong grounds; a player who is locked out but not on turn no longer takes a
colour of their own.
