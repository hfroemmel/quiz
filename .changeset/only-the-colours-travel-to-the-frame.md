---
'@hfroemmel/quiz-react': patch
---

Only the colours of a world travel to the frame - the type belongs to the stage.

The line that gave the running game its world (0.27.8) was one word too wide:
it handed down the world's colours AND its type. The type then reached the
frame around the stage, where the head above the answers is measured against
the area it may take - and a different heading font is different metrics, so in
the kiosk layout the head grew over the first answer and swallowed the tap on
it.

With a game running, the type of the world sits on the stage, which states it
itself, and the surfaces around it stay the host's frame. Only the `--color-*`
set travels now, which is all the confirmation dialog needed to be readable.

**Anyone on 0.27.8 should take this one too**: the ink of the children's dialog
is right there, but a kiosk layout can lose the first answer to its own head.
