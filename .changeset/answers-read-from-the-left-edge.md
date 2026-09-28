---
'@hfroemmel/quiz-core': patch
'@hfroemmel/quiz-content': patch
'@hfroemmel/quiz-themes': patch
'@hfroemmel/quiz-react': patch
---

An answer row reads from its left edge in every world. The scene hands its text
alignment down and centres it on the adults' stage, which a one-line answer
never showed - as a flex item the text is only as wide as itself. An answer that
wrapped took the full width of its row and stood centred between neighbours that
started behind their letter. The answer text now states its alignment itself,
because that is a property of a list and not of a variant.
