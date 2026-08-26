/**
 * Quiz-Laufzeit gegen einen Server im Netz - die WebSocket-Seite des
 * gemeinsamen `QuizRuntime`-Vertrags.
 *
 * Verantwortung - und nur diese:
 *  - Verbindung aufbauen, ueberwachen (Backoff-Reconnect) und sauber abbauen;
 *  - eingehende Snapshots und Meldungen in EINEN Snapshot zusammenfuehren;
 *  - Befehle mit `commandId` und `expectedRevision` als Envelope senden.
 *
 * Sie implementiert KEINE Spielregeln. Welche Aktionen moeglich sind, steht in
 * `view.allowedCommands`; ob eine Aktion zulaessig ist, entscheidet der Server.
 * React kommt hier nicht vor - `useQuizConnection` ist der duenne Hook darueber.
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
  /** WS-Endpunkt ohne Query, z. B. `ws://192.168.0.10:4319/ws`. */
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
  /** Abweichung zwischen Server- und lokaler Uhr, aus dem letzten Snapshot. */
  private clockOffset = 0
  /** Einmal freigegebener Ton bleibt frei - die Meldung ueberlebt jeden Reconnect. */
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
       * Ein verschluckter Befehl ist im Live-Betrieb das Schlimmste: Der Operator
       * klickt, nichts passiert, und niemand weiss warum. Statt still zu
       * verwerfen wird die fehlende Verbindung gemeldet - der Befehl selbst wird
       * NICHT nachgereicht, weil er sich auf einen inzwischen veralteten Stand
       * beziehen wuerde.
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
   * Meldet dem Server, dass dieser Kontext hoerbar Ton ausgeben darf. Der Server
   * waehlt danach die Tonhoheit; nach einem Reconnect wird die Meldung
   * selbsttaetig wiederholt.
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
      // Nur der aktuell gefuehrte Socket darf den Zustand veraendern.
      if (this.socket !== socket) return socket.close()
      this.attempt = 0
      this.update({ connection: { ...this.snapshot.connection, connected: true } })
      // Der Server fuehrt die Freigabe je Verbindung - nach einem Reconnect
      // weiss er nichts mehr davon und wuerde sonst wieder stumm schalten.
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
       * NUR DER AKTUELLE SOCKET ZAEHLT. Ein spaet eintreffendes `close` einer
       * bereits ersetzten Verbindung darf weder die laufende Verbindung
       * verwerfen noch einen zweiten Wiederverbindungsversuch starten. Sonst
       * zeigt der Client zwar Snapshots an, sendet aber ins Leere - im
       * Entwicklungsmodus reproduzierbar, weil React jeden Effekt doppelt
       * ausfuehrt, und im Betrieb bei jedem Reconnect moeglich.
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
        this.update({ connection: { ...this.snapshot.connection, audioMaster: message.audioMaster } })
        break
      case 'snapshot': {
        const view = message.view as TView
        // Vollstaendiger Snapshot: Clients muessen niemals verpasste
        // Einzelereignisse rekonstruieren.
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

  /** Ein neues Snapshot-Objekt je Aenderung - Abonnenten vergleichen per Identitaet. */
  private update(patch: Partial<QuizSnapshot<TView>>): void {
    this.snapshot = { ...this.snapshot, ...patch }
    for (const listener of this.listeners) listener(this.snapshot)
  }
}

function createCommandId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `cmd-${Date.now()}-${Math.random().toString(36).slice(2)}`
}
