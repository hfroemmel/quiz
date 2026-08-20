/**
 * Die Decke ueber dem Bild beim Bilderkennen.
 *
 * Sie liegt als Raster aus Kacheln UEBER dem Foto; aufgedeckt wird, indem eine
 * Kachel verschwindet. Das Bild selbst bleibt unangetastet - es ist von der
 * ersten Sekunde an vollstaendig und scharf da, nur eben verdeckt. Deshalb ist
 * eine einmal offene Kachel sofort scharf und bleibt es.
 *
 * WAS HIER NICHT PASSIERT: gerechnet wird nichts. Welche Kachel wann faellt,
 * steht im Aufdeckplan der Domain (`revealTilePlan`); dieses Bauteil vergleicht
 * ihn mit dem Fortschritt. Ein eigener Zeitgeber waere die zweite Wahrheit, die
 * Countdown und Bild auseinanderlaufen liesse.
 *
 * Die Kacheln liegen in Leserichtung im Raster - Index 0 links oben. Ihre Lage
 * ist damit fest: Eine Kachel deckt immer denselben Bildausschnitt auf.
 */
import { useMemo } from 'react'
import type { RevealGrid } from '@quiz/contracts'
import { revealSeed, revealTilePlan } from '@quiz/domain'
import styles from './RevealTiles.module.css'

interface RevealTilesProps {
  grid: RevealGrid
  /** Fortschritt 0..1 aus derselben Quelle wie der Countdown. */
  progress: number
  /**
   * Woraus der Startwert der Reihenfolge stammt - in der Regel die Bildadresse.
   *
   * Sie ist auf jedem Screen dieselbe und wechselt mit der Frage; damit sehen
   * alle Zuschauer dasselbe Muster, ohne dass der Server es mitschickt.
   */
  seedSource: string
}

export function RevealTiles({ grid, progress, seedSource }: RevealTilesProps) {
  const plan = useMemo(() => revealTilePlan(grid, revealSeed(seedSource)), [grid, seedSource])

  return (
    <div
      className={styles.tiles}
      data-reveal-tiles=""
      style={{
        gridTemplateColumns: `repeat(${grid.columns}, 1fr)`,
        gridTemplateRows: `repeat(${grid.rows}, 1fr)`,
        ['--reveal-tile-fade' as string]: `${grid.tileFadeMs}ms`,
      }}
      aria-hidden="true"
    >
      {plan.map((openAt, index) => (
        <span
          key={index}
          className={styles.tile}
          data-reveal-tile=""
          data-open={String(progress >= openAt)}
        />
      ))}
    </div>
  )
}
