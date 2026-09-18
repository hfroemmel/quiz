---
'@hfroemmel/quiz-react': patch
---

The kiosk hint field gets its column back.

The field between the two buzzers was a box of NO WIDTH: the middle column
centres its children, and this one's only child - the sentence - is positioned
absolutely inside it, so there was no content to take a width from. The
sentence then wrapped at the narrowest point it could find, one word per line,
in the middle of the screen: "Spieler / 1, / bitte / wähle / eine / Antwort."

It stretches to the column now. The tests had measured where the field SITS and
what it SAYS, and both were right all along - so the case added with the fix
measures the field against its column and counts the lines of the sentence in
it, which is the part no position and no text content could see.
