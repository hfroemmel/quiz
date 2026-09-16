/**
 * Idle watch on the unattended device.
 *
 * WHY: a question deliberately carries no time pressure - whoever is
 * thinking should be allowed to think. That is exactly why a device without
 * a watch would sit with an open question if the players simply walk away.
 * The watch then aborts the game and releases the selection.
 *
 * It deliberately does NOT hook into a global listener: as a guest inside a
 * foreign application, the view must not register anything on the window.
 * The component reports touches itself via `notice`.
 */
import { useCallback, useEffect, useRef } from 'react'

export interface IdleWatch {
  /** Report a touch. Resets the deadline. */
  notice: () => void
}

export function useIdleWatch(options: { timeoutMs?: number; active: boolean; onIdle: () => void }): IdleWatch {
  const { timeoutMs, active } = options
  const onIdleRef = useRef(options.onIdle)
  onIdleRef.current = options.onIdle

  const lastTouchRef = useRef(0)
  const notice = useCallback(() => {
    lastTouchRef.current = Date.now()
  }, [])

  useEffect(() => {
    if (!timeoutMs || !active) return
    lastTouchRef.current = Date.now()

    /*
     * Checked at short intervals instead of with a single long timer. A
     * timer reset on every touch would trigger a recalculation on every tap;
     * here a timestamp is enough.
     */
    const interval = setInterval(() => {
      if (Date.now() - lastTouchRef.current < timeoutMs) return
      onIdleRef.current()
    }, Math.min(timeoutMs, 5_000))

    return () => clearInterval(interval)
  }, [timeoutMs, active])

  return { notice }
}
