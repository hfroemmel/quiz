---
'@hfroemmel/quiz-content': patch
---

`content build` names the quiz types it wrote.

The version of a package is a counter of the builds in its output directory: a
fresh `content/dist` starts at 1.0.0, every build adds one, and the number
therefore says nothing about the content - the same corpus carries different
numbers on two machines, and two different corpora can carry the same one.

So the build now prints the offer it wrote, id and label:

    Quizpaket 1.0.3 geschrieben nach …/content/dist
    Pruefsumme: cf02fac8cb34a09d...
    Quizarten (6): dbt "Bundestags-Quiz", sed "Grenzen überwinden", …

That line ends the commonest confusion around this pipeline. The source is
versioned and the package is not, so a forgotten build shows itself as a room
full of the previous offer - and nothing in the output said which offer had
just been written.
