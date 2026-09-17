---
'@hfroemmel/quiz-themes': minor
---

Only the Federal Government's colour spectrum, everywhere but the children's world.

The stage already carried nine values from the style guide - the three signals
and their light counterparts. Everything else was mixed by hand: the dark
ground, the near-whites of the light variant, the desk's greys, the start
menu's four greens, a violet glow, five card surfaces. Written as literals,
there was no way to tell the two apart and no way to state the rule.

`federalSpectrum.ts` now holds the spectrum - the seventeen tones with the HEX
values the style guide states, and the two rules that make every other value
from them: lightened towards white or darkened with black, in the steps 100,
80, 60, 40 and 20 percent. `palettes.ts` names tones and steps instead of
numbers (`ci('blau', 80)` is "Blau, Abstufung 80 %"), so there is no literal
left in it outside the children's world, and a guard test measures every
palette against the set the two rules can produce - a veil counts as its own
colour, a gradient is checked stop by stop.

THE STEP RULES ARE PROVEN, not assumed: they reproduce all nine values the
palette already attributed to the style guide, and the published Blau ladder
(100 % #0077B6, 80 % #3392C5, 60 % #66ADD3, 40 % #99C9E2, 20 % #CCE4F0) to the
digit.

WHAT MOVED, and by how little: each value became the nearest step to the one it
replaced, so this is conformance and not a redesign - the dark ground is three
steps of `Dunkelgrau` within seven to eighteen units of where it was, the light
variant's near-whites are `Hellgrau` at 20 to 60 percent within five to twelve.
Only where a role names a colour does the role win over the distance: the
desk's green and red are the stage's signals now, the start menu's grades are
`Grün`, `Hellgrün` and `Violett`, and the five cards of the offer overview each
carry a step of the tone their quiz is recognised by - house grey, light blue,
`Dunkelblau`, gold for the Unity banner, red for the Bremen coat of arms. Two
of those five were near-whites told apart only by their warmth, which no
spectrum reproduces. The motifs on the cards keep their own colours: a flag is
content, not a token.

THE RED VARIANT'S GROUND is `Rot` at 80 percent (#CD3363) instead of the
#ca2f56 it was specified with - fourteen units, a tone nobody tells apart at
two metres, and a colour the house actually has.

THE CHILDREN'S WORLD IS EXEMPT, by decision: its colours come from its own
illustrations, and a drawn frame does not follow a spectrum. The guard test
names that exception and asserts it is real - if the drawn world ever stopped
carrying colours of its own, the exception would be pointless.
