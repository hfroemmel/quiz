---
'@hfroemmel/quiz-core': minor
'@hfroemmel/quiz-content': minor
'@hfroemmel/quiz-themes': minor
'@hfroemmel/quiz-react': minor
---

`@hfroemmel/quiz-kiosk` is gone. There are four packages.

IT WAS A POINTER FOR ONE RELEASE, and that was the promise. In 0.19.0 the
playable quiz moved into `@hfroemmel/quiz-react` and the kiosk package stayed
behind as a re-export with an empty stylesheet, so that an unchanged
application kept building while it took the release at its own pace. That
release has happened. The pointer is now deleted rather than kept, because a
package that only names another place is a place people keep arriving at.

WHAT AN APPLICATION CHANGES, and it is two lines:

    - import { QuizGame, StartMenu, deviceStartMenu } from '@hfroemmel/quiz-kiosk'
    + import { QuizGame, StartMenu, deviceStartMenu } from '@hfroemmel/quiz-react'

    - import '@hfroemmel/quiz-kiosk/styles.css'

The second import is not replaced by anything: since 0.19.0 the game's own
rules travel in `@hfroemmel/quiz-react/styles.css`, which every application
showing a quiz already imports. Nothing else moves - the components, their
props and their behaviour are the ones from 0.19.0, byte for byte. Remove the
dependency from `package.json` and the swap is complete.

THE FOUR PACKAGES ARE NOW FOUR EVERYWHERE, not four plus a leftover: the
fixed-version set of the changeset configuration, the tarball verification,
the tag script and the typecheck each name exactly the packages that exist. The
two scripts behind the release gave up their German identifiers on the way,
which was the last of them outside a user-visible label.
