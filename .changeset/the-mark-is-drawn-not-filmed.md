---
'@hfroemmel/quiz-core': patch
'@hfroemmel/quiz-react': minor
---

The right/wrong mark is drawn, not filmed.

Correct and incorrect were delivered WebM clips with an alpha channel, one per
outcome. They are vectors now (`AnswerResultAnimation`): a disc that scales in
over 480 ms with a short overshoot, then the symbol drawn along its own path -
`pathLength` normalises it, so the check mark and the cross need no timing of
their own. Reduced motion keeps the finished mark and drops the movement, as
the clips' still frame did.

WHY IT MATTERS BEYOND THE MOTION: a file cannot follow a theme. The clip's
turquoise and its red were baked in, so the stage showed them whatever palette
was running - and with a third stage variant that became visible. The disc takes
`--color-correct` and `--color-incorrect`, the same tokens the answer rows
carry, and the symbol the light ink that goes on a strong area. The children's
world therefore gets its own green instead of the adults' turquoise, without a
second file, and no decoder is needed to show a circle and a check mark.

THE MOMENT KEEPS ITS SIZE. The clips carried a lot of transparent margin - the
check mark swung out wide with sparks, the cross sat tight in its frame - so two
frames of 34 and 16 cqw put two discs of the SAME size on the stage, and the
word below had to be pulled back toward each of them by a different share. One
size (14.2 cqw, disc 92 percent of it) and one ordinary gap replace all of that;
measured against the old clips, the disc lands within a pixel of where it was.

`animationClips` therefore no longer carries `correct` and `wrong`, and the two
files are gone; `trophy`, `stars` and `question-marks` stay as they were. The
feedback phase durations stay too (`correctFeedbackMs`, `incorrectFeedbackMs`):
they were once matched to the clips, but what they are is the beat the room
needs to read the mark while the score counts up underneath it.
