/**
 * @hfroemmel/quiz-kiosk - the playable quiz as ONE component.
 *
 * A host renders `<QuizGame>` and gets the start selection, game and result;
 * events arrive via `onFinished`/`onExit`. Kiosk and multi-game embedding use
 * exactly this building block.
 */
/*
 * The global controls travel along in the package's stylesheet - see
 * `game/controls.css`.
 */
import './game/controls.css'

export * from './game/QuizGame'
export * from './game/GameStart'
