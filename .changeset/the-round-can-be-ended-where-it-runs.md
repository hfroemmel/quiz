---
'@hfroemmel/quiz-react': minor
'@hfroemmel/quiz-themes': minor
---

The round can be ended where it runs.

The device quiz always had a way to end a running game, but it sat in the top
right corner in the colours of the START MENU - the least visible thing on the
darkest screen - and it was worded as if it ended the game for good. It is a
chip at the top CENTRE now, `Runde beenden` with a cross before it, and where
it sits is the point: the corners of that screen belong to the players -
buzzers below, a host's own bar above - and a control that ends the round for
both of them belongs in neither hand.

IT LOOKS THE SAME IN EVERY VARIANT, and that is a decision: light grey with
dark blue on it, from two tokens that belong to no theme (`--stage-chip`,
`--stage-inkOnChip` - `Hellgrau` at 20 percent and `Dunkelblau` of the federal
spectrum, about seven to one). Whoever wants out of a round should not have to
find a different button on the dark stage than on paper or over the children's
drawing, and following the theme would have given it four appearances and, on
the dark ground, the worst one.

WHEN IT EXISTS IS UNCHANGED IN SUBSTANCE and now checked: only while a round
runs - not in the start menu, not on the waiting screen, not in the result
view, where another round and the way out are the offer - and never on a stage,
which is `StageScreen` and not this component. A game an operator runs is not
ended from a device either; that gate is the server's (`allowedCommands`).

`kiosk.endGame` and `kiosk.endGameQuestion` are `kiosk.endRound` and
`kiosk.endRoundQuestion`, in German and English: what the button does is end
the ROUND and return to the quiz's own start menu - the state is reset, not
parked. Escape now cancels the dialog, the confirming answer takes the keyboard
when it opens, and the chip carries a focus ring, so the whole way through can
be walked with the keyboard alone.

A host that draws its own way out of a running round still says so
(`chrome.abort`), but it should think twice: `onExit` leaves the application,
this ends the round. A round left standing behind a way home is a round the
next visitor walks into mid-question.
