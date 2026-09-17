/**
 * A `LocalQuizRuntime` for the lifetime of a component.
 *
 * The harness is the host - it provides the runtime and tears it down. The
 * kiosk and the game collection do exactly the same; here it's the same
 * role, just without Electron around it.
 */
import { useEffect, useState } from 'react'
import { LocalQuizRuntime } from '@hfroemmel/quiz-core'
import { harnessMedia, loadHarnessPackage } from './quizPackage'

export interface RuntimeHandle {
  runtime: LocalQuizRuntime | null
  errors: string | null
}

export function useLocalRuntime(): RuntimeHandle {
  const [handle, setHandle] = useState<RuntimeHandle>({ runtime: null, errors: null })

  useEffect(() => {
    let discarded = false
    let built: LocalQuizRuntime | null = null

    void loadHarnessPackage()
      .then((quizPackage) => {
        if (discarded) return
        built = new LocalQuizRuntime({ quizPackage, media: harnessMedia(quizPackage) })
        setHandle({ runtime: built, errors: null })
      })
      .catch((cause: unknown) => {
        if (discarded) return
        setHandle({ runtime: null, errors: cause instanceof Error ? cause.message : String(cause) })
      })

    // Even a setup that's aborted during loading cleans up after itself.
    return () => {
      discarded = true
      built?.dispose()
      setHandle({ runtime: null, errors: null })
    }
  }, [])

  return handle
}
