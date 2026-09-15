---
'@hfroemmel/quiz-core': minor
'@hfroemmel/quiz-themes': minor
'@hfroemmel/quiz-react': minor
'@hfroemmel/quiz-kiosk': minor
'@hfroemmel/quiz-content': minor
---

The background of a question, read where nobody tells it

An explanation is written for the moderator. They tell it, in their own words,
while the hall listens - which is why nothing of it ever left the server
publicly: a screen writing it out would compete with the person speaking.

At a device there is nobody to tell it. The two people at the table read it
themselves, and a quiz set up for that place now says so:
`rules.showDetailsAfterSolution` - the flag has been in the configuration since
the last release, and no component read it. With it on, the detail text travels
with the solution (`visibleSolution.details`), in the language of the question,
and the device gives it its own step.

`DetailsStep` (`@hfroemmel/quiz-react`, put in place by `QuizGame`) is that
step: the card covers the stage, carries the only way onward, and the round
waits until somebody has read it. Where a question brings no background there is
no step at all - an empty in-between screen would be worse than none. The round
is held from the moment the solution stands, not only once the card is there: in
those seconds the device's own way onward would be one thumb away from skipping
the step.

Of the explanation only `details` travels, and only in the solution scene. The
short version is the moderator's lead-in, the source is an editorial note, the
directing notes are stage directions - none of the three is meant for a player,
and the projection keeps them where they were.

Two smaller things came with it. The times of the step stand in its stylesheet
(`--stage-details-delay` beside `--stage-fade-duration`), so the component reads
how long its way out lasts instead of keeping a number of its own in step with
the CSS by hand - the host this step comes from carried a 220 and a comment
asking whoever changed one to remember the other. And a card lying on the stage
has a shadow of its own now (`--stage-cardShadow`): the distance to the ground
is a physical situation, the same in the dark world and in the bright one.

A host whose room wants a different card passes `renderAfterSolution` and draws
its own body. It is handed the text and the way onward; the holding of the round
and the withdrawn footer button stay with the package.
