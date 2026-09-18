---
'@hfroemmel/quiz-core': patch
'@hfroemmel/quiz-content': patch
'@hfroemmel/quiz-themes': patch
'@hfroemmel/quiz-react': patch
---

Ship the font families as tokens, and set the kiosk buttons in the display face

The families were declared in the harness alone. Every package stylesheet asked
for `--font-ui` and `--font-display`, but no published package carried them: in
an application both fell back to the browser's default face, although
`fonts.css` had loaded the files. They now stand in that same file, next to the
`@font-face` rules that load them, and the harness reads them from there like
any other host. `--font-ui` points at `--font-display`, so the one family is
named once and the control frame keeps a name of its own to be changed by.
`--font-heading` and `--font-body` are a fallback there - in operation a theme
still sets them on the frame.

On top of that the start menu's buttons and titles, the submit button and the
end-of-round button ask for the display face instead of the stage serif, and the
start menu's cards, bars and labels are set a little tighter: smaller type for
the buttons of both worlds, shorter cards, a checkmark without its disc sitting
in the middle of the card edge, and more air between brand board and title.

Cards and the start bar take the corner of the stage, which the screens without
a stage can now name too: they stand beside the stage rather than inside it and
so never inherited its radius.
