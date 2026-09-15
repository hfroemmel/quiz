---
'@hfroemmel/quiz-core': patch
'@hfroemmel/quiz-content': patch
'@hfroemmel/quiz-themes': patch
'@hfroemmel/quiz-react': patch
'@hfroemmel/quiz-kiosk': patch
---

Let the buzzers carry the accent of the world, and go neutral when they cannot act

Both corners of the touch device carry the same area now: the accent of the
world they are playing in. They are told apart by their place, left and right,
not by two tones of their own.

That took reading the accent where it applies. The two palette tokens
`--stage-playerOne` and `--stage-playerTwo` could not do it: a token that
substitutes `var(--color-accent)` at the document root freezes the default
world's tone and keeps it in the light world and in the kids' one. The device
therefore showed `#3392C5` while its own accent was `#0077B6`. The tokens had
exactly one consumer and are gone; the buzzer reads `--color-accent` itself.

A corner that cannot act is now the stage's frosted tile with muted lettering -
the same fill the neutral score card next to it carries. Coloured are only the
corners that are playing: a buzzer open for the taking, and the one held by the
player whose turn it is. Both keep their full fill instead of being dimmed to 35
percent, because in this world the area is the statement. The kids' world keeps
dimming, where the drawn card carries it.
