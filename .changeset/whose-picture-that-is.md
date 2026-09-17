---
'@hfroemmel/quiz-content': minor
---

The import says whose pictures are still unclear.

A question's image is somebody's work and the licence line belongs with it.
Validation has warned about a missing one for a while, but at the end of a
build report it is a research job; at the import it is a question whoever just
read the workbook can still answer, with the mail the picture came in still
open.

`uncreditedImages(questions, assets)` is the rule, and it is now the only place
it lives - the validation asks the same function, so the two cannot drift.
`quiz-content import-sheet` reports what it finds, per question, and says which
of the two problems it is: a medium declared without a credit, or one that is
not in `assets.json` at all.

Only the IMAGES OF QUESTIONS. A word mark and a quiz motif come from the house
itself and nobody researches those; a rule that fires on every asset without a
credit is a rule people switch off.
