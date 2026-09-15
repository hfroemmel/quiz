/**
 * The cover over the image during image guessing.
 *
 * It sits as a grid of tiles OVER the photo; revealing means a tile
 * disappears. The image itself stays untouched - it is complete and sharp
 * from the first second on, just covered. That is why a tile, once open, is
 * immediately sharp and stays that way.
 *
 * WHAT DOES NOT HAPPEN HERE: nothing is computed. Which tile falls when is
 * stored in the domain's reveal plan (`revealTilePlan`); this component just
 * compares it against the progress. A timer of its own would be a second
 * truth alongside the server's clock - the image would then run differently
 * for every viewer.
 *
 * The tiles sit in the grid in reading order - index 0 is top left. Their
 * position is therefore fixed: a tile always reveals the same section of the
 * image.
 */
import { useMemo } from 'react'
import type { RevealGrid } from '@hfroemmel/quiz-core'
import { revealSeed, revealTilePlan } from '@hfroemmel/quiz-core'
import styles from './RevealTiles.module.css'

interface RevealTilesProps {
  grid: RevealGrid
  /** Progress 0..1 from the server's reveal clock. */
  progress: number
  /**
   * What the order's seed value is derived from - normally the image URL.
   *
   * It is the same on every screen and changes with the question; that way
   * every viewer sees the same pattern without the server having to send it.
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
