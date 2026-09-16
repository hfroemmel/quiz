/**
 * @hfroemmel/quiz-kiosk - MERGED INTO `@hfroemmel/quiz-react`.
 *
 * The playable quiz used to be a package of its own, and the split never drew
 * a line: the device's screen is built from the same scenes, the same sounds
 * and the same texts as the stage's, and every host that showed a quiz
 * installed both halves anyway.
 *
 * This package therefore only points at the other one now, so that an
 * installation can follow at its own pace - the same one release of grace
 * every renamed export in these libraries got:
 *
 *   - import { QuizGame } from '@hfroemmel/quiz-kiosk'
 *   + import { QuizGame } from '@hfroemmel/quiz-react'
 *
 * And the stylesheet goes with it: `@hfroemmel/quiz-kiosk/styles.css` is part
 * of `@hfroemmel/quiz-react/styles.css` now, so a host drops one import
 * instead of changing it.
 *
 * @deprecated Import from `@hfroemmel/quiz-react` instead. This package will
 * be removed in the release after next.
 */
import './styles.css'

export { QuizGame, StartMenu, deviceStartMenu } from '@hfroemmel/quiz-react'
export type { QuizGameProps, QuizGameResult, StartMenuChoice, StartMenuProps } from '@hfroemmel/quiz-react'
