/**
 * Zentrales Registry aller Uebergangsanimationen (Spezifikation 22.1).
 *
 * Die Domain entscheidet nur, WELCHE Phase gilt. Diese Datei entscheidet, welche
 * Animation, welche Dauer, welches Easing und welche Soundmarke dazu gehoeren.
 *
 * NEUE UEBERGANGSANIMATION HINZUFUEGEN
 *   1. Definition im Verzeichnis `transitions/` anlegen
 *   2. hier importieren und in `transitions` eintragen
 *   3. betroffene Szenenkante ueber `appliesTo` zuordnen
 *   4. `reducedMotionDurationMs` ergaenzen
 *   5. in der Entwicklungsansicht `/preview` pruefen
 *   6. visuellen Regressionstest aktualisieren (test/e2e/presentation.spec.ts)
 */
import type { PublicScene } from '@quiz/contracts'
import { prefersReducedMotion } from '../animationPresets.ts'
import type { PresentationTransitionDefinition } from './types.ts'
import { fadeThroughPause } from './fadeThrough.ts'
import { questionEnter, revealEnter, videoEnter } from './questionEnter.ts'
import { correctFeedback } from './correctFeedback.ts'
import { incorrectFeedback } from './incorrectFeedback.ts'
import { solutionReveal } from './solutionReveal.ts'
import { resultCelebration } from './resultCelebration.ts'

export const transitions: PresentationTransitionDefinition[] = [
  fadeThroughPause,
  questionEnter,
  revealEnter,
  videoEnter,
  correctFeedback,
  incorrectFeedback,
  solutionReveal,
  resultCelebration,
]

export const transitionsById = new Map(transitions.map((definition) => [definition.id, definition]))

/**
 * Waehlt den Uebergang fuer eine Szenenkante.
 *
 * Die Feedbackszene hat zwei Varianten; welche gilt, entscheidet das Ergebnis des
 * Versuchs - und das kommt aus dem Serverzustand, nicht aus der Praesentation.
 */
export function transitionFor(
  from: PublicScene | undefined,
  to: PublicScene,
  variant?: 'correct' | 'incorrect',
): PresentationTransitionDefinition | undefined {
  if (to === 'feedback') return variant === 'correct' ? correctFeedback : incorrectFeedback
  return transitions.find(
    (definition) => definition.appliesTo.to === to && (definition.appliesTo.from === '*' || definition.appliesTo.from === from),
  )
}

/** Effektive Dauer unter Beruecksichtigung von `prefers-reduced-motion`. */
export function effectiveDurationMs(definition: PresentationTransitionDefinition): number {
  return prefersReducedMotion() ? definition.reducedMotionDurationMs : definition.durationMs
}

/** CSS-Variablen, mit denen eine Szene ihre Animation parametriert. */
export function transitionStyle(definition: PresentationTransitionDefinition | undefined): Record<string, string> {
  if (!definition) return {}
  return {
    '--transition-duration': `${effectiveDurationMs(definition)}ms`,
    '--transition-delay': `${definition.delayMs ?? 0}ms`,
    '--transition-easing': definition.easing,
  }
}
