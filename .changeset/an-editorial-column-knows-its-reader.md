---
'@hfroemmel/quiz-content': patch
---

A sheet may say which reader its background text is for.

An explanation has two readers, and the engine keeps them apart: on a stage it
belongs to the MODERATOR, who reads it out to a room, so the public view never
carries it; at a table there is nobody to read it out, and the two people
sitting there read it off the screen where the content asks for that
(`rules.showDetailsAfterSolution`). The first is `explanation.summary`, the
second `explanation.details`.

The sheet import could only fill the first. An editorial column of a table quiz
therefore arrived as the moderator's note, and the text nobody was going to
read aloud was never shown at all. The mapping names the field now
(`columns.details` beside `columns.explanation`): the same cell, a different
reader, and a corpus that means both can name both columns.
