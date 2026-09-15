/**
 * Image frame of the stage - ONE component for both design worlds.
 *
 * Two jobs: show the image at the right aspect ratio, and - for image
 * guessing - hold the tile cover above it that releases it piece by piece.
 *
 * The progress arrives as a finished value. This component computes nothing
 * itself; the derivation lives in the domain layer and applies to both the
 * ring and the image alike.
 *
 * The photo sits INSIDE the frame, never as part of a frame graphic: it
 * changes with every question, the frame never does.
 */
import type { RevealGrid } from '@hfroemmel/quiz-core'
import { RevealTiles } from './RevealTiles'
import styles from './Media.module.css'

interface MediaProps {
  src?: string
  /**
   * Image guessing only: grid and progress of the reveal.
   *
   * If this value is missing, no cover lies over the image - every other
   * scene shows its photo openly.
   */
  reveal?: { grid: RevealGrid; progress: number }
  variant?: 'inline' | 'reveal' | 'solution' | 'portrait'
}

export function Media({ src, reveal, variant = 'inline' }: MediaProps) {
  if (!src) return null
  return (
    <div className={`${styles.media} ${styles[variant]}`} data-media="" data-variant={variant}>
      {/*
        * The image area as its own layer: it is exactly as large as the
        * photo, i.e. WITHOUT the inner padding the kids' world needs for its
        * drawn framing. Only that way does the tile cover sit on the image
        * and not over the artwork.
        */}
      <div className={styles.canvas}>
        <img className={styles.image} data-media-image="" src={src} alt="" />
        {reveal && <RevealTiles grid={reveal.grid} progress={reveal.progress} seedSource={src} />}
      </div>
      {/*
        * Space for a mascot peeking over the top edge of the image. Purely
        * decorative: whether anything is visible there is decided by the
        * design world in the stylesheet - the markup carries no mode name.
        */}
      <span className={styles.peek} data-peek="" aria-hidden="true" />
    </div>
  )
}
