/**
 * @hfroemmel/quiz-react - the stage as React building blocks.
 *
 * The public interface is `<QuizScene>` (runtime in, stage out). Alongside it
 * are the building blocks hosts with their own composition need: the raw
 * `StageScreen`, the connection hooks and the touch device's footer bar
 * components.
 *
 * The stage's global stylesheets come as side-effect CSS:
 *   import '@hfroemmel/quiz-react/styles/stage.css'
 *   import '@hfroemmel/quiz-react/styles/motion.css'
 */
export * from './presentation/QuizProvider'
export * from './presentation/QuizScene'
export * from './presentation/StageScreen'
export * from './presentation/soundCues'
export * from './presentation/texts'
export * from './presentation/useAudioUnlock'
export * from './presentation/stageTheme'
export * from './presentation/stage/Counter'
export * from './presentation/stage/Score'
/*
 * The joker faces. Exported because the live quiz draws the back of its card
 * with the same shape the stage uses for the group marker - one look, not two.
 */
export * from './presentation/stage/jokerIcons'
export * from './presentation/stage/StageHeader'
export * from './presentation/stage/DetailsStep'
/* The wordmark as a file - for hosts that show it outside the stage. */
export * from './presentation/brandAssets'
export * from './client/useQuizConnection'
export * from './client/useQuizRuntime'
/*
 * THE PLAYABLE QUIZ - one component, and everything its screen needs.
 *
 * It used to be a package of its own (`@hfroemmel/quiz-kiosk`), and the split
 * never drew a line: the device's screen is built from the same scenes, the
 * same sounds and the same texts as the stage's, and every host that showed a
 * quiz installed both halves anyway. What remains of the difference is a
 * component name.
 */
import './game/controls.css'

export * from './game/QuizGame'
export * from './game/StartMenu'
export * from './game/startMenuModel'

export * from './client/useQuizSnapshot'
export * from './client/useRevealClock'
export * from './ui/AnimationClip'
export * from './components/Confetti'
/* For hosts with their own composition: operator desk and preview harness. */
export * from './presentation/stage/answerState'
export * from './presentation/transitions/registry'
export * from './presentation/animationPresets'
