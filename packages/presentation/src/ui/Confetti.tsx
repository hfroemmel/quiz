/**
 * Konfetti der Ergebnisansicht.
 *
 * Bewusst ohne Bibliothek: ein paar absolut positionierte Elemente mit CSS-Animation
 * genuegen. Eine Abhaengigkeit nur fuer diesen Effekt einzufuehren waere nicht
 * gerechtfertigt.
 *
 * Dauer und Reduced-Motion-Verhalten stehen zentral in den Animationspresets bzw. im
 * Stylesheet; der Effekt beeinflusst keinerlei Spiellogik.
 */
import { useMemo } from 'react'
import { confettiDurationMs } from '../transitions/resultCelebration.ts'

const PIECE_COUNT = 60

export function Confetti() {
  // Positionen einmalig bestimmen, damit sie bei jedem Re-Render stabil bleiben.
  const pieces = useMemo(
    () =>
      Array.from({ length: PIECE_COUNT }, (_, index) => ({
        left: (index * 97) % 100,
        delayMs: (index * 83) % 1_500,
        durationMs: 2_600 + ((index * 137) % 1_800),
        hue: (index * 47) % 360,
      })),
    [],
  )

  return (
    <div className="confetti" aria-hidden="true" style={{ ['--confetti-total' as string]: `${confettiDurationMs}ms` }}>
      {pieces.map((piece, index) => (
        <span
          key={index}
          className="confetti__piece"
          style={{
            left: `${piece.left}%`,
            animationDelay: `${piece.delayMs}ms`,
            animationDuration: `${piece.durationMs}ms`,
            background: `hsl(${piece.hue} 85% 60%)`,
          }}
        />
      ))}
    </div>
  )
}
