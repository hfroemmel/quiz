/**
 * Enthuellungsring mit Sekundenzahl.
 *
 * FORM (Designvorgabe): Der weisse Bogen beginnt bei 12 Uhr und laeuft im
 * Uhrzeigersinn. Seine Laenge ist der RESTANTEIL - bei sieben von zehn Sekunden
 * also 252 Grad. Am Ende bleibt nur die Spur.
 *
 * FAIRNESS: Der Fortschritt kommt als Wert herein und wird hier nur gezeichnet.
 * Es darf niemals eine eigene CSS-Animation neben dem Serverfortschritt laufen,
 * sonst koennten Ring und Bildschaerfe auseinanderlaufen
 * (siehe `packages/domain/src/reveal.ts`).
 */
import styles from './ProgressRing.module.css'

interface ProgressRingProps {
  /** Verbleibender Anteil zwischen 0 und 1. */
  remaining: number
  /** Zahl in der Mitte. */
  seconds: number
  paused?: boolean
}

const SIZE = 200
const STROKE = 10
const RADIUS = (SIZE - STROKE) / 2
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

export function ProgressRing({ remaining, seconds, paused = false }: ProgressRingProps) {
  const clamped = Math.min(Math.max(remaining, 0), 1)

  return (
    <div className={styles.ring} data-paused={String(paused)}>
      <svg className={styles.svg} viewBox={`0 0 ${SIZE} ${SIZE}`} aria-hidden="true">
        <circle
          className={styles.track}
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          strokeWidth={STROKE}
        />
        <circle
          className={styles.arc}
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={CIRCUMFERENCE * (1 - clamped)}
          // Start bei 12 Uhr, Lauf im Uhrzeigersinn.
          transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
        />
      </svg>
      <span className={styles.seconds} data-seconds="">
        {seconds}
      </span>
    </div>
  )
}
