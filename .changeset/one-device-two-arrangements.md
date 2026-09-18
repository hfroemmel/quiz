---
'@hfroemmel/quiz-react': minor
---

A second arrangement for the touch device: `<QuizGame layout="kiosk">`.

The device of a live event has an operator beside it. They call the round, they
see who buzzed first, and they say what happens next - so the screen can be
quiet: score card and buzzer sit together in the corner of the player they
belong to, and the head carries the word mark alone. A media table in a foyer
has none of that. Whoever steps up has never seen this quiz, and everything the
operator would say has to stand on the screen.

So the same component draws a second arrangement, chosen by the host:

  layout?: 'live' | 'kiosk'   // default: 'live'

In the kiosk arrangement the score cards and the counter stand together at the
top - `[Spieler|1][Punkte] [Frage|3/7] [Punkte][2|Spieler]`, and with one
player `[Frage|3/7][Punkte]` without a player cell, because a player alone is
not "player 1 of 1". The two buzzers become drawn push-buttons in the bottom
corners, and between them one field says what to do next: buzz now, whose turn
it is, or that a marked row is not yet an answer. The confirmation stands ON
the corner of the player it belongs to; with one player, where there is no
corner, it stands in the middle above the way out of the round, which sits at
the foot of that column instead of at the top of the screen.

THE BUZZER IS A DRAWING AND STILL A BUTTON: full area, touch, keyboard, an
accessible name and four states (`data-buzzer-state`) - taken back before the
release, red once the answers are up, unchanged for the player who got the
buzz, grey and disabled for the one who did not. What says the buzz is theirs
is the other corner going grey and their score card turning blue; the button
they are about to be handed does not change.

THE LIVE ARRANGEMENT IS UNTOUCHED, down to which events reach its buzzer, and
that is measured rather than asserted: `test/e2e/kiosk-layout.spec.ts` reads
both arrangements in the same harness, and the suite of the live device runs
unchanged beside it.

Two smaller additions belong to it: the interface strings `kiosk.hintBuzz`,
`kiosk.hintChoose` and `kiosk.hintSubmit` in both languages the package speaks -
overridable like every other one, because a hint field that cannot be
translated is a hint field in the wrong language - and `Score`, which can now
render its points cell alone (`pointsOnly`).
