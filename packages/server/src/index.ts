/**
 * Der Transportadapter des Buehnenbetriebs.
 *
 * Die Anwendungsschicht selbst steht in `@quiz/runtime` und wird hier nur
 * weitergereicht, damit bestehende Nutzer (Electron-Hauptprozess, Tests) einen
 * Einstiegspunkt behalten.
 */
export * from './network.ts'
export * from './httpServer.ts'
export * from './wsServer.ts'
export * from './startServer.ts'
export { createQuizRuntime, ContentService, QuizService } from '@quiz/runtime'
export type { QuizRuntime, QuizRuntimeOptions, QuizServiceOptions, DispatchResult } from '@quiz/runtime'
