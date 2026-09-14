/**
 * Smooth rendering of the image reveal.
 *
 * FAIRNESS RULE (specification 10.2): the grid on the stage and the remaining
 * seconds for the moderator come from the SAME progress variable. This hook
 * therefore computes both of them from `revealProgress` of the domain
 * package - there is no second, independent CSS animation and no separate
 * timer.
 *
 * The client only renders; it never changes the authoritative state. On
 * every snapshot it takes over the server value again, which immediately
 * corrects drift and reconnect deviations.
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
    // requestAnimationFrame only provides smooth drawing. The values themselves
    // still come from the server state.
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

  // The server state is brought into the shape the domain functions expect:
  // "time elapsed before the running section" plus the start time.
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
