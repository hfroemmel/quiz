/**
 * Eine `LocalQuizRuntime` fuer die Lebensdauer einer Komponente.
 *
 * Der Pruefstand ist der Gastgeber - er stellt die Laufzeit und raeumt sie auf.
 * Genau so machen es Kiosk und Spielesammlung; hier steht dieselbe Rolle nur
 * ohne Electron drumherum.
 */
import { useEffect, useState } from 'react'
import { LocalQuizRuntime, type LifelineConfig } from '@hfroemmel/quiz-core'
import { ladeQuizPaket } from './quizPaket'

export interface LaufzeitGriff {
  runtime: LocalQuizRuntime | null
  fehler: string | null
}

/**
 * @param lifelines Was diese Aufstellung an Jokern anbietet. Ohne Angabe keine -
 *   genau wie im Kiosk und in der Spielesammlung.
 */
export function useLokaleLaufzeit(lifelines?: Partial<LifelineConfig>): LaufzeitGriff {
  const [griff, setGriff] = useState<LaufzeitGriff>({ runtime: null, fehler: null })

  useEffect(() => {
    let verworfen = false
    let gebaut: LocalQuizRuntime | null = null

    void ladeQuizPaket()
      .then((quizPackage) => {
        if (verworfen) return
        gebaut = new LocalQuizRuntime({
          quizPackage,
          ...(lifelines === undefined ? {} : { lifelines }),
        })
        setGriff({ runtime: gebaut, fehler: null })
      })
      .catch((ursache: unknown) => {
        if (verworfen) return
        setGriff({ runtime: null, fehler: ursache instanceof Error ? ursache.message : String(ursache) })
      })

    // Auch ein Aufbau, der waehrend des Ladens abgebrochen wird, raeumt auf.
    return () => {
      verworfen = true
      gebaut?.dispose()
      setGriff({ runtime: null, fehler: null })
    }
    // Eine neue Konfiguration heisst eine neue Laufzeit - sie steht im Spielstand.
  }, [JSON.stringify(lifelines ?? null)])

  return griff
}
