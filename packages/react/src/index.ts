/**
 * @hfroemmel/quiz-react - die Buehne als React-Bausteine.
 *
 * Oeffentliche Oberflaeche ist `<QuizScene>` (Runtime hinein, Buehne heraus).
 * Daneben stehen die Bausteine, die Gastgeber mit eigener Komposition brauchen:
 * der rohe `StageScreen`, die Verbindungs-Hooks und die Bauteile der Fussleiste
 * des Touchgeraets.
 *
 * Die globalen Stylesheets der Buehne kommen als Side-Effect-CSS:
 *   import '@hfroemmel/quiz-react/styles/stage.css'
 *   import '@hfroemmel/quiz-react/styles/motion.css'
 */
export * from './presentation/QuizScene'
export * from './presentation/StageScreen'
export * from './presentation/soundCues'
export * from './presentation/useAudioUnlock'
export * from './presentation/stageTheme'
export * from './presentation/stage/Counter'
export * from './presentation/stage/Score'
export * from './presentation/stage/StageHeader'
export * from './client/useQuizConnection'
export * from './client/useQuizRuntime'
export * from './client/useQuizSnapshot'
export * from './client/useRevealClock'
export * from './ui/AnimationClip'
export * from './components/Confetti'
/* Fuer Gastgeber mit eigener Komposition: Operatorpult und Vorschau-Harnass. */
export * from './presentation/stage/answerState'
export * from './presentation/transitions/registry'
export * from './presentation/animationPresets'
