---
'@hfroemmel/quiz-themes': minor
'@hfroemmel/quiz-react': minor
---

A red variant of the adults' stage - a third choice next to light and dark.

IT IS THE DARK STAGE WITH ONE THING EXCHANGED: the dark grey of the ground
becomes `#ca2f56`. `redPalette` therefore names five tokens and nothing else -
the four ground surfaces and the operator's control band - and everything else
stays the dark variant's, by the same mechanism the light one uses.

WHY NAMING ONLY THE GROUND IS ENOUGH. The surfaces of this stage are veils, not
paint: tile, option and their quiet forms are white at five to nine percent.
Over the red they become lighter red by themselves, and the depth between
ground, board and answer row survives the exchange without a single new value.
No gradient is invented either - all four ground tokens carry the same tone.

THE THREE SIGNALS STAY, and that is a decision: blue marks the selection and the
player whose turn it is, green the right answer, red the wrong one. A red ground
makes the wrong-answer red harder to tell apart than it is on grey - the one
place this variant is weaker than the other two - and moving the token would
break the agreement that a signal means the same thing in every variant.

`stageThemes` is now three values, so anything that builds a switch from that
list offers the third one without a change. The screens in front of the stage
follow it: the device's start menu gets the same ground with its two coloured
lights switched off, and the offer overview of a room - the `--quiz-select-*`
family, light until now - gets a dark and a red variant. Its cards keep their
colours in both, because those stand for their quizzes and not for the variant;
that is what the new `ink-on-card` and `meta-on-card` are for, so the text on a
light card stays dark while the heading above it goes light.

AND `data-surface` NOW ASKS ABOUT THE INK, not about the hue. It used to name
the one dark variant there was; the red one is dark in the sense that matters
for a host recolouring its own frame - it carries light text - so the light side
is named instead, and a further strong ground lands on the right side by itself.
