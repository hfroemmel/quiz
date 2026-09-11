/**
 * Die Spieleransicht allein - der Pruefstand des Touchbetriebs.
 *
 * Sie betreibt dieselbe Komponente wie das Kioskgeraet, nur im Browser und mit
 * frischer Laufzeit bei jedem Seitenaufruf. Genau das ist hier praktisch: Ein
 * Neuladen ist der Ruecksetzknopf, den es am Geraet nicht gibt.
 */
import { QuizGame } from '@hfroemmel/quiz-kiosk'
import type { LifelineConfig } from '@hfroemmel/quiz-core'
import { useLokaleLaufzeit } from './useLokaleLaufzeit'

export function TouchGeraet({
  audience,
  idleTimeoutMs,
  lifelines,
}: {
  audience: string
  idleTimeoutMs?: number
  /**
   * Joker dieser Aufstellung. Am echten Kioskgeraet steht hier nichts - dort
   * sind sie aus. Der Pruefstand schaltet sie ueber `?lifelines=1` ein, damit
   * die Einbindung pruebar ist, ohne sie irgendwo zur Vorgabe zu machen.
   */
  lifelines?: Partial<LifelineConfig>
}) {
  const { runtime, fehler } = useLokaleLaufzeit(lifelines)

  if (fehler) return <p style={{ padding: '2rem' }}>Das Quiz konnte nicht geladen werden: {fehler}</p>
  if (!runtime) return <p style={{ padding: '2rem' }}>Das Quiz wird vorbereitet...</p>

  return (
    <QuizGame
      runtime={runtime}
      audience={audience}
      {...(idleTimeoutMs === undefined ? {} : { idleTimeoutMs })}
    />
  )
}
