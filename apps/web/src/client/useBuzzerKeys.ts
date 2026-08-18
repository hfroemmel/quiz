/**
 * Hardware-Buzzer als Tastatureingabe (Spezifikation 8.1).
 *
 * Buzzer 1 sendet `A`, Buzzer 2 sendet `B`. Die Hardware verhaelt sich wie eine
 * Tastatur, deshalb muessen Auto-Repeat und mehrfach ausgeloeste Keydown-Events
 * entprellt werden:
 *  - `event.repeat` wird ignoriert;
 *  - eine gedrueckte Taste loest erst nach dem Loslassen erneut aus;
 *  - zusaetzlich greift eine kurze Entprellzeit.
 *
 * Die eigentliche Entscheidung faellt trotzdem der Server: Er nimmt atomar den ersten
 * gueltigen Buzzer an und weist alles Weitere ab. Diese Entprellung verhindert nur
 * unnoetigen Netzwerkverkehr und irrefuehrende Ablehnungen im Protokoll.
 */
import { useEffect, useRef } from 'react'
import type { Command, PlayerId } from '@quiz/contracts'

const BUZZER_KEYS: Record<string, PlayerId> = { a: 'player-1', b: 'player-2' }
const DEBOUNCE_MS = 150

export function useBuzzerKeys(send: (command: Command) => void, enabled: boolean): void {
  const heldKeys = useRef(new Set<string>())
  const lastSentAt = useRef(new Map<string, number>())

  useEffect(() => {
    if (!enabled) return

    const onKeyDown = (event: KeyboardEvent) => {
      // In Eingabefeldern darf der Buzzer nicht mitlesen.
      const target = event.target as HTMLElement | null
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return

      const key = event.key.toLowerCase()
      const playerId = BUZZER_KEYS[key]
      if (!playerId) return
      event.preventDefault()

      if (event.repeat || heldKeys.current.has(key)) return
      const now = Date.now()
      if (now - (lastSentAt.current.get(key) ?? 0) < DEBOUNCE_MS) return

      heldKeys.current.add(key)
      lastSentAt.current.set(key, now)
      send({ type: 'BUZZ', playerId })
    }

    const onKeyUp = (event: KeyboardEvent) => {
      heldKeys.current.delete(event.key.toLowerCase())
    }

    // Verliert das Fenster den Fokus, gelten alle Tasten als losgelassen.
    const onBlur = () => heldKeys.current.clear()

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', onBlur)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
    }
  }, [send, enabled])
}
