---
'@hfroemmel/quiz-core': patch
'@hfroemmel/quiz-content': patch
'@hfroemmel/quiz-themes': patch
'@hfroemmel/quiz-react': patch
---

The wrong-answer mark takes its two exceptions from the palette instead of
naming colours itself: the drawn world's disc is that world's strong red
(`--color-primary`), and on the red stage the disc takes the light ink of type
on a motif while the cross carries `--color-incorrect` - the very tone this
variant's ground is made of. Both were written out as values, which the palette
guard refuses, and both were one hex step off the commissioned colours.
