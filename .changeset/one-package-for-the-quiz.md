---
'@hfroemmel/quiz-core': minor
'@hfroemmel/quiz-content': minor
'@hfroemmel/quiz-themes': minor
'@hfroemmel/quiz-react': minor
'@hfroemmel/quiz-kiosk': minor
---

The playable quiz lives in quiz-react, and the old names are gone

**One package fewer.** `QuizGame`, `StartMenu` and `deviceStartMenu` are
exported by `@hfroemmel/quiz-react` now. The split never drew a line: the
device's screen is built from the same scenes, the same sounds and the same
texts as the stage's, and every host that showed a quiz installed both halves
anyway. What remained of the difference was a component name.

`@hfroemmel/quiz-kiosk` still points at the new place, so an installation can
follow at its own pace - the same one release of grace every renamed export in
these libraries got:

```diff
- import { QuizGame } from '@hfroemmel/quiz-kiosk'
+ import { QuizGame } from '@hfroemmel/quiz-react'
- import '@hfroemmel/quiz-kiosk/styles.css'
```

The stylesheet line simply goes: those rules travel in
`@hfroemmel/quiz-react/styles.css`, which a host showing a quiz already
imports. `@hfroemmel/quiz-kiosk/styles.css` is an empty file for this release
so that an unchanged import resolves instead of breaking a build.

**And the former names are gone** - twenty aliases that were kept "for one
release" when the identifiers were translated: `standardTexte`, `textFuer`,
`texteFuer`, `importiereTabelle`, `standardMapping`, `csvZuZeilen`,
`gueltigeSprache`, `fragenTextFuer`, `oberflaechenTexte`,
`uebersetzteBeschriftung`, `klemmeZoom`, the sound and image state types, and
`GameStart`, the start screen that `StartMenu` replaced. Nothing in the four
applications used any of them.

WHAT STAYS, against the plan's own list: `audience`, `playerCounts` and
`idleTimeoutMs` on `QuizGame`, and `brandWordmarkUrl`. The first three are
properties of an INSTALLATION, not of the content - which audience a device
plays in, how many people stand at it, how long it waits before it ends a game
nobody is playing. The content answers them where it can
(`quizzes[].playerCounts`, `rules.idleTimeoutMs`), and the props narrow that
per device; removing them would move a table's setting into the question set it
shares with the hall. And the word mark as a file is what a host needs when it
shows the mark OUTSIDE the stage - the stage overview of the live quiz does
exactly that.
