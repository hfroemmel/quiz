/**
 * Buehnenscreen: waehlt die Szene, wendet den passenden Uebergang an und spielt die
 * gekoppelte Soundmarke ab.
 *
 * TRENNUNG VON ZUSTAND UND DARSTELLUNG (Spezifikation 22.1):
 *  - Welche Szene gilt, entscheidet allein `view.scene` und damit der Server.
 *  - Welche Animation, Dauer, Easing und Soundmarke dazu gehoeren, entscheidet das
 *    Registry unter `transitions/`.
 *  - Diese Komponente meldet keine Fertigstellung zurueck; der fachliche
 *    Phasenwechsel haengt nicht an `animationend`.
 *
 * Ein schneller Doppelklick oder ein doppelt gesendeter Snapshot kann keinen
 * Uebergang doppelt ausloesen, weil der Uebergang an der Szenen-IDENTITAET haengt
 * (Szene + Transition-ID des Servers), nicht am Eintreffen einer Nachricht.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import type { Command, PublicQuizViewModel } from '@quiz/contracts'
import { useRevealClock } from '../client/useRevealClock.ts'
import { playCue } from './soundCues.ts'
import { SoundProvider } from './SoundProvider.tsx'
import { useStageSounds } from './useStageSounds.ts'
import { effectiveDurationMs, transitionFor, transitionStyle } from './transitions/registry.ts'
import { PauseScene } from './scenes/PauseScene.tsx'
import { QuestionScene } from './scenes/QuestionScene.tsx'
import { RevealScene } from './scenes/RevealScene.tsx'
import { VideoScene } from './scenes/VideoScene.tsx'
import { FeedbackScene } from './scenes/FeedbackScene.tsx'
import { SolutionScene } from './scenes/SolutionScene.tsx'
import { ResultScene } from './scenes/ResultScene.tsx'
import { StartScene } from './scenes/StartScene.tsx'
import { StageHeader, type StageHeaderSlots } from './StageHeader.tsx'
import type { SceneProps } from './scenes/sceneProps.ts'

export interface StageScreenProps {
  view: PublicQuizViewModel
  serverNow: () => number
  /** Nur der Audio-Master spielt Sounds und Videoton ab. */
  isAudioMaster: boolean
  /** Der Buehnenclient darf ausschliesslich Medienstatus zurueckmelden. */
  onReport?: (command: Command) => void
  /** Die Operatorvorschau ist dieselbe Komposition in kleiner Flaeche. */
  variant?: 'stage' | 'preview'
  /**
   * Bedienelemente des Operators, die im Entwurf ueber der Flaeche liegen.
   *
   * Sie werden hier NUR eingesetzt, damit sie an den Kacheln ausgerichtet sind.
   * Das Buehnenfenster uebergibt nichts und zeigt sie deshalb nie.
   */
  headerSlots?: StageHeaderSlots
}

export function StageScreen({
  view,
  serverNow,
  isAudioMaster,
  onReport,
  variant = 'stage',
  headerSlots,
}: StageScreenProps) {
  const reveal = useRevealClock(view.reveal, view.serverTimeMs, serverNow)
  const sceneProps: SceneProps = { view, reveal, serverNow, variant }

  // Klaenge, die innerhalb einer Szene entstehen - siehe `useStageSounds`.
  const play = useMemo(
    () => (cueId: Parameters<typeof playCue>[0]) => playCue(cueId, { enabled: view.soundEnabled, isAudioMaster }),
    [view.soundEnabled, isAudioMaster],
  )
  useStageSounds(view, reveal, play)

  const feedbackVariant = view.feedback?.outcome === 'correct' ? 'correct' : 'incorrect'
  const previousScene = useRef<PublicQuizViewModel['scene'] | undefined>(undefined)
  const transition = useMemo(
    () => transitionFor(previousScene.current, view.scene, feedbackVariant),
    [view.scene, feedbackVariant],
  )

  // Ein Uebergang gilt genau einmal je Szeneneintritt. Die Kennung enthaelt die
  // Transition-ID des Servers, damit wiederholte Snapshots nichts erneut ausloesen.
  const entryKey = `${view.scene}:${view.transition?.id ?? view.revision}`
  const [activeKey, setActiveKey] = useState(entryKey)
  const playedRef = useRef<string | null>(null)

  useEffect(() => {
    if (playedRef.current === entryKey) return
    playedRef.current = entryKey
    setActiveKey(entryKey)
    previousScene.current = view.scene

    if (transition?.soundCueId) {
      playCue(transition.soundCueId, { enabled: view.soundEnabled, isAudioMaster })
    }
    // Die Animationsklasse wird nach ihrer Dauer wieder entfernt, damit ein erneuter
    // Eintritt in dieselbe Szene sie sauber neu starten kann.
    const timer = transition ? setTimeout(() => setActiveKey(`${entryKey}:done`), effectiveDurationMs(transition)) : null
    return () => {
      if (timer) clearTimeout(timer)
    }
  }, [entryKey, transition, view.scene, view.soundEnabled, isAudioMaster])

  const animating = activeKey === entryKey
  const activeClass = animating ? (transition?.classNames?.active ?? '') : ''

  return (
    <SoundProvider enabled={view.soundEnabled} isAudioMaster={isAudioMaster}>
      <div
        className={`stage stage--${variant} stage--scene-${view.scene}`}
        style={{ ...themeVariables(view), ...transitionStyle(transition) }}
        data-scene={view.scene}
        data-phase={view.phase}
        data-transition={transition?.id ?? 'none'}
      >
        {/*
          * Unscharfes Fragebild als Atmosphaere hinter der Szene.
          *
          * FAIRNESS BEIM BILDERKENNEN: Dort laeuft die Enthuellung als eigene
          * Fortschrittsvariable; der Hintergrund darf ihr nicht vorgreifen. Er
          * wird deshalb in den Enthuellungsphasen deutlich staerker weichgezeichnet
          * und staerker abgedunkelt - sichtbar bleibt Stimmung, keine Silhouette.
          *
          * `aria-hidden`: reine Dekoration, kein Inhalt.
          */}
        {view.question?.imageUrl && (
          <div
            className={`stage__backdrop ${isRevealing(view) ? 'stage__backdrop--veiled' : ''}`}
            style={{ backgroundImage: `url(${view.question.imageUrl})` }}
            aria-hidden="true"
          />
        )}

        <StageHeader view={view} slots={headerSlots} />

        <div key={entryKey} className={`scene-root ${activeClass} ${transition?.classNames?.to ?? ''}`}>
          {renderScene(view, sceneProps, isAudioMaster, onReport)}
        </div>
      </div>
    </SoundProvider>
  )
}

/**
 * Laeuft gerade eine Bildenthuellung? Dann ist das Bild selbst die Aufgabe.
 * `reveal-ready` zaehlt dazu: Dort steht das Bild bei voller Unschaerfe und
 * niemand hat es je scharf gesehen.
 */
function isRevealing(view: PublicQuizViewModel): boolean {
  return view.phase === 'reveal-ready' || view.phase === 'reveal-running' || view.phase === 'reveal-paused' || (view.scene === 'reveal' && view.phase === 'answer-locked')
}

function renderScene(
  view: PublicQuizViewModel,
  props: SceneProps,
  isAudioMaster: boolean,
  onReport?: (command: Command) => void,
) {
  switch (view.scene) {
    case 'start':
      return <StartScene {...props} />
    case 'pause':
      return <PauseScene {...props} />
    case 'question':
      return <QuestionScene {...props} />
    case 'reveal':
      return <RevealScene {...props} />
    case 'video':
      return <VideoScene {...props} isAudioMaster={isAudioMaster} onReport={onReport} />
    case 'feedback':
      return <FeedbackScene {...props} />
    case 'solution':
      return <SolutionScene {...props} />
    case 'result':
      return <ResultScene {...props} />
  }
}

/**
 * Theme des aktiven Quizmodus als CSS-Custom-Properties.
 * Damit kann das Kinderquiz ein eigenes Farbsystem besitzen, ohne dass irgendwo im
 * Code eine Modus-Sonderbehandlung noetig waere.
 */
export function themeVariables(view: PublicQuizViewModel): Record<string, string> {
  const variables: Record<string, string> = {}
  for (const [name, value] of Object.entries(view.theme.colors)) {
    variables[`--color-${name}`] = value
  }
  if (view.theme.headingFont) variables['--font-heading'] = view.theme.headingFont
  if (view.theme.bodyFont) variables['--font-body'] = view.theme.bodyFont
  return variables
}
