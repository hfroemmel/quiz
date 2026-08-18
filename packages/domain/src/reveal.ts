/**
 * Enthuellungsuhr des Bilderkennens (Spezifikation 10.1 - 10.3).
 *
 * ZENTRALE FAIRNESSREGEL: Countdown und Bildschaerfe werden aus **derselben**
 * Fortschrittsvariable berechnet. Es darf niemals eine unabhaengige CSS-Animation
 * neben einem separaten JavaScript-Timer laufen. Der Buehnenscreen rendert zwar
 * fluessig mit `requestAnimationFrame`, leitet den Fortschritt aber immer aus
 * diesen Funktionen und dem letzten Serverwert ab.
 *
 * Der Server speichert nur drei Dinge: Startzeit des laufenden Abschnitts,
 * bereits verstrichene Zeit davor und den Status. Daraus ist der Fortschritt zu
 * jedem Zeitpunkt reproduzierbar - auch nach Reconnect oder Neustart.
 */
import type { RevealClockState } from '@quiz/contracts'

export function createRevealClock(durationMs: number): RevealClockState {
  return { status: 'idle', durationMs, elapsedBeforeStartMs: 0 }
}

/** Verstrichene Zeit zum Zeitpunkt `nowMs`, unabhaengig vom Status korrekt. */
export function revealElapsedMs(clock: RevealClockState, nowMs: number): number {
  if (clock.status === 'completed') return clock.durationMs
  if (clock.status !== 'running' || clock.startedAtServerMs === undefined) {
    return clamp(clock.elapsedBeforeStartMs, 0, clock.durationMs)
  }
  const runningFor = Math.max(0, nowMs - clock.startedAtServerMs)
  return clamp(clock.elapsedBeforeStartMs + runningFor, 0, clock.durationMs)
}

/** Normalisierter Fortschritt 0..1. Einzige Basis fuer Countdown und Bildschaerfe. */
export function revealProgress(clock: RevealClockState, nowMs: number): number {
  if (clock.durationMs <= 0) return 1
  return clamp(revealElapsedMs(clock, nowMs) / clock.durationMs, 0, 1)
}

/**
 * Sichtbarer Countdown: laeuft von `durationSeconds` bis `0`.
 * `ceil` sorgt dafuer, dass die angezeigte Zahl erst bei exakt 0 Restzeit auf 0 springt.
 */
export function revealCountdownSeconds(clock: RevealClockState, nowMs: number): number {
  const durationSeconds = clock.durationMs / 1000
  return Math.ceil((1 - revealProgress(clock, nowMs)) * durationSeconds)
}

/**
 * Bildschaerfe: Unschaerfe in Pixeln, linear von `maxBlurPx` auf 0.
 * Bewusst hier und nicht im CSS, damit Countdown und Schaerfe nicht auseinanderlaufen.
 */
export function revealBlurPx(clock: RevealClockState, nowMs: number, maxBlurPx: number): number {
  return maxBlurPx * (1 - revealProgress(clock, nowMs))
}

export function startReveal(clock: RevealClockState, nowMs: number): RevealClockState {
  if (clock.status === 'running' || clock.status === 'completed') return clock
  return { ...clock, status: 'running', startedAtServerMs: nowMs }
}

/** Friert den aktuellen Stand exakt ein. Nach `resumeReveal` geht es dort weiter. */
export function pauseReveal(clock: RevealClockState, nowMs: number): RevealClockState {
  if (clock.status !== 'running') return clock
  return {
    ...clock,
    status: 'paused',
    elapsedBeforeStartMs: revealElapsedMs(clock, nowMs),
    startedAtServerMs: undefined,
  }
}

export function resumeReveal(clock: RevealClockState, nowMs: number): RevealClockState {
  if (clock.status === 'completed') return clock
  if (clock.status === 'running') return clock
  return { ...clock, status: 'running', startedAtServerMs: nowMs }
}

/** Vollstaendig aufdecken. Sperrt den Buzzer bewusst NICHT (Spezifikation 10.1). */
export function completeReveal(clock: RevealClockState): RevealClockState {
  return { ...clock, status: 'completed', elapsedBeforeStartMs: clock.durationMs, startedAtServerMs: undefined }
}

/** Technische Korrektur: zurueck auf Sekunde 10. Klar getrennt von "Buzzer zuruecksetzen". */
export function resetReveal(clock: RevealClockState): RevealClockState {
  return { status: 'idle', durationMs: clock.durationMs, elapsedBeforeStartMs: 0, startedAtServerMs: undefined }
}

/** Ist die Zeit abgelaufen? Nur Anzeigezustand - Buzzern bleibt danach erlaubt. */
export function isRevealFinished(clock: RevealClockState, nowMs: number): boolean {
  return clock.status === 'completed' || revealProgress(clock, nowMs) >= 1
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}
