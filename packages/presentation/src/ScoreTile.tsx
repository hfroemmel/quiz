/**
 * Punktekachel mit Hochzaehlen und Sternen (Animationskatalog B).
 *
 * Zwei freigegebene Bewegungen laufen hier zusammen:
 *   `score-count-up`  die Ziffern zaehlen vom alten zum neuen Wert
 *   `score-stars`     bei einem ANSTIEG laeuft die gelieferte Sternegrafik ueber
 *                     der Kachel
 *
 * WICHTIG: Die Animation erzeugt keinen eigenen Wert. Sie interpoliert
 * ausschliesslich zwischen zwei Snapshotwerten des Servers und endet immer exakt
 * auf dem Serverwert. Trifft waehrend des Zaehlens ein neuer Snapshot ein,
 * beginnt sie von der aktuellen Anzeige aus neu - der Zielwert bleibt der des
 * Servers.
 *
 * Bei reduzierter Bewegung steht der neue Wert sofort, und die Sterne entfallen.
 */
import { useEffect, useRef, useState } from 'react'
import { animationClips } from './animationAssets.ts'
import { prefersReducedMotion, presentationTiming } from './animationPresets.ts'
import { AnimationClip } from './ui/AnimationClip.tsx'
import { Tile, type TileSize } from './ui/Tile.tsx'

export function ScoreTile({ score, size = 'header' }: { score: number; size?: TileSize }) {
  const [displayed, setDisplayed] = useState(score)
  const [celebrationKey, setCelebrationKey] = useState<number | null>(null)
  const previous = useRef(score)

  useEffect(() => {
    const from = previous.current
    previous.current = score
    if (from === score) return

    if (prefersReducedMotion()) {
      setDisplayed(score)
      return
    }

    if (score > from) setCelebrationKey(score)

    const start = performance.now()
    let frame = 0
    const step = (now: number) => {
      const ratio = Math.min((now - start) / presentationTiming.scoreCountUpMs, 1)
      setDisplayed(Math.round(from + (score - from) * ratio))
      if (ratio < 1) frame = requestAnimationFrame(step)
    }
    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
  }, [score])

  useEffect(() => {
    if (celebrationKey === null) return
    const timer = setTimeout(() => setCelebrationKey(null), animationClips.stars.durationMs)
    return () => clearTimeout(timer)
  }, [celebrationKey])

  return (
    /*
     * `data-score` traegt den SERVERWERT, waehrend die Anzeige noch hochzaehlt.
     * Tests und Diagnose lesen ihn und sind damit unabhaengig davon, wo die
     * Animation gerade steht.
     */
    <div className="score-tile" data-score={score}>
      <Tile label="Punkte" value={displayed} size={size} className="tile--score" />
      {celebrationKey !== null && (
        <div className="score-tile__stars" aria-hidden="true">
          <AnimationClip clipId="stars" restartKey={celebrationKey} />
        </div>
      )}
    </div>
  )
}
