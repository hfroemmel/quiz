/**
 * Enthuellungsuhr des Bilderkennens (Spezifikation 10.1 - 10.3).
 *
 * ZENTRALE FAIRNESSREGEL: Jede Anzeige der Enthuellung - das Raster auf der
 * Buehne wie die Restsekunden beim Moderator - wird aus **derselben**
 * Fortschrittsvariable berechnet. Es darf niemals eine unabhaengige CSS-Animation
 * neben einem separaten JavaScript-Timer laufen. Der Buehnenscreen rendert zwar
 * fluessig mit `requestAnimationFrame`, leitet den Fortschritt aber immer aus
 * diesen Funktionen und dem letzten Serverwert ab.
 *
 * Der Server speichert nur drei Dinge: Startzeit des laufenden Abschnitts,
 * bereits verstrichene Zeit davor und den Status. Daraus ist der Fortschritt zu
 * jedem Zeitpunkt reproduzierbar - auch nach Reconnect oder Neustart.
 */
import type { RevealClockState, RevealGrid } from '../contracts'

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

/** Normalisierter Fortschritt 0..1. Einzige Basis jeder Anzeige. */
export function revealProgress(clock: RevealClockState, nowMs: number): number {
  if (clock.durationMs <= 0) return 1
  return clamp(revealElapsedMs(clock, nowMs) / clock.durationMs, 0, 1)
}

/**
 * Restsekunden, von `durationSeconds` bis `0`.
 *
 * NUR FUER DIE REGIE: Auf der Buehne steht keine Zahl - dort sind die Kacheln
 * die Uhr. Der Moderator dagegen muss wissen, wie lange er noch hat.
 * `ceil` sorgt dafuer, dass die Zahl erst bei exakt 0 Restzeit auf 0 springt.
 */
export function revealCountdownSeconds(clock: RevealClockState, nowMs: number): number {
  const durationSeconds = clock.durationMs / 1000
  return Math.ceil((1 - revealProgress(clock, nowMs)) * durationSeconds)
}

/**
 * Aufdeckplan des Rasters: je Kachel der Fortschritt, ab dem sie offen ist.
 *
 * Das Ergebnis ist ein Feld in LESERICHTUNG - Index 0 ist die Kachel links oben.
 * Die Praesentation vergleicht nur noch `progress >= plan[index]` und braucht
 * keinen eigenen Zeitgeber; damit gilt die Fairnessregel oben auch fuer das
 * Raster.
 *
 * DIE REIHENFOLGE, in drei Zutaten:
 *
 *   1. Abstand zum vermuteten Motiv. Weit aussen zuerst, Mitte zuletzt - so
 *      bleibt das Erkennbare bis zum Schluss verdeckt.
 *   2. Streuung. Ohne sie waere die Aufloesung ein wandernder Ring; mit ihr
 *      springen die Kacheln ueber die Flaeche, ohne dass die Mitte frueh faellt.
 *   3. Ein Startwert, der aus der Frage stammt. Damit sehen Buehne, Operator und
 *      Moderator DASSELBE Muster, ohne dass der Server eine Reihenfolge
 *      mitschicken muesste - und dieselbe Frage deckt sich immer gleich auf.
 *
 * Die letzte Kachel oeffnet bei genau 1: Bei null Sekunden ist das Bild
 * vollstaendig zu sehen, keine Kachel bleibt uebrig.
 */
export function revealTilePlan(grid: RevealGrid, seed: number): number[] {
  const count = grid.columns * grid.rows
  if (count <= 0) return []

  const random = pseudoRandom(seed)
  const ranked = Array.from({ length: count }, (_, index) => ({
    index,
    /* Hoher Wert deckt frueh auf. */
    score: focusDistance(grid, index) * (1 - grid.jitter) + random() * grid.jitter,
  })).sort((a, b) => b.score - a.score)

  const plan = new Array<number>(count)
  ranked.forEach((tile, position) => {
    plan[tile.index] = (position + 1) / count
  })
  return plan
}

/**
 * Abstand einer Kachel zum vermuteten Motiv, normiert auf 0..1.
 *
 * Gemessen wird von der MITTE der Kachel aus, damit das Raster keine Rolle
 * spielt: Ein feineres Raster verschiebt die Reihenfolge nicht, es verfeinert
 * sie nur. Der Teiler ist der groesste im Bild moegliche Abstand, damit die
 * Streuung oben in derselben Groessenordnung wirkt wie der Abstand.
 */
function focusDistance(grid: RevealGrid, index: number): number {
  const x = ((index % grid.columns) + 0.5) / grid.columns
  const y = (Math.floor(index / grid.columns) + 0.5) / grid.rows
  const dx = x - grid.focus.x
  const dy = y - grid.focus.y
  const longest = Math.hypot(Math.max(grid.focus.x, 1 - grid.focus.x), Math.max(grid.focus.y, 1 - grid.focus.y))
  return longest === 0 ? 0 : Math.hypot(dx, dy) / longest
}

/**
 * Startwert aus einer Zeichenkette - fuer alle Clients derselbe.
 *
 * Kein Zufall zur Laufzeit: `Math.random()` wuerde auf jedem Screen ein anderes
 * Muster erzeugen, und zwei Zuschauer saehen verschiedene Bilder.
 */
export function revealSeed(source: string): number {
  let hash = 2_166_136_261
  for (let i = 0; i < source.length; i++) {
    hash ^= source.charCodeAt(i)
    hash = Math.imul(hash, 16_777_619)
  }
  return hash >>> 0
}

/** Reproduzierbare Folge in 0..1 (Mulberry32). */
function pseudoRandom(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296
  }
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
