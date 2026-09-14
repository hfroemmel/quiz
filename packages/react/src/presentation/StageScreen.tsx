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
import type { Command, PublicQuizViewModel } from '@hfroemmel/quiz-core'
import { useRevealClock } from '../client/useRevealClock'
import { cssUrl } from './cssUrl'
import { playCue } from './soundCues'
import { SoundProvider } from './SoundProvider'
import { useStageSounds } from './useStageSounds'
import { effectiveDurationMs, transitionFor, transitionStyle } from './transitions/registry'
import { PauseScene } from './scenes/PauseScene'
import { QuestionScene } from './scenes/QuestionScene'
import { RevealScene } from './scenes/RevealScene'
import { VideoScene } from './scenes/VideoScene'
import { FeedbackScene } from './scenes/FeedbackScene'
import { SolutionScene } from './scenes/SolutionScene'
import { ResultScene } from './scenes/ResultScene'
import { StartScene } from './scenes/StartScene'
import { StageHeader, type StageHeaderSlots } from './stage/StageHeader'
import { Mascot } from './stage/Mascot'
import { kidsPreloadImages } from './stage/kidsAssets'
import { useStageTheme } from './stageTheme'
import { useDecodedImage } from './useDecodedImage'
import stage from './stage/Stage.module.css'
import type { SceneAnswering, SceneProps } from './scenes/sceneProps'

export interface StageScreenProps {
  view: PublicQuizViewModel
  serverNow: () => number
  /** Nur der Audio-Master spielt Sounds und Videoton ab. */
  isAudioMaster: boolean
  /** Der Buehnenclient darf ausschliesslich Medienstatus zurueckmelden. */
  onCommand?: (command: Command) => void
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
   * Flaechen des Gastgebers INNERHALB der Buehne.
   *
   * `bottom` ist die Fussleiste des Touchgeraets, `overlay` eine Ebene ueber
   * der ganzen Buehne - etwa der Zusatzinformationsschritt, den ein Gastgeber
   * zwischen Loesung und naechster Frage einschiebt.
   *
   * WARUM SIE IN DIE BUEHNE GEHOEREN und nicht darum herum: Sie tragen die
   * Farben und Groessen der Buehne - beides steht in Custom Properties und
   * Containereinheiten der Buehnenflaeche, einschliesslich der Zoomstufe.
   * Ausserhalb stuenden sie ohne alles da und behielten bei kleiner Anzeige
   * ihre volle Groesse.
   *
   * Am Touchgeraet ist deshalb die GANZE Geraeteflaeche die Buehne; die Szene
   * ist der Teil ueber der Fussleiste.
   */
  pads?: { bottom?: ReactNode; overlay?: ReactNode }
  /** Nur am Touchgeraet: macht die Antwortzeilen der Szene zu Schaltflaechen. */
  answering?: SceneAnswering
}

export function StageScreen({
  view,
  serverNow,
  isAudioMaster,
  onCommand,
  variant = 'stage',
  headerSlots,
  pads,
  answering,
}: StageScreenProps) {
  const reveal = useRevealClock(view.reveal, view.serverTimeMs, serverNow)
  /*
   * Der Bildgrund erscheint erst, wenn das Bild fertig ist - siehe
   * `useDecodedImage`. Bis dahin steht die Szene auf dem Verlauf der Buehne.
   */
  const baseImage = useDecodedImage(view.question?.imageUrl)
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
            /*
              * DIE ADRESSE IST DIE KENNUNG. Eine neue Frage setzt damit ein
              * neues Element ein, statt das alte umzufaerben: So beginnt der
              * Grund bei jeder Frage von vorn und der alte ist im selben
              * Moment weg. Ein Kreuzblenden waere hier falsch - fuer einen
              * Augenblick stuende das Bild der vorigen Frage auf der neuen.
              */
            key={view.question.imageUrl}
            className={stage.backdrop}
            data-backdrop=""
            data-veiled={String(isRevealing(view))}
            data-ready={String(baseImage === view.question.imageUrl)}
            {...(baseImage ? { style: { backgroundImage: cssUrl(baseImage) } } : {})}
            aria-hidden="true"
          />
        )}

        <StageHeader view={view} slots={headerSlots} variant={variant} />

        {/*
          * DIE SZENE UND IHRE FIGUR SIND EINE FLAECHE.
          *
          * Karlchen gehoert zur Komposition der Szene und nicht zum Geraet: Er
          * steht an ihrer unteren rechten Ecke, in jedem Gastgeber gleich. Am
          * Touchgeraet ist die Szene eine verkleinerte Buehne in der Mitte -
          * misst die Figur gegen das ganze Geraet, landet sie auf dem Buzzer
          * darunter. Hier misst sie gegen DIESE Flaeche, und damit stimmt es
          * ueberall ohne eine zweite Regel.
          *
          * Sie liegt NEBEN dem Szenenkasten und nicht darin: Der wird bei jedem
          * Szenenwechsel neu aufgebaut und animiert, und eine Figur darin ginge
          * bei jedem Wechsel mit.
          */}
        <div className={stage.sceneArea}>
          <div
            key={entryKey}
            className={`${stage.sceneRoot} ${activeClass} ${transition?.classNames?.to ?? ''}`}
            data-scene-root=""
          >
            {renderScene(view, sceneProps, isAudioMaster, onCommand)}
          </div>
          <Mascot />
        </div>

        {pads?.bottom}

        {/* Koernungsebene - reine Dekoration, in jeder Welt im Markup. */}
        <div className={stage.grain} aria-hidden="true" />

        {/*
          * Die Ebene des Gastgebers liegt ganz oben - ueber Szene, Fussleiste
          * und Koernung. Sie steht bewusst NICHT im Szenenkasten: Der wird bei
          * jedem Szenenwechsel neu aufgebaut und animiert, und eine Ebene, die
          * einen Schritt lang stehen bleiben soll, ginge dabei mit.
          */}
        {pads?.overlay && (
          <div className={stage.overlay} data-stage-overlay="">
            {pads.overlay}
          </div>
        )}
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
  onCommand?: (command: Command) => void,
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
      return <VideoScene {...props} isAudioMaster={isAudioMaster} onCommand={onCommand} />
    case 'feedback':
      return <FeedbackScene {...props} />
    case 'solution':
      return <SolutionScene {...props} />
    case 'result':
      return <ResultScene {...props} />
  }
}

