/**
 * Stage screen: picks the scene, applies the matching transition and plays the
 * coupled sound cue.
 *
 * SEPARATION OF STATE AND PRESENTATION (specification 22.1):
 *  - Which scene applies is decided solely by `view.scene` and thus by the server.
 *  - Which animation, duration, easing and sound cue belong to it is decided by
 *    the registry under `transitions/`.
 *  - This component never reports completion back; the domain phase change
 *    never depends on `animationend`.
 *
 * A fast double-click or a snapshot sent twice cannot trigger a transition
 * twice, because the transition hangs off the scene's IDENTITY (scene + the
 * server's transition id), not off a message arriving.
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
import { useQuizTheme } from './QuizProvider'
import { useStageTheme } from './stageTheme'
import { useDecodedImage } from './useDecodedImage'
import stage from './stage/Stage.module.css'
import type { SceneAnswering, SceneProps } from './scenes/sceneProps'

export interface StageScreenProps {
  view: PublicQuizViewModel
  serverNow: () => number
  /** Only the audio master plays sounds and video audio. */
  isAudioMaster: boolean
  /**
   * May this window sound a video it plays? Without a value: yes, because a
   * window that shows the picture is the one the room hears.
   */
  isVideoAudioMaster?: boolean
  /** The stage client may only report media status back. */
  onCommand?: (command: Command) => void
  /**
   * The same composition in a different area: small in the operator preview,
   * between the buzzers on the touch device.
   */
  variant?: 'stage' | 'preview' | 'touch'
  /**
   * Operator controls that sit over the area in the design.
   *
   * They are used here ONLY so that they line up with the tiles. The stage
   * window never passes them in and therefore never shows them.
   */
  headerSlots?: StageHeaderSlots
  /**
   * Host areas INSIDE the stage.
   *
   * `bottom` is the touch device's footer bar, `overlay` a layer over the
   * whole stage - for instance the extra-information step a host inserts
   * between the solution and the next question.
   *
   * WHY THEY BELONG INSIDE THE STAGE and not around it: they carry the
   * stage's colours and sizes - both live in custom properties and container
   * units of the stage area, including the zoom level. Outside it they would
   * stand there with none of that and would keep their full size on a small
   * display.
   *
   * On the touch device the WHOLE device area is therefore the stage; the
   * scene is the part above the footer bar.
   */
  pads?: { bottom?: ReactNode; overlay?: ReactNode }
  /** Only on the touch device: turns the scene's answer rows into buttons. */
  answering?: SceneAnswering
}

export function StageScreen({
  view,
  serverNow,
  isAudioMaster,
  isVideoAudioMaster = true,
  onCommand,
  variant = 'stage',
  headerSlots,
  pads,
  answering,
}: StageScreenProps) {
  const reveal = useRevealClock(view.reveal, view.serverTimeMs, serverNow)
  /*
   * The image background only appears once the image is ready - see
   * `useDecodedImage`. Until then the scene sits on the stage's gradient.
   */
  const baseImage = useDecodedImage(view.question?.imageUrl)
  const sceneProps: SceneProps = { view, reveal, serverNow, variant, ...(answering ? { answering } : {}) }

  // Sounds that arise within a scene - see `useStageSounds`.
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

  // A transition applies exactly once per scene entry. The id contains the
  // server's transition id, so that repeated snapshots never trigger it again.
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
    // The animation class is removed again after its duration, so that a renewed
    // entry into the same scene can restart it cleanly.
    const timer = transition ? setTimeout(() => setActiveKey(`${entryKey}:done`), effectiveDurationMs(transition)) : null
    return () => {
      if (timer) clearTimeout(timer)
    }
  }, [entryKey, transition, view.scene, view.soundEnabled, isAudioMaster])

  const animating = activeKey === entryKey
  const activeClass = animating ? (transition?.classNames?.active ?? '') : ''

  /*
   * The stage's design world. It comes from the quiz mode's theme, not from a
   * mode name in the code: `theme.skin` is configured (see
   * `packages/contracts/src/content.ts`). A new mode therefore gets the
   * children's world without a code change.
   */
  const skin = view.theme.skin ?? 'default'
  const kids = skin === 'kids'
  /*
   * Light or dark version - only the adults' stage knows both. The
   * children's world brings its own paper and stays unaffected by it.
   */
  const [stageTheme] = useStageTheme()
  /*
   * A HOST THEME WINS - AND IT HAS TO SIT ON THIS ELEMENT TO DO SO.
   *
   * The light variant of the stage declares its colours on the stage element
   * (`.stage--default.stage--bright` in `palette.css`), and a declaration on the
   * element beats a value inherited from the frame. A host theme handed down
   * from above would therefore be overwritten exactly where it matters; as an
   * inline style on this element it wins, because nothing beats that.
   *
   * Its base also decides the variant then: whoever designs a dark stage has
   * designed it dark, and the light-or-dark preference of a window applies
   * where no host says otherwise.
   */
  const hostTheme = useQuizTheme()
  const ownTheme = hostTheme && hostTheme.skin === skin ? hostTheme : null
  // The children's world brings its own paper - there is nothing to choose there.
  const theme = kids ? null : (ownTheme?.base ?? stageTheme)

  /*
   * Preload the children's world's drawings into the browser cache once.
   *
   * Nothing may load during the show on the stage screen: a chip only fetched
   * when switching to 'correct' flashes up empty in front of the audience.
   * The effect runs exactly once per session, as soon as the children's world
   * is active.
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
          * The design world stands as the ONLY class on the stage. Everything
          * below it - header, question board, answer rows - carries the same
          * markup in both worlds; the distinction is made exclusively here.
          */
        className={['stage', `stage--${skin}`, theme && `stage--${theme}`, `stage--${variant}`, `stage--scene-${view.scene}`]
          .filter(Boolean)
          .join(' ')}
        style={{ ...transitionStyle(transition), ...ownTheme?.variables }}
        data-scene={view.scene}
        data-presentation={view.question?.presentationType}
        data-skin={skin}
        data-theme={theme ?? skin}
        /* Paper or dark - for a host that recolours its own frame around it. */
        data-surface={theme === 'dark' ? 'dark' : 'light'}
        data-phase={view.phase}
        /*
         * Are the answers already on stage? The children's world hangs
         * Karlchen on that: he only appears once there is something to choose -
         * while the question is being read out, nothing should distract from
         * the text.
         */
        data-answers-shown={String((view.visibleOptions?.length ?? 0) > 0)}
        data-transition={transition?.id ?? 'none'}
      >
        {/*
          * Blurred question image as atmosphere behind the scene.
          *
          * FAIRNESS IN THE IMAGE REVEAL: the reveal runs there as its own
          * progress variable; the background must not get ahead of it. It is
          * therefore blurred noticeably more strongly and darkened more
          * strongly during the reveal phases - what remains visible is mood,
          * not a silhouette.
          *
          * `aria-hidden`: pure decoration, no content.
          */}
        {view.question?.imageUrl && (
          <div
            /*
              * THE ADDRESS IS THE IDENTITY. A new question thereby inserts a
              * new element instead of recolouring the old one: that way the
              * background starts fresh with every question and the old one is
              * gone in the same instant. A cross-fade would be wrong here -
              * for a moment the previous question's image would stand on the
              * new one.
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
          * THE SCENE AND ITS FIGURE ARE ONE AREA.
          *
          * Karlchen belongs to the scene's composition and not to the device:
          * he stands at its bottom-right corner, the same in every host. On
          * the touch device the scene is a scaled-down stage in the middle -
          * if the figure is measured against the whole device, it lands on
          * the buzzer beneath it. Here it is measured against THIS area, so
          * it is correct everywhere without a second rule.
          *
          * It sits BESIDE the scene box and not inside it: that is rebuilt
          * and animated on every scene change, and a figure inside it would
          * be carried along with every change.
          */}
        <div className={stage.sceneArea}>
          <div
            key={entryKey}
            className={`${stage.sceneRoot} ${activeClass} ${transition?.classNames?.to ?? ''}`}
            data-scene-root=""
          >
            {renderScene(view, sceneProps, isVideoAudioMaster, onCommand)}
          </div>
          <Mascot />
        </div>

        {pads?.bottom}

        {/* Grain layer - pure decoration, in the markup in every world. */}
        <div className={stage.grain} aria-hidden="true" />

        {/*
          * The host's layer sits at the very top - above the scene, footer
          * bar and grain. It deliberately does NOT sit inside the scene box:
          * that is rebuilt and animated on every scene change, and a layer
          * meant to stay in place for one step would be carried along with it.
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
 * Is an image reveal currently running? Then the image itself is the task.
 * `reveal-ready` counts too: there the image sits at full blur and nobody
 * has ever seen it sharp.
 */
function isRevealing(view: PublicQuizViewModel): boolean {
  return view.phase === 'reveal-ready' || view.phase === 'reveal-running' || view.phase === 'reveal-paused' || (view.scene === 'reveal' && view.phase === 'answer-locked')
}

function renderScene(
  view: PublicQuizViewModel,
  props: SceneProps,
  isVideoAudioMaster: boolean,
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
      return <VideoScene {...props} isVideoAudioMaster={isVideoAudioMaster} onCommand={onCommand} />
    case 'feedback':
      return <FeedbackScene {...props} />
    case 'solution':
      return <SolutionScene {...props} />
    case 'result':
      return <ResultScene {...props} />
  }
}

