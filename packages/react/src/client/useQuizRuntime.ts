/**
 * A `RemoteQuizRuntime` for a component's lifetime.
 *
 * For hosts that need the runtime themselves - for instance to give it to
 * `<QuizScene>` AND send their own commands. Anyone who only wants the
 * familiar connection interface still uses `useQuizConnection`.
 *
 * The WS endpoint comes from `window.location`, because the clients are
 * served by the quiz server itself.
 */
import { useEffect, useState } from 'react'
import type { ClientRole, PublicQuizViewModel, QuizSnapshot } from '@hfroemmel/quiz-core'
import { RemoteQuizRuntime } from '@hfroemmel/quiz-core'
import { useQuizSnapshot } from './useQuizSnapshot'

export interface QuizRuntimeHandle<TView extends PublicQuizViewModel> {
  /** `null` until the component has begun establishing the connection. */
  runtime: RemoteQuizRuntime<TView> | null
  snapshot: QuizSnapshot<TView> | null
}

/**
 * `role === null` establishes NO connection.
 *
 * This is not a special case but the normal case for offline hosts: they
 * bring their own runtime, and a hook cannot be called conditionally.
 * Without a role the handle stays empty, and the host places its runtime at
 * the same spot.
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

    // Reliable cleanup: no socket and no timer survives the unmount.
    return () => {
      created.dispose()
      setRuntime(null)
    }
  }, [role, sessionCode])

  return { runtime, snapshot: useQuizSnapshot(runtime) }
}
