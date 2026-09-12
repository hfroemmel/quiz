/**
 * Die Quiz-Buehne als EINE einbettbare Komponente - die kuenftige oeffentliche
 * Oberflaeche von `@hfroemmel/quiz-react`.
 *
 * Ein Gastgeber gibt eine `QuizRuntime` (lokal oder entfernt) und bekommt die
 * vollstaendige Buehne: Szenenwahl, Uebergaenge, Klaenge, Scoreboard - alles
 * abgeleitet aus den Snapshots der Runtime. Gerendert wird in den Container des
 * Gastgebers; ein globales Wurzelelement gibt es nicht.
 *
 * DER WRAPPER IST TEIL DES VERTRAGS: Die Theme-Variablen muessen auf einem
 * Rahmen UEBER der Buehne stehen (Inline-Stil schlaegt Klassenregeln, siehe
 * `themeVariables`). Frueher musste jeder Gastgeber das wissen; jetzt bringt die
 * Komponente ihren Rahmen selbst mit. `display: contents` haelt ihn aus dem
 * Layout heraus - Variablen vererben sich trotzdem.
 */
import { useCallback, useEffect, useRef, useSyncExternalStore, type ReactNode } from 'react'
import type { Command, PublicQuizViewModel, QuizRuntime } from '@hfroemmel/quiz-core'
import { deriveQuizEvents, type QuizEvent } from '@hfroemmel/quiz-core'
import { StageScreen } from './StageScreen'
import type { StageHeaderSlots } from './stage/StageHeader'
import type { SceneAnswering } from './scenes/sceneProps'
import { themeForView, themeVariables, type QuizSceneTheme } from '@hfroemmel/quiz-themes'

export interface QuizSceneProps<TView extends PublicQuizViewModel> {
  runtime: QuizRuntime<TView>
  /** Darstellung. Ohne Angabe entscheidet die Empfehlung des Inhalts (`view.theme.skin`). */
  theme?: QuizSceneTheme
  /** Spielereignisse fuer den Gastgeber, abgeleitet aus den Snapshots. */
  onEvent?: (event: QuizEvent) => void
  /** Dieselbe Komposition in einer anderen Flaeche - Buehne, Vorschau, Touchgeraet. */
  variant?: 'stage' | 'preview' | 'touch'
  /**
   * Ton erlauben, obwohl die Tonhoheit bei der Runtime liegt. Ein verdeckter
   * Gastgeber (Quiz im Hintergrund-Tab) schaltet hierueber stumm.
   */
  audible?: boolean
  headerSlots?: StageHeaderSlots
  /** Flaechen des Gastgebers innerhalb der Buehne - siehe `StageScreen.pads`. */
  pads?: { bottom?: ReactNode; overlay?: ReactNode }
  /** Nur am Touchgeraet: macht die Antwortzeilen der Szene zu Schaltflaechen. */
  answering?: SceneAnswering
}

export function QuizScene<TView extends PublicQuizViewModel>({
  runtime,
  theme,
  onEvent,
  variant = 'stage',
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
   * Ereignisableitung auf der Snapshot-Folge. Der Vergleichszustand haengt an
   * DIESER Komponente: Nach einem Neueinsetzen beginnt die Folge neu, und der
   * erste Snapshot meldet nichts - ein altes Ergebnis gehoert nicht dem neuen
   * Gastgeber.
   */
  const previousViewRef = useRef<TView | null>(null)
  useEffect(() => {
    if (!view) return
    const events = deriveQuizEvents(previousViewRef.current, view)
    previousViewRef.current = view
    if (onEvent) for (const event of events) onEvent(event)
  }, [view, onEvent])

  const serverNow = useCallback(() => runtime.serverNow(), [runtime])
  const command = useCallback((entry: Command) => void runtime.dispatch(entry), [runtime])

  if (!view) return null

  return (
    <div style={{ display: 'contents', ...themeVariables(theme ?? themeForView(view)) }} data-quiz-scene="">
      <StageScreen
        view={view}
        serverNow={serverNow}
        isAudioMaster={snapshot.connection.audioMaster && audible}
        onCommand={command}
        variant={variant}
        {...(headerSlots ? { headerSlots } : {})}
        {...(pads ? { pads } : {})}
        {...(answering ? { answering } : {})}
      />
    </div>
  )
}
