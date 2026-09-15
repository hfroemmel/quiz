/**
 * Common runtime interface of all quiz contexts.
 *
 * A `QuizRuntime` is the ONLY view an interface has of the game: read the
 * snapshot, subscribe to changes, issue commands, clean up. Whether a server in
 * the LAN stands behind it (`RemoteQuizRuntime`) or the same engine in the own
 * process (`LocalQuizRuntime`) is invisible to the interface.
 *
 * The envelope (commandId, actor, expectedRevision) is the runtime's concern -
 * components issue bare commands.
 */
import type { Command } from './commands'

export interface QuizRuntimeRejection {
  reason: string
  message: string
  atMs: number
}

export interface QuizRuntimeConnection {
  connected: boolean
  /** Only one context plays sounds; the runtime carries the decision. */
  audioMaster: boolean
}

export interface QuizSnapshot<TView> {
  /** Role-specific view model, projected unchanged. */
  view: TView | null
  revision: number
  /** Server time at the moment of this snapshot. Continuous: `serverNow()`. */
  serverTimeMs: number
  connection: QuizRuntimeConnection
  lastRejection: QuizRuntimeRejection | null
}

export interface QuizRuntime<TView = unknown> {
  getSnapshot(): QuizSnapshot<TView>
  subscribe(listener: (snapshot: QuizSnapshot<TView>) => void): () => void
  dispatch(command: Command): void | Promise<void>
  /** Continuous server time for local interpolations (reveal clock). */
  serverNow(): number
  /** Reports that this context may play audible sound. */
  notifyAudioReady(): void
  clearRejection(): void
  /** End the connection or the timers. Afterwards the runtime is unusable. */
  dispose(): void
}
