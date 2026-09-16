---
'@hfroemmel/quiz-content': minor
---

The editorial sheet is read where it lies

An editorial team works in a Google table or in a workbook that arrives as a
file, and for the second case the way in was "export it as CSV first". That is
a manual step in front of an automated one: it loses the other sheets of the
workbook, and whoever forgets it imports the previous export.

`quiz-content import-sheet --xlsx <file> [--sheet <name>]` reads the file
directly, and `readWorkbook` is the reader behind it - the zip container, enough
XML to find the cells, and nothing else. No dependency: the libraries for this
format bring styles, number formats, formulas and a date epoch, none of which a
question sheet uses. A cell arrives as the text the sheet stored, a formula as
its last computed value, and a workbook in zip64 format stops the run with that
as the reason instead of reading the wrong bytes.

One bug of that reader is worth naming, because it is the kind that looks like
data: a styled but empty cell is written `<c r="F2" s="11"/>`, and a pattern
that takes its attributes greedily swallows the slash, reads the cell as an
opening tag and eats the cell behind it - the next column's raw value then
arrives under the empty column, unresolved, and the whole row is shifted by one.
The comparison against a hand-made export of the same workbook found it; the
test holds it.

**Two languages in one sheet.** `translations` in the mapping names the column
groups of the further locales: `question` and `question_en`, `A` and `A_en`. Two
sheets would be the alternative, and then nothing says which German question the
English one belongs to - the pairing lives in the row, so it is read from the
row. Only what a translation may change can be named; difficulty, pool,
audience, type and the correct option stay with the question, because a
translated row is the same question in other words. An empty group produces no
translation, and a group that forgets one option leaves that one in the base
language instead of dropping it.

**The legacy migration puts the background where it is read.** `info` of the
old files becomes `explanation.details` - the paragraph an audience reads after
the solution where nobody tells it. It used to land in `summary`, which is the
moderator's lead-in, and a lead-in of six lines is none. `Anmerkung` is not
content at all but one editor writing to another, and it becomes a note of the
migration report instead of a field of the product: on a screen it would be a
mistake, dropped in silence it would lose something somebody meant to be read.
