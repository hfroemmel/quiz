/**
 * The quiz stage as ONE embeddable component - the future public interface of
 * `@hfroemmel/quiz-react`.
 *
 * A host provides a `QuizRuntime` (local or remote) and gets the complete
 * stage: scene selection, transitions, sounds, scoreboard - all derived from
 * the runtime's snapshots. It renders into the host's container; there is no
 * global root element.
 *
 * THE WRAPPER IS PART OF THE CONTRACT: the theme variables have to sit on a
 * frame ABOVE the stage (inline style beats class rules, see
 * `themeVariables`). Previously every host had to know that; now the
 * component brings its own frame. `display: contents` keeps it out of the
 * layout - variables still inherit through it.
 */
import { useCallback, useEffect, useRef, useSyncExternalStore, type ReactNode } from 'react'
import type { Command, PublicQuizViewModel, QuizRuntime } from '@hfroemmel/quiz-core'
import { deriveQuizEvents, type QuizEvent } from '@hfroemmel/quiz-core'
import { StageScreen } from './StageScreen'
import type { StageHeaderSlots } from './stage/StageHeader'
import type { SceneAnswering } from './scenes/sceneProps'
import { themeVariables, type QuizSceneTheme } from '@hfroemmel/quiz-themes'
import { themeForSkin, useQuizTheme } from './QuizProvider'

export interface QuizSceneProps<TView extends PublicQuizViewModel> {
  runtime: QuizRuntime<TView>
  /**
   * Look. Without a value the theme of the surrounding `<QuizProvider>` applies
   * where it is meant for this world, otherwise the content's recommendation
   * (`view.theme.skin`).
   */
  theme?: QuizSceneTheme
  /** Game events for the host, derived from the snapshots. */
  onEvent?: (event: QuizEvent) => void
  /** The same composition in a different area - stage, preview, touch device. */
  variant?: 'stage' | 'preview' | 'touch'
  /** Which arrangement a touch device draws around the scene - see `StageScreen`. */
  layout?: 'live' | 'kiosk'
  /**
   * Allow sound, even though sound authority lies with the runtime. A hidden
   * host (quiz in a background tab) switches to muted through this.
   */
  audible?: boolean
  headerSlots?: StageHeaderSlots
  /** Host areas inside the stage - see `StageScreen.pads`. */
  pads?: { bottom?: ReactNode; overlay?: ReactNode }
  /** Only on the touch device: turns the scene's answer rows into buttons. */
  answering?: SceneAnswering
}

export function QuizScene<TView extends PublicQuizViewModel>({
  runtime,
  theme,
  onEvent,
  variant = 'stage',
  layout = 'live',
  audible = true,
  headerSlots,
  pads,
  answering,
}: QuizSceneProps<TView>) {
  const subscribe = useCallback((listener: () => void) => runtime.subscribe(listener), [runtime])
  const getSnapshot = useCallback(() => runtime.getSnapshot(), [runtime])
  const snapshot = useSyncExternalStore(subscribe, getSnapshot)
  const view = snapshot.view

  /*
   * Event derivation over the snapshot sequence. The comparison state hangs
   * off THIS component: after a remount the sequence starts over, and the
   * first snapshot reports nothing - an old result does not belong to the new
   * host.
   */
  const previousViewRef = useRef<TView | null>(null)
  useEffect(() => {
    if (!view) return
    const events = deriveQuizEvents(previousViewRef.current, view)
    previousViewRef.current = view
    if (onEvent) for (const event of events) onEvent(event)
  }, [view, onEvent])

  const hostTheme = useQuizTheme()
  const serverNow = useCallback(() => runtime.serverNow(), [runtime])
  const command = useCallback((entry: Command) => void runtime.dispatch(entry), [runtime])

  if (!view) return null

  return (
    <div
      style={{ display: 'contents', ...themeVariables(theme ?? themeForSkin(hostTheme, view.theme.skin ?? 'default')) }}
      data-quiz-scene=""
    >
      <StageScreen
        view={view}
        serverNow={serverNow}
        isAudioMaster={snapshot.connection.audioMaster && audible}
        onCommand={command}
        variant={variant}
        layout={layout}
        {...(headerSlots ? { headerSlots } : {})}
        {...(pads ? { pads } : {})}
        {...(answering ? { answering } : {})}
      />
    </div>
  )
}
