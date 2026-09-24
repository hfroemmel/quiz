---
'@hfroemmel/quiz-react': patch
---

The kiosk menu's ground comes from the palette, and the drawn world's ink with
it.

Five colour values stood written out in the stylesheets of the game and the
stage, which is the one thing this colour system does not allow: a value in a
component is a second copy of the palette, and the guard test in the themes
package names every one of them.

THE START AND WAITING SCREENS STOOD ON A GREY OF THEIR OWN. `#eee` was neither
of the two grounds the palette commissions - nearly the paper in the light
variant, and a light grey plate under a dark menu in the other two, which is
what it looked like in a dark foyer. They now take `--start-bg-top`, the paper
this menu is given, and fall back to the stage's own ground where a variant
names none: white in the light world, the commissioned red in the red one, the
plain dark ground in the dark one. The children's world is untouched - it paints
its paper gradient itself, under its drawing.

AND THE DRAWN WORLD WRITES IN ITS OWN INK. The buttons and panels of the
children's menu named black directly; they take the ink its palette states.
The selected answer row and the number of the player on turn named white; both
are type on an illustration, which is exactly what `--stage-inkOnMotif` is for -
the token the checkmark on the right/wrong disc and the licence line over a
photo already use.

What changes on screen is that ground, and nothing else: white instead of
almost-white on paper, and the stage's dark ground instead of a light grey plate
in the dark and the red variant. The four inks are the values their worlds
already name - measured in all three variants and in the drawn world.
