---
'@hfroemmel/quiz-core': patch
---

`ContentService.assetFilename` is gone.

It answered "which file belongs to this id", and a question has no id for its
medium any more - it names the file. The one caller was the stage server's
media route, which now takes the file name straight from the request. Nothing
in the packages looked a file name up by id after 0.21.0; this removes the
method that said otherwise.
