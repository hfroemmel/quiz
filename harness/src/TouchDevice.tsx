/**
 * The player view on its own - the harness for touch operation.
 *
 * It runs the same component as the kiosk device, just in the browser and
 * with a fresh runtime on every page load. That's exactly what's handy
 * here: a reload is the reset button the device doesn't have.
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
