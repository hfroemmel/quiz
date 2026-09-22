---
'@hfroemmel/quiz-react': patch
---

The in-between card names the question it explains, and reads from the left.

The card covers the stage, so the rubric and the question were gone from the
moment it opened - and a background of three sentences read as a text without a
subject. Both stand at the top of the card now, in the voice of the board they
cover: the small bold rubric above, the question in the serif of the stage, in
the children's world both in its hand. They are one group, closer to each other
than to the paragraph under them.

EVERYTHING ON THE CARD READS FROM THE LEFT. Centred is a form for one short
line; three blocks of different lengths give a reader three places to start that
way. The way onward moves with it: it stands where the reading ends, at the right
end of the card, and is a little wider than the stage's smallest button so that
one word does not sit in a box the size of the word.

AND ITS LABEL NAMES ITS OWN INK. `stage-button--primary` says the ink of a
primary button with specificity zero, so that a component can refine the button
without depending on stylesheet order - but a host's own
`button { color: inherit }` beats zero, and the label then inherited the ink of
the card and stood black on the black box. In some hosts, which is the worst
kind of invisible.

WHAT THE CARD SHOWS IT ALSO KEEPS UNTIL IT IS GONE. The round moves on the
moment the button is pressed, so the next question is already in the view model
while the card fades - a question read live would leave the card with an empty
heading in its last moment. Background, rubric and question travel as one, from
the frame it opens in to the frame it leaves in.
