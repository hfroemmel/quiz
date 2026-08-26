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
import { useEffect, useRef, useState } from 'react'
import { animationClips } from '../animationAssets'
import { prefersReducedMotion, presentationTiming } from '../animationPresets'
import { useSound } from '../SoundProvider'
import { AnimationClip } from '../../ui/AnimationClip'
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
  /** Punkte links, Spielernummer rechts - so steht Spieler 2 im Entwurf. */
  mirrored?: boolean
  size?: ScoreSize
}

export function Score({ label, score, active = false, locked = false, mirrored = false, size = 'header' }: ScoreProps) {
  // Die Buehne zeigt keine Eigennamen, nur die Nummer aus der Beschriftung.
  const number = label.replace(/\D+/g, '') || '1'

  const player = (
    <div className={`${styles.cell} ${styles.cellPlayer}`}>
      <span className={styles.label} data-score-label="">
        Spieler
      </span>
      <span className={styles.value} data-score-value="">
        {number}
      </span>
    </div>
  )
  const points = (
    <div className={`${styles.cell} ${styles.cellPoints}`}>
      <span className={styles.label} data-score-label="">
        Punkte
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
