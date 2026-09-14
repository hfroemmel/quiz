/**
 * Die Spieleransicht allein - der Pruefstand des Touchbetriebs.
 *
 * Sie betreibt dieselbe Komponente wie das Kioskgeraet, nur im Browser und mit
 * frischer Laufzeit bei jedem Seitenaufruf. Genau das ist hier praktisch: Ein
 * Neuladen ist der Ruecksetzknopf, den es am Geraet nicht gibt.
 */
import { QuizGame } from '@hfroemmel/quiz-kiosk'
import { useLocalRuntime } from './useLocalRuntime'

export function TouchDevice({
  audience,
  idleTimeoutMs,
}: {
  audience: string
  idleTimeoutMs?: number
}) {
  const { runtime, errors } = useLocalRuntime()

  if (errors) return <p style={{ padding: '2rem' }}>Das Quiz konnte nicht geladen werden: {errors}</p>
  if (!runtime) return <p style={{ padding: '2rem' }}>Das Quiz wird vorbereitet...</p>

  return (
    <QuizGame
      runtime={runtime}
      audience={audience}
      {...(idleTimeoutMs === undefined ? {} : { idleTimeoutMs })}
    />
  )
}
