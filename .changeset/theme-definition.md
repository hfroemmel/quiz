---
'@hfroemmel/quiz-core': minor
'@hfroemmel/quiz-content': minor
'@hfroemmel/quiz-themes': minor
'@hfroemmel/quiz-react': minor
'@hfroemmel/quiz-kiosk': minor
---

A theme is one object, and it belongs to one quiz

Whoever wanted their own design had to know four things: the scene theme for
the stage, the stylesheet with the start menu's tokens, the font stacks and the
word mark as a property. Where they could not be reached they were copied - the
media table repeated three colour values as SCSS variables, with the comment
that whoever changes them there changes them here by hand.

`ThemeDefinition` (`@hfroemmel/quiz-themes`) states a design once: which
built-in set it starts from, what it overrides on the stage, above it and in the
menu, which fonts it brings, which word mark, and whether it stands still.
`resolveTheme` turns it into the values the components read, `themeStyles` into
the `@font-face` rules, and the schema refuses a misspelled token group instead
of reading it as "changes nothing". The built-ins are the worlds that exist:
`brightTheme`, `darkTheme`, `kidsTheme`.

`QuizProvider` (`@hfroemmel/quiz-react`) puts a theme on the quiz's own
element. Custom properties inherit downwards only, so two quizzes on one page
cannot recolour each other any more - until now a host design had to be written
onto the document, where it applied to every quiz on the page. Where a theme is
meant for the world being shown, it also wins against the package's own variant
rules: those declare their colours on the stage element and on the device's root
element, so the resolved theme is written inline onto exactly those two, and its
base decides whether the stage stands light or dark.

In the light variant the menu mirrors the stage - the selected card carries the
accent of a tapped answer, the button the green of "reveal". That relationship
now survives an override: a host that gives its stage a green accent gets a
green selection without naming it twice.

`useQuizTheme` reports the host's theme, `themeForSkin` picks the right one for
the world being shown - a theme for the adults' stage does not recolour the
children's paper. Hosts that pass nothing keep exactly what they had.
