/**
 * @hfroemmel/quiz-core - the shared core of the quiz system.
 *
 * Three layers, one package:
 *   contracts  types, runtime schemas, commands, view models, runtime contract
 *   engine     state machine, selection, projection, event derivation
 *   runtime    command processing behind the store port, local and remote
 *              QuizRuntime, in-memory store, hotfix overlay
 *
 * There is NO file system and NO native module here: everything runs in the
 * browser, in the renderer and in Node. File IO is provided by
 * `@hfroemmel/quiz-content`, SQLite by the stage operation (quiz-live).
 */
export * from './contracts'
export * from './engine'
export * from './runtime'
