/**
 * Eine `RemoteQuizRuntime` fuer die Lebensdauer einer Komponente.
 *
 * Fuer Gastgeber, die die Runtime selbst brauchen - etwa um sie an
 * `<QuizScene>` zu geben UND eigene Befehle zu senden. Wer nur die vertraute
 * Verbindungsoberflaeche will, nimmt weiterhin `useQuizConnection`.
 *
 * Der WS-Endpunkt kommt aus `window.location`, weil die Clients vom Quizserver
 * selbst ausgeliefert werden.
 */
import { useEffect, useState } from 'react'
import type { ClientRole, PublicQuizViewModel, QuizSnapshot } from '@quiz/contracts'
import { RemoteQuizRuntime } from './remoteQuizRuntime'

export interface QuizRuntimeHandle<TView extends PublicQuizViewModel> {
  /** `null`, bis der Verbindungsaufbau der Komponente begonnen hat. */
  runtime: RemoteQuizRuntime<TView> | null
  snapshot: QuizSnapshot<TView> | null
}

export function useQuizRuntime<TView extends PublicQuizViewModel>(
  role: ClientRole,
  sessionCode?: string,
): QuizRuntimeHandle<TView> {
  const [handle, setHandle] = useState<QuizRuntimeHandle<TView>>({ runtime: null, snapshot: null })

  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const runtime = new RemoteQuizRuntime<TView>({
      url: `${protocol}//${window.location.host}/ws`,
      role,
      ...(sessionCode === undefined ? {} : { sessionCode }),
    })
    setHandle({ runtime, snapshot: runtime.getSnapshot() })
    const unsubscribe = runtime.subscribe((snapshot) => setHandle({ runtime, snapshot }))

    // Zuverlaessige Bereinigung: kein Socket und kein Timer ueberlebt das Unmount.
    return () => {
      unsubscribe()
      runtime.dispose()
      setHandle({ runtime: null, snapshot: null })
    }
  }, [role, sessionCode])

  return handle
}
