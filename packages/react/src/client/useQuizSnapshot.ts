/**
 * Subscribe to the state of ONE runtime - whichever it is.
 *
 * The `QuizRuntime` contract is the only requirement: the same view thereby
 * runs against the stage server (`RemoteQuizRuntime`) as in its own process
 * (`LocalQuizRuntime`). Which runtime is provided is decided by the host -
 * not the view.
 */
import { useEffect, useState } from 'react'
import type { PublicQuizViewModel, QuizRuntime, QuizSnapshot } from '@hfroemmel/quiz-core'

export function useQuizSnapshot<TView extends PublicQuizViewModel>(
  runtime: QuizRuntime<TView> | null,
): QuizSnapshot<TView> | null {
  const [snapshot, setSnapshot] = useState<QuizSnapshot<TView> | null>(() => runtime?.getSnapshot() ?? null)

  useEffect(() => {
    if (!runtime) {
      setSnapshot(null)
      return
    }
    /*
     * Take over the current state first, then subscribe: between building
     * the runtime and this effect a change can already have happened, and a
     * local runtime has its first state right away anyway.
     */
    setSnapshot(runtime.getSnapshot())
    return runtime.subscribe(setSnapshot)
  }, [runtime])

  return snapshot
}
