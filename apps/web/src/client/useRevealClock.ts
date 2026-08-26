/**
 * Fluessige Darstellung der Bildenthuellung.
 *
 * FAIRNESSREGEL (Spezifikation 10.2): Das Raster auf der Buehne und die
 * Restsekunden beim Moderator stammen aus DERSELBEN Fortschrittsvariable.
 * Dieser Hook berechnet sie deshalb beide aus
 * `revealProgress` des Domain-Pakets - es gibt keine zweite, unabhaengige
 * CSS-Animation und keinen separaten Timer.
 *
 * Der Client rendert nur; er veraendert den autoritativen Zustand nie. Bei jedem
 * Snapshot uebernimmt er wieder den Serverwert, wodurch sich Drift und
 * Reconnect-Abweichungen sofort korrigieren.
 */
import { useEffect, useRef, useState } from 'react'
import type { PublicRevealState } from '@hfroemmel/quiz-core'
import { revealCountdownSeconds, revealProgress } from '@hfroemmel/quiz-core'

export interface RevealDisplay {
  progress: number
  countdownSeconds: number
  running: boolean
}

export function useRevealClock(
  reveal: PublicRevealState | undefined,
  snapshotServerTimeMs: number,
  serverNow: () => number,
): RevealDisplay {
  const [, forceRender] = useState(0)
  const frameRef = useRef<number | null>(null)

  const running = reveal?.status === 'running'

  useEffect(() => {
    if (!running) return
    // requestAnimationFrame sorgt nur fuer fluessiges Zeichnen. Die Werte selbst
    // kommen weiterhin aus dem Serverzustand.
    const tick = () => {
      forceRender((value) => (value + 1) % 1_000_000)
      frameRef.current = requestAnimationFrame(tick)
    }
    frameRef.current = requestAnimationFrame(tick)
    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current)
      frameRef.current = null
    }
  }, [running])

  if (!reveal) return { progress: 0, countdownSeconds: 0, running: false }

  // Der Serverzustand wird in die Form gebracht, die die Domain-Funktionen erwarten:
  // "verstrichene Zeit vor dem laufenden Abschnitt" plus Startzeitpunkt.
  const clock = {
    status: reveal.status,
    durationMs: reveal.durationMs,
    elapsedBeforeStartMs: reveal.elapsedMs,
    startedAtServerMs: running ? snapshotServerTimeMs : undefined,
  }
  const now = running ? serverNow() : snapshotServerTimeMs

  return {
    progress: revealProgress(clock, now),
    countdownSeconds: revealCountdownSeconds(clock, now),
    running,
  }
}
