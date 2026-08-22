/**
 * Buzzer- und Berechtigungsregeln (Spezifikation 8 und 10.3).
 *
 * DRY-Regel: Ob ein Spieler buzzern darf, wird ausschliesslich hier entschieden.
 * Hardware-Buzzer (Tasten `A`/`B`) und die manuelle Spielerauswahl des Operators
 * laufen durch dieselbe Pruefung, damit der Fallback nicht andere Regeln hat.
 */
import type { CommandRejectionReason, GamePhase, GameState, PlayerId, PlayerState } from '@quiz/contracts'

/**
 * Phasen, in denen der Server ueberhaupt Buzzer-Ereignisse annimmt.
 *
 * `video-playing` fehlt hier bewusst: waehrend des Videos darf nicht gebuzzert
 * werden. Weil die Berechtigung allein an der Phase haengt, kann es die verbotene
 * Kombination "Video laeuft und Buzzer offen" strukturell nicht geben.
 *
 * `reveal-paused` ist enthalten: Wenn der Operator die Enthuellung anhaelt, bleibt
 * die Antwortmoeglichkeit bestehen - eingefroren ist nur das Bild.
 */
const buzzablePhases: readonly GamePhase[] = ['buzzer-open', 'reveal-running', 'reveal-paused']

export function isBuzzablePhase(phase: GamePhase): boolean {
  return buzzablePhases.includes(phase)
}

export interface BuzzDecision {
  allowed: boolean
  reason?: CommandRejectionReason
  message?: string
}

/**
 * Darf `playerId` jetzt den Zuschlag bekommen?
 *
 * Der Server entscheidet atomar: Nach dem ersten akzeptierten Buzzer ist
 * `buzzer.open` false, jedes weitere Ereignis wird abgewiesen, bis die Spielregel
 * erneut freigibt. Ein kuenstlicher Gleichstand zweier Buzzer muss nicht behandelt
 * werden - massgeblich ist die Reihenfolge der Befehlsannahme.
 */
export function evaluateBuzz(state: GameState, playerId: PlayerId): BuzzDecision {
  if (state.status !== 'active') {
    return { allowed: false, reason: 'no-active-game', message: 'Es laeuft gerade kein Spiel.' }
  }
  if (state.phase === 'answer-locked' && state.buzzer.acceptedPlayerId) {
    // Haeufigster Fall: Ein Spieler hat den Zuschlag und der andere haemmert weiter
    // auf den Buzzer. Das verdient eine eigene, verstaendliche Begruendung.
    return {
      allowed: false,
      reason: 'buzzer-already-taken',
      message: 'Ein Spieler hat bereits den Zuschlag. Mit "Buzzer zuruecksetzen" erneut freigeben.',
    }
  }
  if (!isBuzzablePhase(state.phase)) {
    return {
      allowed: false,
      reason: 'invalid-phase',
      message: 'In dieser Phase ist der Buzzer gesperrt. Zuerst die Antwortphase freigeben.',
    }
  }
  if (!state.buzzer.open) {
    if (state.buzzer.acceptedPlayerId) {
      return {
        allowed: false,
        reason: 'buzzer-already-taken',
        message: 'Ein Spieler hat bereits den Zuschlag. Mit "Buzzer zuruecksetzen" erneut freigeben.',
      }
    }
    return { allowed: false, reason: 'buzzer-closed', message: 'Der Buzzer ist derzeit gesperrt.' }
  }
  const player = state.players.find((entry) => entry.id === playerId)
  if (!player) {
    return { allowed: false, reason: 'invalid-payload', message: 'Unbekannter Spieler.' }
  }
  if (player.lockedForCurrentQuestion) {
    return {
      allowed: false,
      reason: 'player-locked',
      message: `${player.label} hatte bei dieser Frage bereits den ersten Versuch.`,
    }
  }
  return { allowed: true }
}

/**
 * Ein anderer Spieler, der bei dieser Frage noch antworten darf.
 *
 * Das ist die einzige Stelle, an der entschieden wird, ob es eine zweite Chance
 * gibt. Im Einzelspiel gibt es niemanden - deshalb faellt die zweite Chance dort
 * weg, ohne dass die Zustandsmaschine einen Sonderfall braucht.
 */
export function eligibleOpponent(state: GameState, playerId: PlayerId | null): PlayerState | undefined {
  return state.players.find((player) => player.id !== playerId && !player.lockedForCurrentQuestion)
}

/** Der Spieler, der aktuell antworten darf - unabhaengig davon, wie er bestimmt wurde. */
export function activePlayerId(state: GameState): PlayerId | undefined {
  if (state.phase === 'second-chance') {
    return state.players.find((player) => !player.lockedForCurrentQuestion)?.id
  }
  return state.buzzer.acceptedPlayerId
}
