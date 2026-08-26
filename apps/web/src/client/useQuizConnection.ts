/**
 * React-Anbindung der Quiz-Laufzeit.
 *
 * Die gesamte Verbindungslogik (Reconnect, Envelope, Uhrenabgleich) lebt in
 * `RemoteQuizRuntime` - dieser Hook erzeugt sie fuer die Lebensdauer der
 * Komponente, uebersetzt ihre Snapshots in React-State und reicht die vertraute
 * `QuizConnection`-Oberflaeche an die bestehenden Clients weiter.
 *
 * Der WS-Endpunkt kommt hier aus `window.location`, weil die Clients vom
 * Quizserver selbst ausgeliefert werden. Eingebettete Gastgeber mit fremdem
 * Endpunkt bauen die `RemoteQuizRuntime` direkt.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type {
  ClientRole,
  Command,
  ModeratorQuizViewModel,
  OperatorQuizViewModel,
  PublicQuizViewModel,
  QuizSnapshot,
} from '@quiz/contracts'
import { RemoteQuizRuntime } from './remoteQuizRuntime'

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
  /**
   * Meldet dem Server, dass dieses Fenster hoerbar Ton ausgeben darf.
   *
   * Der Server waehlt danach die Tonhoheit aus. Der Aufruf ist beliebig oft
   * moeglich; nach einem Reconnect wird die Meldung selbsttaetig wiederholt.
   */
  notifyAudioReady(): void
  lastRejection: Rejection | null
  clearRejection(): void
  send(command: Command): void
  /** Serverzeit, auf die lokale Interpolationen bezogen werden. */
  serverNow(): number
}

export function useQuizConnection<TView extends PublicQuizViewModel>(
  role: ClientRole,
  sessionCode?: string,
): QuizConnection<TView> {
  const runtimeRef = useRef<RemoteQuizRuntime<TView> | null>(null)
  const [snapshot, setSnapshot] = useState<QuizSnapshot<TView> | null>(null)

  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const runtime = new RemoteQuizRuntime<TView>({
      url: `${protocol}//${window.location.host}/ws`,
      role,
      ...(sessionCode === undefined ? {} : { sessionCode }),
    })
    runtimeRef.current = runtime
    setSnapshot(runtime.getSnapshot())
    const unsubscribe = runtime.subscribe(setSnapshot)

    // Zuverlaessige Bereinigung: kein Socket und kein Timer ueberlebt das Unmount.
    return () => {
      unsubscribe()
      runtime.dispose()
      runtimeRef.current = null
      setSnapshot(null)
    }
  }, [role, sessionCode])

  const send = useCallback((command: Command) => runtimeRef.current?.dispatch(command), [])
  const notifyAudioReady = useCallback(() => runtimeRef.current?.notifyAudioReady(), [])
  const clearRejection = useCallback(() => runtimeRef.current?.clearRejection(), [])
  const serverNow = useCallback(() => runtimeRef.current?.serverNow() ?? Date.now(), [])

  return useMemo(
    () => ({
      view: snapshot?.view ?? null,
      connected: snapshot?.connection.connected ?? false,
      audioMaster: snapshot?.connection.audioMaster ?? false,
      notifyAudioReady,
      lastRejection: snapshot?.lastRejection ?? null,
      clearRejection,
      send,
      serverNow,
    }),
    [snapshot, notifyAudioReady, clearRejection, send, serverNow],
  )
}

export type OperatorConnection = QuizConnection<OperatorQuizViewModel>
export type ModeratorConnection = QuizConnection<ModeratorQuizViewModel>
export type StageConnection = QuizConnection<PublicQuizViewModel>
