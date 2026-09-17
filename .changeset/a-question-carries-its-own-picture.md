---
'@hfroemmel/quiz-core': minor
'@hfroemmel/quiz-content': minor
---

A question carries its own picture, and a video is a step in front of it.

TWO CHANGES, AND THEY ARE THE SAME CHANGE: both take something off the type
system that was never a type.

**The medium goes on the question.** `media: { imageAssetId, videoAssetId }` is
replaced by `image?: { filename, credit }` and `video?: { filename, credit }`.
The asset id in between existed only to find a file name behind it, and it
forced every editorial picture into `assets.json` as a second declaration -
with a generated key nobody reads and a licence line far from the file it
belongs to. The editorial table already has both columns next to each other
(`img_filename`, `img_credit`), and the import carries them straight through.

`assets.json` stays, for what the HOUSE brings: word marks, start visuals, quiz
motifs. Those are few, the configuration points at them by id, and they are
reused - which is what a directory is for. Two findings disappear with the
question's id: `asset-reference` (an id nothing declares) and `asset-kind` (an
id declared as the wrong kind). A question names a file, and the only question
left about it is whether it is there.

**A video is no longer a presentation type.** `video-then-question` is gone
from `questionPresentationTypes`. It made the clip the presentation: a question
with a video in front of it was a text choice afterwards, and a video before an
image reveal was a sentence nobody could write. Now any question may bring a
`video`, the clip runs first, and the question follows in its own form. A slot
that wants one asks for one: `filters.hasVideo` - `true` demands, `false`
excludes, absent means it does not matter, the same as every other filter here.

WHAT AN APPLICATION CHANGES:

    - question.media.imageAssetId  ->  question.image.filename
    - question.media.videoAssetId  ->  question.video.filename
    - questionType: 'video-then-question'  ->  any type, plus a video
    - filters.questionTypes: ['video-then-question']  ->  filters.hasVideo: true

And its media resolver is handed a FILE NAME instead of an asset id:
`new LocalQuizRuntime({ media: (filename) => url })`. The package route follows
(`/media/questions/reichstag.jpg`), which is what a server resolved the id to
anyway - one indirection fewer on the same path, with the same guard against
reaching outside the asset directory.

The sheet mapping gains what the table actually has: `image`, `imageCredit`,
`video`, `videoCredit`, the directories the files live in
(`defaults.imageDirectory`), and `correctOption` for a table that does not mark
its answer but orders it - the first option is the right one, which beats
matching the answer's text and landing on the wrong option when the answer
happens to read "B" or "2".
