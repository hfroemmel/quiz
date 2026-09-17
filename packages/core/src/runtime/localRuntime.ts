/**
 * Local quiz runtime: the same engine and the same service as on the server,
 * but in the own process and without transport.
 *
 * It serves kiosk and embedding. Instead of SQLite a `MemoryQuizStore` holds
 * the state; persistence is - if wanted - provided by an injected `persist`
 * adapter of the host (Electron IPC, IndexedDB). The call is debounced: during
 * a game the state changes every second, and only the latest state needs
 * saving.
 *
 * The envelope (commandId, actor, expectedRevision) is created here -
 * components issue bare commands, exactly as towards the server.
 */
import type {
  Command,
  PlayerQuizViewModel,
  QuizPackage,
  QuizRuntime,
  QuizSnapshot,
  QuizRuntimeRejection,
} from '../contracts'
import { ContentService, type AssetResolver } from './contentService'
import { MemoryQuizStore, type MemoryQuizStoreSnapshot } from './memoryStore'
import { QuizService } from './quizService'

export interface LocalQuizRuntimeOptions {
  /** Loaded quiz package. The loading path is provided by `@hfroemmel/quiz-content`. */
  quizPackage: QuizPackage
  /** Additional roots for media resolution (development). */
  mediaFallbackDirs?: string[]
  /**
   * The host's own media resolution.
   *
   * Without it the package's route applies (`/media/<id>`), which a server
   * serves. A window that carries its media in its own bundle names them here -
   * previously it had to replace the content service's method from outside, and
   * a rename in the package broke it silently.
   */
  media?: AssetResolver
  /** Previously saved state of the host - if missing, everything starts empty. */
  restoreFrom?: MemoryQuizStoreSnapshot
  /** Called debounced after every change with the latest state. */
  persist?: (snapshot: MemoryQuizStoreSnapshot) => void
  persistDelayMs?: number
  /** Injectable for tests. */
  now?: () => number
  random?: () => number
}

const DEFAULT_PERSIST_DELAY_MS = 1_000

export class LocalQuizRuntime implements QuizRuntime<PlayerQuizViewModel> {
  readonly service: QuizService
  readonly store: MemoryQuizStore
  readonly content: ContentService

  private readonly listeners = new Set<(snapshot: QuizSnapshot<PlayerQuizViewModel>) => void>()
  private readonly unsubscribeService: () => void
  private readonly persistDelayMs: number
  private readonly persist: ((snapshot: MemoryQuizStoreSnapshot) => void) | undefined
  private persistTimer: ReturnType<typeof setTimeout> | null = null
  private lastRejection: QuizRuntimeRejection | null = null
  private disposed = false
  /** Cached, so that `getSnapshot` returns the same identity between changes. */
  private snapshot: QuizSnapshot<PlayerQuizViewModel> | null = null

  constructor(options: LocalQuizRuntimeOptions) {
    this.store = options.restoreFrom ? MemoryQuizStore.fromJSON(options.restoreFrom) : new MemoryQuizStore()
    this.content = new ContentService(options.quizPackage, [], options.mediaFallbackDirs ?? [], {
      ...(options.media === undefined ? {} : { media: options.media }),
    })
    this.content.applyPatchOverlay(this.store.loadPatches())

    this.service = new QuizService({
      store: this.store,
      content: this.content,
      ...(options.now === undefined ? {} : { now: options.now }),
      ...(options.random === undefined ? {} : { random: options.random }),
    })

    this.persist = options.persist
    this.persistDelayMs = options.persistDelayMs ?? DEFAULT_PERSIST_DELAY_MS
    this.unsubscribeService = this.service.onChange(() => {
      this.schedulePersist()
      this.emit()
    })
  }

  getSnapshot(): QuizSnapshot<PlayerQuizViewModel> {
    this.snapshot ??= {
      view: this.service.snapshotFor('player'),
      revision: this.service.currentRevision,
      serverTimeMs: this.serverNow(),
      // Locally there is neither a network nor competition for either lead:
      // one window plays everything and sounds everything.
      connection: { connected: true, audioMaster: true, videoAudioMaster: true },
      lastRejection: this.lastRejection,
    }
    return this.snapshot
  }

  subscribe(listener: (snapshot: QuizSnapshot<PlayerQuizViewModel>) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  dispatch(command: Command): void {
    if (this.disposed) return
    const result = this.service.dispatch({
      commandId: createCommandId(),
      command,
      actor: { clientId: 'local-runtime', role: 'player' },
      // Locally there are no competing clients: the service runs synchronously
      // in the same process, the current revision is always the one seen.
      expectedRevision: this.service.currentRevision,
      issuedAtClient: new Date(this.service.now()).toISOString(),
    })
    if (!result.ok && result.rejection) {
      this.lastRejection = { ...result.rejection, atMs: this.service.now() }
      this.emit()
    }
  }

  serverNow(): number {
    return this.service.now()
  }

  notifyAudioReady(): void {
    // Locally this context is always the only one - nothing to report.
  }

  clearRejection(): void {
    if (!this.lastRejection) return
    this.lastRejection = null
    this.emit()
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.unsubscribeService()
    this.listeners.clear()
    if (this.persistTimer) {
      clearTimeout(this.persistTimer)
      this.persistTimer = null
      // A state still pending is not lost on cleanup.
      this.persist?.(this.store.toJSON())
    }
    this.service.stopTimers()
    this.store.close()
  }

  private emit(): void {
    this.snapshot = null
    const snapshot = this.getSnapshot()
    for (const listener of this.listeners) listener(snapshot)
  }

  private schedulePersist(): void {
    if (!this.persist || this.persistTimer) return
    this.persistTimer = setTimeout(() => {
      this.persistTimer = null
      this.persist?.(this.store.toJSON())
    }, this.persistDelayMs)
  }
}

function createCommandId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `cmd-${Date.now()}-${Math.random().toString(36).slice(2)}`
}
