/**
 * A player's score card - ONE component for both design worlds.
 *
 * Structure is the same in both worlds: two cells, each with a small label
 * and a large value. The CONTENT is mirrored, not the artwork - for player 1
 * the number sits on the left, for player 2 the score does.
 *
 *   Player 1   [Player|1][Score|100]
 *   Player 2   [Score|100][Player|2]
 *
 * Whether this becomes two adjoining semi-transparent tiles or a drawn paper
 * card is decided solely by `Score.module.css`, based on the class on the
 * stage.
 *
 * COUNTING INSTEAD OF JUMPING (animation catalogue B): the digits count from
 * the old to the new value and always end exactly on the server value. The
 * animation never produces its own value; if a new snapshot arrives mid-count,
 * it restarts from the currently displayed value.
 */
import { useEffect, useRef, useState } from 'react'
import { animationClips } from '../animationAssets'
import { prefersReducedMotion, presentationTiming } from '../animationPresets'
import { useSound } from '../SoundProvider'
import { AnimationClip } from '../../ui/AnimationClip'
import styles from './Score.module.css'

export type ScoreSize = 'header' | 'result'

interface ScoreProps {
  /** The player's label; the number within it is what the card carries. */
  label: string
  score: number
  /** Player whose turn it is. */
  active?: boolean
  /** Locked: visible, but dimmed back. */
  locked?: boolean
  /*
   * The card's two words come from outside, so the stage shows the same card
   * in every language. Without one, it defaults to German - a card with no
   * label would be worse than one in the wrong language.
   */
  playerText?: string
  pointsText?: string
  /** Score on the left, player number on the right - that is how player 2 stands in the design. */
  mirrored?: boolean
  size?: ScoreSize
  /**
   * The points cell alone - no player cell beside it.
   *
   * It is the head of the kiosk layout with ONE player: there is nobody to
   * tell apart there, so "Spieler 1" says nothing, and a cell kept empty in
   * its place would say even less. The card keeps everything else - the frame,
   * the counting digits, the celebration on a rise.
   */
  pointsOnly?: boolean
}

export function Score({
  label,
  score,
  active = false,
  locked = false,
  mirrored = false,
  size = 'header',
  playerText = 'Spieler',
  pointsText = 'Punkte',
  pointsOnly = false,
}: ScoreProps) {
  // The stage shows no proper names, only the number from the label.
  const number = label.replace(/\D+/g, '') || '1'

  const numberValue = (
    <span className={styles.value} data-score-value="">
      {number}
    </span>
  )
  const player = (
    <div className={`${styles.cell} ${styles.cellPlayer}`}>
      <span className={styles.label} data-score-label="">
        {playerText}
      </span>
      {/*
        * THE NUMBER, ALWAYS. It used to give way to the group icon while an
        * audience joker was in effect for this player. The card's one job is
        * to say whose points these are, and a card that stops saying it is a
        * card with a hole in it - whatever the icon in its place meant.
        */}
      {numberValue}
    </div>
  )
  const points = (
    <div className={`${styles.cell} ${styles.cellPoints}`}>
      <span className={styles.label} data-score-label="">
        {pointsText}
      </span>
      <ScoreValue score={score} />
    </div>
  )

  return (
    /*
     * `data-score` carries the SERVER VALUE while the display is still
     * counting up. Tests and diagnostics read it and are thereby independent
     * of wherever the animation currently stands.
     */
    <div
      className={[styles.score, styles[size], mirrored ? styles.mirrored : ''].filter(Boolean).join(' ')}
      data-score={score}
      data-player={number}
      data-active={String(active)}
      data-locked={String(locked)}
      {...(pointsOnly ? { 'data-points-only': '' } : {})}
    >
      {pointsOnly ? points : mirrored ? points : player}
      {pointsOnly ? null : mirrored ? player : points}
    </div>
  )
}

/** Digits that count up, with stars on the rise. */
function ScoreValue({ score }: { score: number }) {
  const [displayed, setDisplayed] = useState(score)
  const [celebrationKey, setCelebrationKey] = useState<number | null>(null)
  const previous = useRef(score)
  const play = useSound()

  useEffect(() => {
    const from = previous.current
    previous.current = score
    if (from === score) return

    if (prefersReducedMotion()) {
      setDisplayed(score)
      return
    }

    if (score > from) {
      setCelebrationKey(score)
      play('score')
    }

    const start = performance.now()
    let frame = 0
    const step = (now: number) => {
      const ratio = Math.min((now - start) / presentationTiming.scoreCountUpMs, 1)
      setDisplayed(Math.round(from + (score - from) * ratio))
      if (ratio < 1) frame = requestAnimationFrame(step)
    }
    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
  }, [score, play])

  useEffect(() => {
    if (celebrationKey === null) return
    const timer = setTimeout(() => setCelebrationKey(null), animationClips.stars.durationMs)
    return () => clearTimeout(timer)
  }, [celebrationKey])

  return (
    <>
      <span className={`${styles.value} ${styles.valuePoints}`} data-score-value="points">
        {displayed}
      </span>
      {celebrationKey !== null && (
        <span className={styles.stars} aria-hidden="true">
          <AnimationClip clipId="stars" restartKey={celebrationKey} />
        </span>
      )}
    </>
  )
}
