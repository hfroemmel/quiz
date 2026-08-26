/**
 * WebSocket-Verteilung (Spezifikation 18 und 23.4).
 *
 * Der WebSocket transportiert ausschliesslich zwei Dinge: Befehle zum Server und
 * rollenabhaengige Snapshots zum Client. Er enthaelt selbst keine Geschaeftslogik und
 * ist ausdruecklich keine lose Sammlung gegenseitig abhaengiger Client-Events.
 *
 * Nach jedem Reconnect bekommt ein Client sofort einen vollstaendigen Snapshot mit
 * Revision und Serverzeit. Clients muessen deshalb niemals verpasste Einzelereignisse
 * rekonstruieren.
 */
import { randomUUID } from 'node:crypto'
import type { Server } from 'node:http'
import { WebSocketServer, type WebSocket } from 'ws'
import { PROTOCOL_VERSION, type ClientMessage, type ClientRole, type ServerMessage } from '@quiz/contracts'
import type { QuizService } from '@quiz/runtime'
import { chooseAudioMaster } from './audioMaster'
import { checkAccess, isLoopback } from './network'

interface Connection {
  socket: WebSocket
  clientId: string
  role: ClientRole
  /** Nur ein Client spielt Sounds ab, damit sie nicht mehrfach zeitversetzt kommen. */
  audioMaster: boolean
  /**
   * Der Client hat gemeldet, dass sein Fenster hoerbar Ton ausgeben darf.
   *
   * Bis dahin gilt er als stumm: Ein Browserfenster ohne Nutzerinteraktion
   * verweigert jede Wiedergabe, und ein stummer Master ist so gut wie kein Master.
   */
  audioReady: boolean
  isLocal: boolean
}

export function attachWebSocketServer(httpServer: Server, service: QuizService, sessionCode: string): () => void {
  const wss = new WebSocketServer({ noServer: true })
  const connections = new Set<Connection>()

  httpServer.on('upgrade', (request, socket, head) => {
    const url = new URL(request.url ?? '/', 'http://localhost')
    if (url.pathname !== '/ws') {
      socket.destroy()
      return
    }

    const requestedRole = url.searchParams.get('role') ?? 'stage'
    const role: ClientRole = ['operator', 'moderator', 'stage', 'player'].includes(requestedRole)
      ? (requestedRole as ClientRole)
      : 'stage'

    const decision = checkAccess({
      role,
      code: url.searchParams.get('code'),
      sessionCode,
      remoteAddress: request.socket.remoteAddress,
    })
    if (!decision.allowed) {
      // Verstaendliche Ablehnung statt stillem Verbindungsabbruch.
      socket.write(`HTTP/1.1 401 Unauthorized\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n${decision.message}`)
      socket.destroy()
      return
    }

    wss.handleUpgrade(request, socket, head, (ws) => {
      register(ws, role, isLoopback(request.socket.remoteAddress))
    })
  })

  function register(socket: WebSocket, role: ClientRole, local: boolean): void {
    const connection: Connection = {
      socket,
      clientId: `${role}-${randomUUID()}`,
      role,
      audioMaster: false,
      audioReady: false,
      isLocal: local,
    }
    connections.add(connection)
    service.registerClient(connection.clientId, role === 'stage' ? 'system' : role)
    assignAudioMaster()

    send(connection, {
      type: 'hello',
      clientId: connection.clientId,
      role,
      serverTimeMs: service.now(),
      protocolVersion: PROTOCOL_VERSION,
    })
    send(connection, { type: 'client-info', audioMaster: connection.audioMaster })
    sendSnapshot(connection)

    socket.on('message', (raw) => {
      let message: ClientMessage
      try {
        message = JSON.parse(String(raw)) as ClientMessage
      } catch {
        send(connection, { type: 'error', message: 'Nachricht konnte nicht gelesen werden.' })
        return
      }
      if (message.type === 'ping') return
      if (message.type === 'audio-ready') {
        // Die Meldung kommt nach jedem Verbindungsaufbau erneut; der Server fuehrt
        // dazu keinen Verlauf, sondern nur den aktuellen Stand je Verbindung.
        if (!connection.audioReady) {
          connection.audioReady = true
          assignAudioMaster()
        }
        return
      }
      if (message.type !== 'command') return

      // Der Buehnenclient darf ausschliesslich Medienstatus melden - keine Steuerbefehle.
      const envelope = message.envelope as { actor?: { role?: string }; command?: { type?: string } } | null
      if (role === 'stage') {
        if (envelope?.command?.type !== 'REPORT_VIDEO_STATUS') {
          send(connection, { type: 'error', message: 'Bühnenclients dürfen keine Steuerbefehle senden.' })
          return
        }
      } else if (envelope?.actor?.role && envelope.actor.role !== role && envelope.actor.role !== 'buzzer') {
        // Ein Client darf sich nicht als andere Rolle ausgeben.
        send(connection, { type: 'error', message: 'Die angegebene Rolle passt nicht zur Verbindung.' })
        return
      }

      const commandId = (message.envelope as { commandId?: string })?.commandId ?? 'unbekannt'
      const result = service.dispatch(message.envelope)
      if (result.ok) {
        send(connection, { type: 'command-accepted', commandId, revision: result.revision })
      } else {
        send(connection, {
          type: 'command-rejected',
          commandId,
          reason: result.rejection?.reason ?? 'unknown-command',
          message: result.rejection?.message ?? 'Befehl abgewiesen.',
          currentRevision: result.revision,
        })
        // Nach einer Ablehnung bekommt der Client sofort den verbindlichen Stand.
        sendSnapshot(connection)
      }
    })

    socket.on('close', () => {
      connections.delete(connection)
      service.unregisterClient(connection.clientId)
      // Faellt eine Buehne weg, uebernimmt der naechste geeignete Client - auch dann,
      // wenn die weggefallene Verbindung selbst nicht der Master war.
      assignAudioMaster()
    })

    socket.on('error', () => {
      // Ein Fehler in einem optionalen Client stoppt den Kernbetrieb nicht.
      connections.delete(connection)
      service.unregisterClient(connection.clientId)
    })
  }

  /** Setzt die Wahl aus `chooseAudioMaster` durch und meldet jede Aenderung. */
  function assignAudioMaster(): void {
    const candidates = [...connections].filter(
      (connection) => connection.role === 'stage' || connection.role === 'operator',
    )
    const preferred = chooseAudioMaster(candidates)
    for (const connection of candidates) {
      const shouldBeMaster = connection === preferred
      if (connection.audioMaster !== shouldBeMaster) {
        connection.audioMaster = shouldBeMaster
        send(connection, { type: 'client-info', audioMaster: shouldBeMaster })
      }
    }
  }

  function sendSnapshot(connection: Connection): void {
    send(connection, { type: 'snapshot', role: connection.role, view: service.snapshotFor(connection.role) })
  }

  function send(connection: Connection, message: ServerMessage): void {
    if (connection.socket.readyState !== connection.socket.OPEN) return
    connection.socket.send(JSON.stringify(message))
  }

  const unsubscribe = service.onChange(() => {
    for (const connection of connections) sendSnapshot(connection)
  })

  return () => {
    unsubscribe()
    for (const connection of connections) connection.socket.close()
    wss.close()
  }
}
