/**
 * Reveal clock of the image reveal (specification 10.1 - 10.3).
 *
 * CENTRAL FAIRNESS RULE: every display of the reveal - the grid on the stage as
 * well as the remaining seconds for the moderator - is computed from the
 * **same** progress variable. An independent CSS animation must never run next
 * to a separate JavaScript timer. The stage screen renders smoothly with
 * `requestAnimationFrame`, but always derives the progress from these functions
 * and the last server value.
 *
 * The server stores only three things: start time of the running section, time
 * already elapsed before it and the status. From that the progress is
 * reproducible at any time - also after a reconnect or a restart.
 */
import type { RevealClockState, RevealGrid } from '../contracts'

export function createRevealClock(durationMs: number): RevealClockState {
  return { status: 'idle', durationMs, elapsedBeforeStartMs: 0 }
}

/** Elapsed time at `nowMs`, correct regardless of the status. */
export function revealElapsedMs(clock: RevealClockState, nowMs: number): number {
  if (clock.status === 'completed') return clock.durationMs
  if (clock.status !== 'running' || clock.startedAtServerMs === undefined) {
    return clamp(clock.elapsedBeforeStartMs, 0, clock.durationMs)
  }
  const runningFor = Math.max(0, nowMs - clock.startedAtServerMs)
  return clamp(clock.elapsedBeforeStartMs + runningFor, 0, clock.durationMs)
}

/** Normalised progress 0..1. The only basis of every display. */
export function revealProgress(clock: RevealClockState, nowMs: number): number {
  if (clock.durationMs <= 0) return 1
  return clamp(revealElapsedMs(clock, nowMs) / clock.durationMs, 0, 1)
}

/**
 * Remaining seconds, from `durationSeconds` down to `0`.
 *
 * FOR THE DIRECTION ONLY: no number stands on the stage - there the tiles are
 * the clock. The moderator, however, needs to know how long they have left.
 * `ceil` makes the number jump to 0 only at exactly 0 remaining time.
 */
export function revealCountdownSeconds(clock: RevealClockState, nowMs: number): number {
  const durationSeconds = clock.durationMs / 1000
  return Math.ceil((1 - revealProgress(clock, nowMs)) * durationSeconds)
}

/**
 * Reveal plan of the grid: per tile the progress from which it is open.
 *
 * The result is an array in READING ORDER - index 0 is the top-left tile. The
 * presentation only compares `progress >= plan[index]` and needs no timer of
 * its own; so the fairness rule above also holds for the grid.
 *
 * THE ORDER, in three ingredients:
 *
 *   1. Distance to the assumed motif. Far outside first, centre last - so the
 *      recognisable part stays covered until the end.
 *   2. Scatter. Without it the reveal would be a wandering ring; with it the
 *      tiles jump across the area without the centre falling early.
 *   3. A seed that comes from the question. That way stage, operator and
 *      moderator see THE SAME pattern without the server sending an order -
 *      and the same question always uncovers the same way.
 *
 * The last tile opens at exactly 1: at zero seconds the image is completely
 * visible, no tile remains.
 */
export function revealTilePlan(grid: RevealGrid, seed: number): number[] {
  const count = grid.columns * grid.rows
  if (count <= 0) return []

  const random = pseudoRandom(seed)
  const ranked = Array.from({ length: count }, (_, index) => ({
    index,
    /* A high value reveals early. */
    score: focusDistance(grid, index) * (1 - grid.jitter) + random() * grid.jitter,
  })).sort((a, b) => b.score - a.score)

  const plan = new Array<number>(count)
  ranked.forEach((tile, position) => {
    plan[tile.index] = (position + 1) / count
  })
  return plan
}

/**
 * Distance of a tile to the assumed motif, normalised to 0..1.
 *
 * Measured from the CENTRE of the tile so that the grid plays no role: a finer
 * grid does not shift the order, it only refines it. The divisor is the largest
 * distance possible in the image, so that the scatter above acts in the same
 * order of magnitude as the distance.
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
 * Seed from a string - the same for all clients.
 *
 * No randomness at runtime: `Math.random()` would create a different pattern on
 * every screen, and two viewers would see different pictures.
 */
export function revealSeed(source: string): number {
  let hash = 2_166_136_261
  for (let i = 0; i < source.length; i++) {
    hash ^= source.charCodeAt(i)
    hash = Math.imul(hash, 16_777_619)
  }
  return hash >>> 0
}

/** Reproducible sequence in 0..1 (Mulberry32). */
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

/** Freezes the current state exactly. After `resumeReveal` it continues there. */
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

/** Reveal completely. Deliberately does NOT lock the buzzer (specification 10.1). */
export function completeReveal(clock: RevealClockState): RevealClockState {
  return { ...clock, status: 'completed', elapsedBeforeStartMs: clock.durationMs, startedAtServerMs: undefined }
}

/** Technical correction: back to second 10. Clearly separate from "reset buzzer". */
export function resetReveal(clock: RevealClockState): RevealClockState {
  return { status: 'idle', durationMs: clock.durationMs, elapsedBeforeStartMs: 0, startedAtServerMs: undefined }
}

/** Has the time run out? Display state only - buzzing stays allowed afterwards. */
export function isRevealFinished(clock: RevealClockState, nowMs: number): boolean {
  return clock.status === 'completed' || revealProgress(clock, nowMs) >= 1
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}
