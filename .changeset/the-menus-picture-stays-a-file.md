---
'@hfroemmel/quiz-react': patch
---

The children's menu keeps its scene in a host's build - the picture is named where it stays a file.

The start selection carried the drawn scene from `Game.module.css`, and that
file is a CSS module: the library build bundles it and INLINES every asset a
rule names, whatever its size. The two megabyte drawing became nearly three
megabytes of base64 in `quiz-react.css` (3.2 MB in all), and a host's own
optimiser then dropped the declaration it could not handle - the media table
showed its children's menu on the dark ground of the adults' selection.

The rule stands in `styles/stage.css` now, which the package COPIES beside
its assets, so the `url()` stays a file - the same route the stage's own
background has always taken. The bundled stylesheet is 472 kB again, with no
inlined picture in it at all.

`[data-quiz-game][data-skin='kids']:has([data-quiz-start])` is what tells the
two screens apart: menu and running game are the same element with the same
attributes, and only the menu carries the selection inside it.
