---
'@hfroemmel/quiz-core': patch
'@hfroemmel/quiz-content': patch
'@hfroemmel/quiz-themes': patch
'@hfroemmel/quiz-react': patch
---

Center the scene on the stage

A scene no longer hangs from the top edge of its box: it sits in the middle of
the space between header and footer. The touch stage centers its content for the
same reason instead of pushing header and scene apart, and the scene box keeps a
hand's width of air below it so it does not run up against the fixed footer.

In the person composition this only works once the picture column stops
stretching over the whole height; the answers underneath move closer together to
match, and an answer row no longer parts letter and text by a gap of its own.
