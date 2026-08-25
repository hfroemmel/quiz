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
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
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
import { StageHeader, type StageHeaderSlots } from './stage/StageHeader.tsx'
import { Mascot } from './stage/Mascot.tsx'
import { kidsPreloadImages } from './stage/kidsAssets.ts'
import { useStageTheme } from './stageTheme.ts'
import stage from './stage/Stage.module.css'
import type { SceneAnswering, SceneProps } from './scenes/sceneProps.ts'

export interface StageScreenProps {
  view: PublicQuizViewModel
  serverNow: () => number
  /** Nur der Audio-Master spielt Sounds und Videoton ab. */
  isAudioMaster: boolean
  /** Der Buehnenclient darf ausschliesslich Medienstatus zurueckmelden. */
  onReport?: (command: Command) => void
  /**
   * Dieselbe Komposition in einer anderen Flaeche: klein in der Operatorvorschau,
   * zwischen den Buzzern am Touchgeraet.
   */
  variant?: 'stage' | 'preview' | 'touch'
  /**
   * Bedienelemente des Operators, die im Entwurf ueber der Flaeche liegen.
   *
   * Sie werden hier NUR eingesetzt, damit sie an den Kacheln ausgerichtet sind.
   * Das Buehnenfenster uebergibt nichts und zeigt sie deshalb nie.
   */
  headerSlots?: StageHeaderSlots
  /**
   * Fussleiste des Touchgeraets: die beiden Spielerecken mit Punkten und
   * Buzzern, nach dem Spiel der Abschluss.
   *
   * WARUM SIE IN DIE BUEHNE GEHOERT und nicht darum herum: Sie traegt die
   * Farben und Groessen der Buehne - beides steht in Custom Properties und
   * Containereinheiten der Buehnenflaeche. Ausserhalb stuende sie ohne beides
   * da.
   *
   * Am Touchgeraet ist deshalb die GANZE Geraeteflaeche die Buehne; die Szene
   * ist der Teil ueber der Leiste.
   */
  pads?: { bottom?: ReactNode }
  /** Nur am Touchgeraet: macht die Antwortzeilen der Szene zu Schaltflaechen. */
  answering?: SceneAnswering
}

export function StageScreen({
  view,
  serverNow,
  isAudioMaster,
  onReport,
  variant = 'stage',
  headerSlots,
  pads,
  answering,
}: StageScreenProps) {
  const reveal = useRevealClock(view.reveal, view.serverTimeMs, serverNow)
  const sceneProps: SceneProps = { view, reveal, serverNow, variant, ...(answering ? { answering } : {}) }

  // Klaenge, die innerhalb einer Szene entstehen - siehe `useStageSounds`.
  const play = useMemo(
    () => (cueId: Parameters<typeof playCue>[0]) => playCue(cueId, { enabled: view.soundEnabled, isAudioMaster }),
    [view.soundEnabled, isAudioMaster],
  )
  useStageSounds(view, play)

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

  /*
   * Gestaltungswelt der Buehne. Sie kommt aus dem Theme des Quizmodus, nicht aus
   * einem Modusnamen im Code: `theme.skin` ist konfiguriert (siehe
   * `packages/contracts/src/content.ts`). Ein neuer Modus bekommt die
   * Kinderwelt damit ohne Codeaenderung.
   */
  const skin = view.theme.skin ?? 'default'
  const kids = skin === 'kids'
  /*
   * Helle oder dunkle Fassung - nur die Buehne der Erwachsenen kennt beide. Die
   * Kinderwelt bringt ihr eigenes Papier mit und bleibt davon unberuehrt.
   */
  const [stageTheme] = useStageTheme()
  // Die Kinderwelt bringt ihr eigenes Papier mit - dort gibt es nichts zu waehlen.
  const theme = kids ? null : stageTheme

  /*
   * Zeichnungen der Kinderwelt einmal in den Browsercache holen.
   *
   * Auf dem Buehnenscreen darf waehrend der Show nichts nachladen: Ein Chip, der
   * erst beim Wechsel auf 'richtig' geholt wird, blitzt vor dem Saal leer auf.
   * Der Effekt laeuft genau einmal je Sitzung, sobald die Kinderwelt aktiv ist.
   */
  useEffect(() => {
    if (!kids) return
    for (const source of kidsPreloadImages) {
      const image = new Image()
      image.src = source
    }
  }, [kids])

  return (
    <SoundProvider enabled={view.soundEnabled} isAudioMaster={isAudioMaster}>
      <div
        /*
          * Die Gestaltungswelt steht als EINZIGE Klasse an der Buehne. Alles
          * darunter - Kopfzeile, Fragetafel, Antwortzeilen - traegt in beiden
          * Welten dasselbe Markup; unterschieden wird ausschliesslich hier.
          */
        className={['stage', `stage--${skin}`, theme && `stage--${theme}`, `stage--${variant}`, `stage--scene-${view.scene}`]
          .filter(Boolean)
          .join(' ')}
        style={transitionStyle(transition)}
        data-scene={view.scene}
        data-presentation={view.question?.presentationType}
        data-skin={skin}
        data-theme={theme ?? skin}
        data-phase={view.phase}
        /*
         * Stehen die Antworten schon auf der Buehne? Die Kinderwelt haengt
         * Karlchen daran: Er tritt erst auf, wenn es etwas zu waehlen gibt -
         * waehrend die Frage vorgelesen wird, soll nichts vom Text ablenken.
         */
        data-answers-shown={String((view.visibleOptions?.length ?? 0) > 0)}
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
            className={stage.backdrop}
            data-veiled={String(isRevealing(view))}
            style={{ backgroundImage: `url(${view.question.imageUrl})` }}
            aria-hidden="true"
          />
        )}

        <StageHeader view={view} slots={headerSlots} variant={variant} />

        <div key={entryKey} className={`${stage.sceneRoot} ${activeClass} ${transition?.classNames?.to ?? ''}`}>
          {renderScene(view, sceneProps, isAudioMaster, onReport)}
        </div>

        {pads?.bottom}

        {/*
          * Figuren- und Koernungsebene. Beide sind reine Dekoration und stehen
          * in jeder Welt im Markup; ob dort etwas zu sehen ist, entscheidet
          * allein das Stylesheet.
          */}
        <Mascot />
        <div className={stage.grain} aria-hidden="true" />
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
 *
 * Damit kann das Kinderquiz ein eigenes Farbsystem besitzen, ohne dass irgendwo im
 * Code eine Modus-Sonderbehandlung noetig waere.
 *
 * WICHTIG - GEHOERT AUF DEN RAHMEN, NICHT AUF DIE BUEHNE: Die Werte kommen als
 * Inline-Stil, und ein Inline-Stil schlaegt jede Klassenregel. Stuenden sie an
 * der Buehne selbst, koennte `.stage--bright` seine Farben nicht mehr setzen.
 * Vom umgebenden Rahmen aus werden sie geerbt - und eine Angabe am Element
 * sticht jeden geerbten Wert.
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
