---
'@hfroemmel/quiz-core': minor
'@hfroemmel/quiz-content': minor
'@hfroemmel/quiz-themes': minor
'@hfroemmel/quiz-react': minor
'@hfroemmel/quiz-kiosk': minor
---

Show the kids world the same way in every host

The character, the pause card and the gap beside the question picture used to
come out differently depending on where the stage was running. The world now
decides all three, and the host decides nothing.

The character is the one `Mascot` component with the one asset it always was;
what kept it off the device were two rules keyed on `.stage--touch` - a
`display: none` and a content width of 100 %. Both are gone. Instead, scene and
figure share a new `.sceneArea`, and on touch that area is the 16:9 island with
its own size container. The figure therefore measures itself against the scene
in every host and stands in the same place of the same composition, in the hall,
on the device and in the embedded app, with one player or with two.

The counter and the category before a question are one drawn card now
(`.pauseCard` around `[data-pause-progress]` and `[data-pause-category]`), with
the counter as the loud part. Adults keep the plain stack - there the wrapper is
`display: contents` and changes nothing. Timing and scene transitions are
untouched: the pause still fades through in 400 ms.

The picture column of question and solution is as wide as the picture (`auto
minmax(0, 1fr)`) instead of a fixed 38 % share. The share left slack inside the
column - over a hundred pixels on the device - which looked like a much wider
gap. The distance to the question panel is now `--kids-stage-gap` and nothing
else, in every host.
