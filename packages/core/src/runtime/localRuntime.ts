/**
 * Lokale Quiz-Laufzeit: dieselbe Engine und derselbe Dienst wie auf dem Server,
 * aber im eigenen Prozess und ohne Transport.
 *
 * Sie traegt Kiosk und Einbettung. Anstelle von SQLite haelt ein
 * `MemoryQuizStore` den Zustand; Dauerhaftigkeit uebernimmt - wenn gewuenscht -
 * ein injizierter `persist`-Adapter des Gastgebers (Electron-IPC, IndexedDB).
 * Der Aufruf ist entprellt: Waehrend eines Spiels aendert sich der Zustand im
 * Sekundentakt, gespeichert werden muss nur der juengste Stand.
 *
 * Der Envelope (commandId, actor, expectedRevision) entsteht hier - Komponenten
 * geben nackte Befehle, genau wie gegenueber dem Server.
 */
import type {
  Command,
  PlayerQuizViewModel,
  QuizPackage,
  QuizRuntime,
  QuizSnapshot,
  QuizRuntimeRejection,
} from '../contracts'
import { ContentService } from './contentService'
import { MemoryQuizStore, type MemoryQuizStoreSnapshot } from './memoryStore'
import { QuizService } from './quizService'

export interface LocalQuizRuntimeOptions {
  /** Geladenes Quizpaket. Den Ladeweg stellt `@hfroemmel/quiz-content` bereit. */
  quizPackage: QuizPackage
  /** Zusaetzliche Wurzeln fuer die Medienaufloesung (Entwicklung). */
  mediaFallbackDirs?: string[]
  /** Zuvor gespeicherter Stand des Gastgebers - fehlt er, beginnt alles leer. */
  restoreFrom?: MemoryQuizStoreSnapshot
  /** Wird entprellt nach jeder Aenderung mit dem juengsten Stand aufgerufen. */
  persist?: (snapshot: MemoryQuizStoreSnapshot) => void
  persistDelayMs?: number
  /** Injizierbar fuer Tests. */
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
  /** Gecacht, damit `getSnapshot` zwischen Aenderungen dieselbe Identitaet liefert. */
  private snapshot: QuizSnapshot<PlayerQuizViewModel> | null = null

  constructor(options: LocalQuizRuntimeOptions) {
    this.store = options.restoreFrom ? MemoryQuizStore.fromJSON(options.restoreFrom) : new MemoryQuizStore()
    this.content = new ContentService(options.quizPackage, [], options.mediaFallbackDirs ?? [])
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
      // Lokal gibt es weder Netz noch Konkurrenz um die Tonhoheit.
      connection: { connected: true, audioMaster: true },
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
      // Lokal gibt es keine konkurrierenden Clients: Der Dienst laeuft synchron
      // im selben Prozess, die aktuelle Revision ist immer die gesehene.
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
    // Lokal ist dieser Kontext immer der einzige - nichts zu melden.
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
      // Ein noch ausstehender Stand geht beim Aufraeumen nicht verloren.
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
