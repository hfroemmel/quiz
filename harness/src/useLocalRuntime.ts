/**
 * Eine `LocalQuizRuntime` fuer die Lebensdauer einer Komponente.
 *
 * Der Pruefstand ist der Gastgeber - er stellt die Laufzeit und raeumt sie auf.
 * Genau so machen es Kiosk und Spielesammlung; hier steht dieselbe Rolle nur
 * ohne Electron drumherum.
 */
import { useEffect, useState } from 'react'
import { LocalQuizRuntime } from '@hfroemmel/quiz-core'
import { loadHarnessPackage } from './quizPackage'

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
        built = new LocalQuizRuntime({ quizPackage })
        setHandle({ runtime: built, errors: null })
      })
      .catch((cause: unknown) => {
        if (discarded) return
        setHandle({ runtime: null, errors: cause instanceof Error ? cause.message : String(cause) })
      })

    // Auch ein Aufbau, der waehrend des Ladens abgebrochen wird, raeumt auf.
    return () => {
      discarded = true
      built?.dispose()
      setHandle({ runtime: null, errors: null })
    }
  }, [])

  return handle
}
