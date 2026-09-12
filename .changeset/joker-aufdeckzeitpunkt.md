---
'@hfroemmel/quiz-core': minor
'@hfroemmel/quiz-content': minor
'@hfroemmel/quiz-themes': minor
'@hfroemmel/quiz-react': minor
'@hfroemmel/quiz-kiosk': minor
---

Reveal the drawn joker when the card reaches the middle

`jokerRevealCompleteMs` becomes `jokerRevealAtMs`, and
`PublicJokerDraw.revealCompleteMs` becomes `revealAtMs`. Both now mark the
moment the card arrives in the middle rather than the end of the whole draw.

The reason is what a client may know: the variant is deliberately withheld while
the card is flying, so a card that turned before `revealed` arrived showed an
empty back and filled the result in afterwards. The server now holds `drawing`
for the flight alone, and the snapshot that carries the result is the one the
stage turns the card on.
