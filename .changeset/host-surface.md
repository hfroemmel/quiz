---
'@hfroemmel/quiz-core': minor
'@hfroemmel/quiz-content': minor
'@hfroemmel/quiz-themes': minor
'@hfroemmel/quiz-react': minor
'@hfroemmel/quiz-kiosk': minor
---

Three things a host had to build itself

**Reading a package.** `loadQuizPackage(raw, { rootDir })` parses manifest,
configuration and questions, builds the asset map and hands back the package.
Four hosts carried the same twenty lines; the rule they implement matters - a
package that is only half read fails at the start and not in the middle of a
game, where nobody can intervene.

**Resolving media.** `LocalQuizRuntime` takes a `media` resolver. An
application whose media live in its own bundle - imported by a bundler,
addressed by a protocol of its own - used to replace a method of the content
service from outside, and a rename in the package would have broken it
silently. A resolver that answers with nothing means: no medium for this id, so
the question runs without an image rather than with a broken frame.

**Its own frame.** `<QuizProvider chrome={{ brand, abort, settings }}>` says
which parts of the frame the host supplies itself - word mark, the way back,
the settings gear. What it takes over is not rendered at all; until now such a
host hid them with three `display: none` rules that had to be kept in step with
the package's markup.

And one word for the room: the quiz root and the stage element carry
`data-surface="light|dark"`, so a host can recolour its own bar around the quiz
without knowing the package's worlds - `data-theme` names a world, and the
children's paper is light too.
