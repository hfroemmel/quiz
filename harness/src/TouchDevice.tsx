/**
 * The player view on its own - the harness for touch operation.
 *
 * It runs the same component as the kiosk device, just in the browser and
 * with a fresh runtime on every page load. That's exactly what's handy
 * here: a reload is the reset button the device doesn't have.
 */
import { QuizGame } from '@hfroemmel/quiz-react'
import { useLocalRuntime } from './useLocalRuntime'

export function TouchDevice({
  audience,
  idleTimeoutMs,
  showDetailsAfterSolution,
  layout,
  zoom,
}: {
  audience: string
  idleTimeoutMs?: number
  /**
   * How small the host wants the composition - the setting a media table
   * makes so a person standing at it can take the whole screen in. It is the
   * host's and not the device's, which is why it is a parameter here too:
   * what a zoom does to an arrangement is only visible below 1.
   */
  zoom?: number
  /**
   * Which arrangement the device draws around the game - the harness plays
   * both, because both are shipped: `live` is the seat at an operator's
   * table, `kiosk` the device standing on its own in a foyer.
   */
  layout?: 'live' | 'kiosk'
  /**
   * Read the background of a question at the device instead of having it told.
   *
   * It is a rule of the content, and the fixture content does not set it - in
   * a hall the moderator tells the background, and that is the default. The
   * harness can turn it on for one run so the step is testable without every
   * other suite getting an extra screen after each solution.
   */
  showDetailsAfterSolution?: boolean
}) {
  const { runtime, errors } = useLocalRuntime(
    showDetailsAfterSolution ? { rules: { showDetailsAfterSolution: true } } : {},
  )

  if (errors) return <p style={{ padding: '2rem' }}>Das Quiz konnte nicht geladen werden: {errors}</p>
  if (!runtime) return <p style={{ padding: '2rem' }}>Das Quiz wird vorbereitet...</p>

  return (
    <QuizGame
      runtime={runtime}
      audience={audience}
      {...(layout === undefined ? {} : { layout })}
      {...(zoom === undefined ? {} : { zoom })}
      {...(idleTimeoutMs === undefined ? {} : { idleTimeoutMs })}
    />
  )
}
