/**
 * WebSocket-Anbindung der Clients.
 *
 * Sie ist fuer alle Rollen dieselbe: Operator, Moderator, Buehne und die Spieler
 * am Touchgeraet. Deshalb liegt sie in einem eigenen Paket und nicht in einer
 * Anwendung - eine zweite Fassung waere eine zweite Reconnect- und
 * Befehlslogik.
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
  PlayerQuizViewModel,
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

  useEffect(() => {
    /*
     * Diese Merker gehoeren zu GENAU diesem Verbindungsversuch und stehen deshalb
     * bewusst nicht in einem Ref.
     *
     * Ein geteilter Merker waere ein Fehler mit Folgen: Wird die Komponente
     * entfernt und sofort wieder eingesetzt - der Normalfall in einer
     * Gastgeberanwendung -, setzt der neue Durchlauf den Merker zurueck, bevor
     * das `close`-Ereignis des alten Sockets eintrifft. Der alte Socket haelte
     * sich dann fuer unabsichtlich getrennt und baute eine zweite Verbindung auf,
     * die niemand mehr abraeumt.
     */
    let closedByUs = false
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null
    /** Der Socket, den GENAU dieser Durchlauf gerade haelt. */
    let active: WebSocket | null = null

    const connect = () => {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      const params = new URLSearchParams({ role })
      if (sessionCode) params.set('code', sessionCode)
      const socket = new WebSocket(`${protocol}//${window.location.host}/ws?${params.toString()}`)
      active = socket
      socketRef.current = socket

      socket.addEventListener('open', () => {
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
        if (closedByUs) return
        const delay = RECONNECT_DELAYS_MS[Math.min(attemptRef.current, RECONNECT_DELAYS_MS.length - 1)]!
        attemptRef.current += 1
        reconnectTimer = setTimeout(connect, delay)
      }

      socket.addEventListener('close', () => {
        setConnected(false)
        /*
         * Nur den eigenen Verweis loeschen. Ein spaet eintreffendes `close` eines
         * abgeloesten Sockets darf den aktuellen nicht aus dem Ref raeumen - sonst
         * findet ihn die Bereinigung beim Entfernen der Komponente nicht mehr und
         * er bleibt offen zurueck.
         */
        if (socketRef.current === socket) socketRef.current = null
        scheduleReconnect()
      })
      socket.addEventListener('error', () => socket.close())
    }

    connect()

    // Zuverlaessige Bereinigung: kein Socket und kein Timer ueberlebt das Unmount.
    return () => {
      closedByUs = true
      if (reconnectTimer) clearTimeout(reconnectTimer)
      active?.close()
      if (socketRef.current === active) socketRef.current = null
      active = null
    }
  }, [role, sessionCode])

  const send = useCallback((command: Command) => {
    const socket = socketRef.current
    if (!socket || socket.readyState !== WebSocket.OPEN) return
    socket.send(
      JSON.stringify({
        type: 'command',
        envelope: {
          commandId: createCommandId(),
          command,
          // Der Buehnenclient handelt nie selbst; seine einzige Meldung ist eine
          // Systemmeldung. Alle anderen Rollen gibt es auch als Akteur.
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
export type PlayerConnection = QuizConnection<PlayerQuizViewModel>

function createCommandId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `cmd-${Date.now()}-${Math.random().toString(36).slice(2)}`
}
