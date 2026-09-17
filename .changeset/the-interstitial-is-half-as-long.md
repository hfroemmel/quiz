---
'@hfroemmel/quiz-core': minor
---

The screen before a question stands half as long.

`gameTiming.pauseScreenMs` is 1500 instead of 3000 milliseconds. It is the one
central value for that screen: the server schedules the switch to the question
from it (`pause-to-question`, in all three places a round reaches it), the
presentation mirrors it into `presentationTiming`, and no host and no mode
overrides it - `rules.timing.pauseScreenMs` could, and none of the five
packages does. So every quiz gets the shorter pace at once, on the stage, on
the media table, on the standalone device and in the collection.

NOTHING ELSE MOVES. The screen, the fade of its category and the transition to
the question are unchanged; the server simply schedules that transition
earlier. The counter is there from the first frame, and the category arrives
after one second (400 ms delay, 600 ms of fade) - so half a second of the
screen now stands still rather than two.

THAT SECOND IS THE FLOOR, and a test says so instead of a comment: the
category's arrival is compared against the duration, so a further shortening
fails rather than cutting the fade off. The note this value carried said one
and a half seconds had once been too short to read the category in; whoever
finds that again should raise this number rather than add a second one
somewhere else.
