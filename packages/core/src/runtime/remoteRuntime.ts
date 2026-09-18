/**
 * Quiz runtime against a server on the network - the WebSocket side of the
 * shared `QuizRuntime` contract.
 *
 * Responsibilities - and only these:
 *  - establish, watch (backoff reconnect) and cleanly close the connection;
 *  - merge incoming snapshots and messages into ONE snapshot;
 *  - send commands with `commandId` and `expectedRevision` as an envelope.
 *
 * It implements NO game rules. Which actions are possible is in
 * `view.allowedCommands`; whether an action is permitted is decided by the
 * server. React does not appear here - `useQuizConnection` is the thin hook
 * above it.
 */
import type {
  ClientRole,
  Command,
  PublicQuizViewModel,
  QuizRuntime,
  QuizSnapshot,
  ServerMessage,
} from '../contracts'

export interface RemoteQuizRuntimeOptions {
  /** WS endpoint without query, e.g. `ws://192.168.0.10:4319/ws`. */
  url: string
  role: ClientRole
  sessionCode?: string
}

const RECONNECT_DELAYS_MS = [500, 1_000, 2_000, 4_000, 8_000]

export class RemoteQuizRuntime<TView extends PublicQuizViewModel> implements QuizRuntime<TView> {
  private readonly options: RemoteQuizRuntimeOptions
  private readonly listeners = new Set<(snapshot: QuizSnapshot<TView>) => void>()

  private socket: WebSocket | null = null
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private attempt = 0
  private disposed = false

  private clientId = 'unbekannt'
  private revision = 0
  /** Offset between server and local clock, from the last snapshot. */
  private clockOffset = 0
  /** Sound once unlocked stays unlocked - the report survives every reconnect. */
  private audioReady = false

  private snapshot: QuizSnapshot<TView> = {
    view: null,
    revision: 0,
    serverTimeMs: Date.now(),
    connection: { connected: false, audioMaster: false },
    lastRejection: null,
  }

  constructor(options: RemoteQuizRuntimeOptions) {
    this.options = options
    this.connect()
  }

  getSnapshot(): QuizSnapshot<TView> {
    return this.snapshot
  }

  subscribe(listener: (snapshot: QuizSnapshot<TView>) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  dispatch(command: Command): void {
    const socket = this.socket
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      /*
       * A swallowed command is the worst thing in live operation: the operator
       * clicks, nothing happens, and nobody knows why. Instead of discarding
       * silently, the missing connection is reported - the command itself is
       * NOT delivered later, because it would refer to a state that has become
       * stale in the meantime.
       */
      this.update({
        lastRejection: {
          reason: 'error',
          message: 'Keine Verbindung zum Quizserver - der Befehl wurde nicht gesendet. Bitte erneut versuchen.',
          atMs: Date.now(),
        },
      })
      return
    }
    socket.send(
      JSON.stringify({
        type: 'command',
        envelope: {
          commandId: createCommandId(),
          command,
          actor: { clientId: this.clientId, role: this.options.role === 'stage' ? 'system' : this.options.role },
          expectedRevision: this.revision,
          issuedAtClient: new Date().toISOString(),
        },
      }),
    )
  }

  serverNow(): number {
    return Date.now() + this.clockOffset
  }

  /**
   * Reports to the server that this context may play audible sound. The server
   * then chooses the audio lead; after a reconnect the report is repeated
   * automatically.
   */
  notifyAudioReady(): void {
    this.audioReady = true
    if (this.socket?.readyState === WebSocket.OPEN) this.socket.send(JSON.stringify({ type: 'audio-ready' }))
  }

  clearRejection(): void {
    if (this.snapshot.lastRejection) this.update({ lastRejection: null })
  }

  dispose(): void {
    this.disposed = true
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer)
    this.reconnectTimer = null
    this.socket?.close()
    this.socket = null
    this.listeners.clear()
  }

  private connect(): void {
    const params = new URLSearchParams({ role: this.options.role })
    if (this.options.sessionCode) params.set('code', this.options.sessionCode)
    const socket = new WebSocket(`${this.options.url}?${params.toString()}`)
    this.socket = socket

    socket.addEventListener('open', () => {
      // Only the socket currently in charge may change the state.
      if (this.socket !== socket) return socket.close()
      this.attempt = 0
      this.update({ connection: { ...this.snapshot.connection, connected: true } })
      // The server tracks the unlock per connection - after a reconnect
      // it knows nothing of it and would otherwise mute again.
      if (this.audioReady) socket.send(JSON.stringify({ type: 'audio-ready' }))
    })

    socket.addEventListener('message', (event) => {
      let message: ServerMessage
      try {
        message = JSON.parse(String(event.data)) as ServerMessage
      } catch {
        return
      }
      this.handleMessage(message)
    })

    socket.addEventListener('close', () => {
      /*
       * ONLY THE CURRENT SOCKET COUNTS. A late `close` of a connection already
       * replaced must neither discard the running connection nor start a second
       * reconnect attempt. Otherwise the client shows snapshots but sends into
       * the void - reproducible in development mode, because React runs every
       * effect twice, and possible in operation on every reconnect.
       */
      if (this.socket !== socket) return
      this.socket = null
      this.update({ connection: { ...this.snapshot.connection, connected: false } })
      this.scheduleReconnect()
    })
    socket.addEventListener('error', () => socket.close())
  }

  private scheduleReconnect(): void {
    if (this.disposed) return
    const delay = RECONNECT_DELAYS_MS[Math.min(this.attempt, RECONNECT_DELAYS_MS.length - 1)]!
    this.attempt += 1
    this.reconnectTimer = setTimeout(() => this.connect(), delay)
  }

  private handleMessage(message: ServerMessage): void {
    switch (message.type) {
      case 'hello':
        this.clientId = message.clientId
        this.clockOffset = message.serverTimeMs - Date.now()
        break
      case 'client-info':
        this.update({
          connection: {
            ...this.snapshot.connection,
            audioMaster: message.audioMaster,
          },
        })
        break
      case 'snapshot': {
        const view = message.view as TView
        // Complete snapshot: clients never have to reconstruct
        // missed individual events.
        this.revision = view.revision
        this.clockOffset = view.serverTimeMs - Date.now()
        this.update({ view, revision: view.revision, serverTimeMs: view.serverTimeMs })
        break
      }
      case 'command-accepted':
        this.revision = message.revision
        break
      case 'command-rejected':
        this.revision = message.currentRevision
        this.update({ lastRejection: { reason: message.reason, message: message.message, atMs: Date.now() } })
        break
      case 'error':
        this.update({ lastRejection: { reason: 'error', message: message.message, atMs: Date.now() } })
        break
    }
  }

  /** A new snapshot object per change - subscribers compare by identity. */
  private update(patch: Partial<QuizSnapshot<TView>>): void {
    this.snapshot = { ...this.snapshot, ...patch }
    for (const listener of this.listeners) listener(this.snapshot)
  }
}

function createCommandId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `cmd-${Date.now()}-${Math.random().toString(36).slice(2)}`
}
