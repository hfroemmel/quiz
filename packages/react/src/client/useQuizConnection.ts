/**
 * React binding of the quiz runtime.
 *
 * The whole connection logic (reconnect, envelope, clock sync) lives in
 * `RemoteQuizRuntime` - this hook creates it for the component's lifetime,
 * translates its snapshots into React state and passes the familiar
 * `QuizConnection` interface on to the existing clients.
 *
 * The WS endpoint here comes from `window.location`, because the clients are
 * served by the quiz server itself. Embedded hosts with a foreign endpoint
 * build the `RemoteQuizRuntime` directly.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type {
  ClientRole,
  Command,
  ModeratorQuizViewModel,
  OperatorQuizViewModel,
  PublicQuizViewModel,
  QuizSnapshot,
} from '@hfroemmel/quiz-core'
import { RemoteQuizRuntime } from '@hfroemmel/quiz-core'

export interface Rejection {
  reason: string
  message: string
  atMs: number
}

export interface QuizConnection<TView extends PublicQuizViewModel> {
  view: TView | null
  connected: boolean
  /** Only one client plays sounds. */
  audioMaster: boolean
  /**
   * May this client sound a VIDEO it plays?
   *
   * A second authority, because it is a second set of windows: the cues may
   * sound from the operator's window, a video only where the room sees it.
   */
  videoAudioMaster: boolean
  /**
   * Reports to the server that this window is allowed to output audible sound.
   *
   * The server then chooses the audio authority accordingly. The call can be
   * made any number of times; after a reconnect the report is repeated
   * automatically.
   */
  notifyAudioReady(): void
  lastRejection: Rejection | null
  clearRejection(): void
  send(command: Command): void
  /** Server time that local interpolations are related to. */
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

    // Reliable cleanup: no socket and no timer survives the unmount.
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
      videoAudioMaster: snapshot?.connection.videoAudioMaster ?? false,
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
