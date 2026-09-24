---
'@hfroemmel/quiz-core': patch
'@hfroemmel/quiz-content': patch
---

A question slot may name its questions, a question may carry two rubrics, and a
quiz a second mark.

A REHEARSED ROUND IS A LIST OF QUESTIONS, NOT A DRAW. A moderated show plays
rounds whose seven questions and their order are agreed in advance. Until now
every slot of a preset described what it wanted and the engine drew inside that
description, so a fixed programme could only be approximated. A slot filter
`questionIds` says it instead: it admits exactly the questions it names, and it
comes first among the filters - the others may narrow it further, never widen
it. Seven slots that each name one question are therefore a programme, played in
the order the slots stand in, and swapping the programme is a change to the
content alone.

The content check knows about it: a slot that names a question the corpus does
not have, or one that is disabled, or one outside the quiz's pools or audience,
is an error with the name of the preset and the slot - a mistake that would
otherwise surface as an empty slot on the evening. And a named slot no longer
draws the two warnings about a pool that is too small for a draw: it does not
draw.

THE RUBRIC OF A QUESTION IS ONE LINE, AND IT MAY COME FROM TWO COLUMNS. Editors
who grade their rubric write the broad subject in one column and the finer one
beside it. Both are the same field of the question, and the projection joins the
labels the configuration knows into one string - "Deutsche Einheit -
Mauerfall" - so every surface that names the rubric names the same one: the
board above the answers, the card between two questions, the interstitial before
the question. A rubric the configuration does not label is left out rather than
shown as an id.

A QUIZ MAY CARRY A SECOND MARK beside its motif (`badgeAssetId`). The
children's quiz of a region is the children's quiz and a region at once; the
poster in the room says both in one glance, with the drawn world's motif and the
region's coat of arms next to it. Like the motif, it travels as a url in the
offer, so the host decides how big it is and nothing else.

AND THE SHEET IMPORT READS WHAT AN EDITORIAL TABLE REALLY CONTAINS. The rubric
may be named as several columns, in the order the stage reads them. File names
arrive composed (NFC), so an umlaut a Mac decomposed on its way out of a Finder
window no longer produces a question whose picture is "missing" while it lies in
the directory. A row with exactly ONE filled option is a question answered out
loud, and that cell is its expected answer instead of a choice too short to
choose from - the solution of every picture question used to stand empty. And
questions with identical wording share a repetition group derived from that
wording, so the day's history counts them once however often the table carries
them.
