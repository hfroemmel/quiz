/**
 * Wie weit ist das Video, und wie lange laeuft es noch?
 *
 * Die Rechnung steht hier und nicht in der Szene, weil sie ohne Browser pruefbar
 * sein soll: Sie ist der Unterschied zwischen einem Operator, der weiss, wann er
 * dran ist, und einem, der raet.
 *
 * GERECHNET WIRD GEGEN DIE SERVERZEIT. Die Position im Ansichtsmodell gilt fuer
 * den Zeitpunkt des Schnappschusses (`view.serverTimeMs`); weitergezaehlt wird
 * von dort mit der Serverzeit dieses Clients. Die Uhr des jeweiligen Rechners
 * bleibt aussen vor - sie geht an jedem Platz ein Stueck anders.
 */
import type { PublicVideoState } from '@hfroemmel/quiz-core'

export interface VideoProgress {
  /** Bereits gespielte Zeit in Millisekunden. */
  playedMs: number
  /** Verbleibende Zeit - offen, solange niemand die Laufzeit gemeldet hat. */
  remainingMs?: number
}

export function videoProgress(video: PublicVideoState, snapshotMs: number, nowMs: number): VideoProgress {
  const seitdem = video.status === 'playing' ? Math.max(0, nowMs - snapshotMs) : 0
  const playedMs = Math.max(0, video.positionMs + seitdem)

  if (video.durationMs === undefined) return { playedMs }
  return { playedMs: Math.min(playedMs, video.durationMs), remainingMs: Math.max(0, video.durationMs - playedMs) }
}

/**
 * Millisekunden als `m:ss`.
 *
 * AUFGERUNDET, nicht abgerundet: Eine Anzeige, die bei 0:00 noch eine halbe
 * Sekunde laufen laesst, ist fuer den, der auf den Einsatz wartet, eine halbe
 * Sekunde Ratlosigkeit. So steht die Null erst da, wenn wirklich Schluss ist.
 */
export function formatiereDauer(ms: number): string {
  const sekunden = Math.ceil(Math.max(0, ms) / 1000)
  const minuten = Math.floor(sekunden / 60)
  return `${minuten}:${String(sekunden % 60).padStart(2, '0')}`
}
