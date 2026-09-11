/**
 * Punktekarte eines Spielers - EIN Bauteil fuer beide Gestaltungswelten.
 *
 * Aufbau in beiden Welten gleich: zwei Zellen, jede mit kleiner Beschriftung und
 * grossem Wert. Gespiegelt wird der INHALT, nicht die Zeichnung - bei Spieler 1
 * steht die Nummer links, bei Spieler 2 der Punktestand.
 *
 *   Spieler 1   [Spieler|1][Punkte|100]
 *   Spieler 2   [Punkte|100][Spieler|2]
 *
 * Ob daraus zwei aneinanderstossende Milchglaskacheln werden oder eine
 * gezeichnete Papierkarte, entscheidet allein `Score.module.css` anhand der
 * Klasse an der Buehne.
 *
 * ZAEHLEN STATT SPRINGEN (Animationskatalog B): Die Ziffern zaehlen vom alten
 * zum neuen Wert und enden immer exakt auf dem Serverwert. Die Animation
 * erzeugt keinen eigenen Wert; trifft waehrend des Zaehlens ein neuer Snapshot
 * ein, beginnt sie von der aktuellen Anzeige aus neu.
 */
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { animationClips } from '../animationAssets'
import { prefersReducedMotion, presentationTiming } from '../animationPresets'
import { useSound } from '../SoundProvider'
import { AnimationClip } from '../../ui/AnimationClip'
import { JokerTypeIcon } from './jokerIcons'
import styles from './Score.module.css'

export type ScoreSize = 'header' | 'result'

interface ScoreProps {
  /** Beschriftung des Spielers; die Nummer darin traegt die Karte. */
  label: string
  score: number
  /** Spieler am Zug. */
  active?: boolean
  /** Gesperrt: sichtbar, aber zurueckgenommen. */
  locked?: boolean
  /*
   * Die beiden Woerter der Karte kommen von aussen, damit die Buehne in jeder
   * Sprache dieselbe Karte zeigt. Ohne Angabe bleibt es beim Deutschen - eine
   * Karte ohne Beschriftung waere schlechter als eine in der falschen Sprache.
   */
  playerText?: string
  pointsText?: string
  /** Punkte links, Spielernummer rechts - so steht Spieler 2 im Entwurf. */
  mirrored?: boolean
  size?: ScoreSize
  /**
   * An audience joker is in effect for this player - show the group mark
   * instead of the player number.
   *
   * THREE STATES, NOT TWO. `undefined` means "this game has no jokers": the
   * card then renders exactly the markup it rendered before the feature
   * existed, which is what keeps a kiosk pixel-identical. `false` means the
   * game has jokers but none is in effect - the mark is in the DOM, invisible,
   * so the change is a crossfade and not a swap.
   *
   * WHAT IT DOES NOT CHANGE: the score, the colours, the layout - and who the
   * answer belongs to. The mark says "the room is being asked", nothing else.
   */
  audienceMarker?: boolean
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
  audienceMarker,
}: ScoreProps) {
  // Die Buehne zeigt keine Eigennamen, nur die Nummer aus der Beschriftung.
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
      {audienceMarker === undefined ? (
        numberValue
      ) : (
        /*
         * Both marks sit in the SAME cell of a one-cell grid, so neither can
         * move the other and the crossfade happens on the spot.
         */
        <span
          className={styles.playerMark}
          data-score-marker={audienceMarker ? 'audience' : 'number'}
          style={{ '--joker-marker-fade': `${presentationTiming.jokerMarkerFadeMs}ms` } as CSSProperties}
        >
          {numberValue}
          <JokerTypeIcon type="audience" className={styles.groupMark} />
        </span>
      )}
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
     * `data-score` traegt den SERVERWERT, waehrend die Anzeige noch hochzaehlt.
     * Tests und Diagnose lesen ihn und sind damit unabhaengig davon, wo die
     * Animation gerade steht.
     */
    <div
      className={[styles.score, styles[size], mirrored ? styles.mirrored : ''].filter(Boolean).join(' ')}
      data-score={score}
      data-player={number}
      data-active={String(active)}
      data-locked={String(locked)}
    >
      {mirrored ? points : player}
      {mirrored ? player : points}
    </div>
  )
}

/** Hochzaehlende Ziffern mit Sternen beim Anstieg. */
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
