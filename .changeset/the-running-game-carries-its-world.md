---
'@hfroemmel/quiz-react': patch
---

The running game carries its world's colours - so the confirmation is readable
in the children's quiz.

Everything outside the stage belongs to the quiz's root element: the
confirmation before a round is ended, the settings window, the foot of the
kiosk layout. The stage declares the world's tokens on ITSELF
(`.stage--kids`), so it was themed either way - and this root was not. While a
game ran it handed down whatever `--color-*` the HOST has, and on a dark host
that put white ink on the drawn cream paper of the dialog: "Diese Runde
wirklich beenden?" and the button beside it were unreadable, in the one moment
somebody wants out of a round.

The start screen and the waiting screen have carried the world's variables all
along; the running game is the third of the three and now carries the same
line. Measured in both worlds: the children's dialog turns from white to its
own dark ink, the adults' stays exactly as it was.
