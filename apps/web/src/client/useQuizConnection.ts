/**
 * WebSocket-Anbindung der Clients.
 *
 * Verantwortung dieses Hooks - und nur diese:
 *  - Verbindung aufbauen, ueberwachen und sauber wieder abbauen;
 *  - eingehende Snapshots in React-State ueberfuehren;
 *  - Befehle mit `commandId` und `expectedRevision` senden.
 *
 * Er implementiert KEINE Spielregeln. Welche Aktionen moeglich sind, steht in
 * `view.allowedCommands`; ob eine Aktion zulaessig ist, entscheidet der Server.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type {
  ClientRole,
  Command,
  ModeratorQuizViewModel,
  OperatorQuizViewModel,
  PublicQuizViewModel,
  ServerMessage,
} from '@quiz/contracts'

export interface Rejection {
  reason: string
  message: string
  atMs: number
}

export interface QuizConnection<TView extends PublicQuizViewModel> {
  view: TView | null
  connected: boolean
  /** Nur ein Client spielt Sounds ab. */
  audioMaster: boolean
  lastRejection: Rejection | null
  clearRejection(): void
  send(command: Command): void
  /** Serverzeit, auf die lokale Interpolationen bezogen werden. */
  serverNow(): number
}

const RECONNECT_DELAYS_MS = [500, 1_000, 2_000, 4_000, 8_000]

export function useQuizConnection<TView extends PublicQuizViewModel>(
  role: ClientRole,
  sessionCode?: string,
): QuizConnection<TView> {
  const [view, setView] = useState<TView | null>(null)
  const [connected, setConnected] = useState(false)
  const [audioMaster, setAudioMaster] = useState(false)
  const [lastRejection, setLastRejection] = useState<Rejection | null>(null)

  const socketRef = useRef<WebSocket | null>(null)
  const revisionRef = useRef(0)
  const clientIdRef = useRef<string>('unbekannt')
  /** Abweichung zwischen Server- und lokaler Uhr, aus dem letzten Snapshot. */
  const clockOffsetRef = useRef(0)
  const attemptRef = useRef(0)
  const closedByUsRef = useRef(false)

  useEffect(() => {
    closedByUsRef.current = false
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null

    const connect = () => {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      const params = new URLSearchParams({ role })
      if (sessionCode) params.set('code', sessionCode)
      const socket = new WebSocket(`${protocol}//${window.location.host}/ws?${params.toString()}`)
      socketRef.current = socket

      socket.addEventListener('open', () => {
        // Nur der aktuell gefuehrte Socket darf den Zustand veraendern.
        if (socketRef.current !== socket) return socket.close()
        attemptRef.current = 0
        setConnected(true)
      })

      socket.addEventListener('message', (event) => {
        let message: ServerMessage
        try {
          message = JSON.parse(String(event.data)) as ServerMessage
        } catch {
          return
        }

        switch (message.type) {
          case 'hello':
            clientIdRef.current = message.clientId
            clockOffsetRef.current = message.serverTimeMs - Date.now()
            break
          case 'client-info':
            setAudioMaster(message.audioMaster)
            break
          case 'snapshot': {
            const snapshot = message.view as TView
            // Vollstaendiger Snapshot: Clients muessen niemals verpasste
            // Einzelereignisse rekonstruieren.
            revisionRef.current = snapshot.revision
            clockOffsetRef.current = snapshot.serverTimeMs - Date.now()
            setView(snapshot)
            break
          }
          case 'command-accepted':
            revisionRef.current = message.revision
            break
          case 'command-rejected':
            revisionRef.current = message.currentRevision
            setLastRejection({ reason: message.reason, message: message.message, atMs: Date.now() })
            break
          case 'error':
            setLastRejection({ reason: 'error', message: message.message, atMs: Date.now() })
            break
        }
      })

      const scheduleReconnect = () => {
        if (closedByUsRef.current) return
        const delay = RECONNECT_DELAYS_MS[Math.min(attemptRef.current, RECONNECT_DELAYS_MS.length - 1)]!
        attemptRef.current += 1
        reconnectTimer = setTimeout(connect, delay)
      }

      socket.addEventListener('close', () => {
        /*
         * NUR DER AKTUELLE SOCKET ZAEHLT. Ein spaet eintreffendes `close` einer
         * bereits ersetzten Verbindung darf weder die laufende Verbindung
         * verwerfen noch einen zweiten Wiederverbindungsversuch starten. Sonst
         * zeigt der Client zwar Snapshots an, sendet aber ins Leere - im
         * Entwicklungsmodus reproduzierbar, weil React jeden Effekt doppelt
         * ausfuehrt, und im Betrieb bei jedem Reconnect moeglich.
         */
        if (socketRef.current !== socket) return
        setConnected(false)
        socketRef.current = null
        scheduleReconnect()
      })
      socket.addEventListener('error', () => socket.close())
    }

    connect()

    // Zuverlaessige Bereinigung: kein Socket und kein Timer ueberlebt das Unmount.
    return () => {
      closedByUsRef.current = true
      if (reconnectTimer) clearTimeout(reconnectTimer)
      socketRef.current?.close()
      socketRef.current = null
    }
  }, [role, sessionCode])

  const send = useCallback((command: Command) => {
    const socket = socketRef.current
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      /*
       * Ein verschluckter Befehl ist im Live-Betrieb das Schlimmste: Der Operator
       * klickt, nichts passiert, und niemand weiss warum. Statt still zu
       * verwerfen wird die fehlende Verbindung gemeldet - der Befehl selbst wird
       * NICHT nachgereicht, weil er sich auf einen inzwischen veralteten Stand
       * beziehen wuerde.
       */
      setLastRejection({
        reason: 'error',
        message: 'Keine Verbindung zum Quizserver - der Befehl wurde nicht gesendet. Bitte erneut versuchen.',
        atMs: Date.now(),
      })
      return
    }
    socket.send(
      JSON.stringify({
        type: 'command',
        envelope: {
          commandId: createCommandId(),
          command,
          actor: { clientId: clientIdRef.current, role: role === 'stage' ? 'system' : role },
          expectedRevision: revisionRef.current,
          issuedAtClient: new Date().toISOString(),
        },
      }),
    )
  }, [role])

  const serverNow = useCallback(() => Date.now() + clockOffsetRef.current, [])
  const clearRejection = useCallback(() => setLastRejection(null), [])

  return useMemo(
    () => ({ view, connected, audioMaster, lastRejection, clearRejection, send, serverNow }),
    [view, connected, audioMaster, lastRejection, clearRejection, send, serverNow],
  )
}

export type OperatorConnection = QuizConnection<OperatorQuizViewModel>
export type ModeratorConnection = QuizConnection<ModeratorQuizViewModel>
export type StageConnection = QuizConnection<PublicQuizViewModel>

function createCommandId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `cmd-${Date.now()}-${Math.random().toString(36).slice(2)}`
}
