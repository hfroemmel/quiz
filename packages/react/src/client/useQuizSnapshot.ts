/**
 * Den Stand EINER Laufzeit abonnieren - gleich welcher.
 *
 * Der `QuizRuntime`-Vertrag ist die einzige Voraussetzung: Dieselbe Ansicht
 * laeuft damit gegen den Buehnenserver (`RemoteQuizRuntime`) wie im eigenen
 * Prozess (`LocalQuizRuntime`). Wer welche Laufzeit stellt, entscheidet der
 * Gastgeber - nicht die Ansicht.
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
     * Erst den aktuellen Stand uebernehmen, dann abonnieren: Zwischen dem Bau
     * der Laufzeit und diesem Effekt kann bereits eine Aenderung liegen, und
     * eine lokale Laufzeit hat ihren ersten Stand ohnehin sofort.
     */
    setSnapshot(runtime.getSnapshot())
    return runtime.subscribe(setSnapshot)
  }, [runtime])

  return snapshot
}
