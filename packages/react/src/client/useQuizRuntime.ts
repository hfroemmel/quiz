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
import type { ClientRole, PublicQuizViewModel, QuizSnapshot } from '@hfroemmel/quiz-core'
import { RemoteQuizRuntime } from '@hfroemmel/quiz-core'
import { useQuizSnapshot } from './useQuizSnapshot'

export interface QuizRuntimeHandle<TView extends PublicQuizViewModel> {
  /** `null`, bis der Verbindungsaufbau der Komponente begonnen hat. */
  runtime: RemoteQuizRuntime<TView> | null
  snapshot: QuizSnapshot<TView> | null
}

/**
 * `role === null` baut KEINE Verbindung auf.
 *
 * Das ist kein Sonderfall, sondern der Normalfall der Offline-Gastgeber: Sie
 * bringen ihre eigene Laufzeit mit, und ein Hook laesst sich nicht bedingt
 * aufrufen. Ohne Rolle bleibt der Griff leer, und der Gastgeber setzt seine
 * Laufzeit an dieselbe Stelle.
 */
export function useQuizRuntime<TView extends PublicQuizViewModel>(
  role: ClientRole | null,
  sessionCode?: string,
): QuizRuntimeHandle<TView> {
  const [runtime, setRuntime] = useState<RemoteQuizRuntime<TView> | null>(null)

  useEffect(() => {
    if (!role) return
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const created = new RemoteQuizRuntime<TView>({
      url: `${protocol}//${window.location.host}/ws`,
      role,
      ...(sessionCode === undefined ? {} : { sessionCode }),
    })
    setRuntime(created)

    // Zuverlaessige Bereinigung: kein Socket und kein Timer ueberlebt das Unmount.
    return () => {
      created.dispose()
      setRuntime(null)
    }
  }, [role, sessionCode])

  return { runtime, snapshot: useQuizSnapshot(runtime) }
}
