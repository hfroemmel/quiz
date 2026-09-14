/**
 * The video part of a video question (spec 12).
 *
 * The video belongs to the SAME question as the answers that follow it, it
 * is not a question of its own. While it plays, the buzzer is locked
 * server-side.
 *
 * THE FLOW RUNS IN ONE DIRECTION. The server publishes a directive
 * (`view.video`), this scene carries it out, and that is the end of the
 * path. What happens here - loads, plays, is done - is not reported to
 * anyone else: no command back, no status in the server state, no display at
 * the operator's desk. The operator needs none of it to move on.
 *
 * THE DIRECTIVE IS AN IDENTIFIER, NOT STATE. What is remembered locally is
 * which directive was last carried out - question and identifier together:
 *
 *   same directive -> do nothing (re-render, repeated snapshot)
 *   new directive  -> start from second zero
 *
 * That also settles reconnecting without it being a special case: a stage
 * that reloads knows no identifier yet and carries out the standing
 * directive exactly once.
 *
 * PLAYBACK ONLY HAPPENS WHERE SOMEONE IS WATCHING: on the stage and on the
 * touch device. The operator's preview shows the same area at the same
 * size, but empty - a second media element would cost compute time on the
 * same machine and would inevitably drift out of sync. What the room sees is
 * what is on the stage.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import type { Command } from '@hfroemmel/quiz-core'
import { textsFor } from '../texts'
import styles from './scenes.module.css'
import type { SceneProps } from './sceneProps'

interface VideoSceneProps extends SceneProps {
  /** Only the audio master plays the sound. */
  isAudioMaster?: boolean
  /**
   * The device's command to the server - used only on the touch device.
   *
   * The stage reports NOTHING back. On the touch device, though, there is no
   * operator: there, the device is its own control desk and shows the
   * question itself after the video.
   */
  onCommand?: (command: Command) => void
}

/**
 * The last directive carried out - MODULE-WIDE, not in the component.
 *
 * The stage rebuilds the scene node on every transition (it is keyed on the
 * transition's id). If this marker lived in the component, it would vanish
 * along with it, and the same directive would start over a second time in
 * the middle of the video. Here it survives the rebuild - and is dropped
 * exactly when it should be: on reloading the page, where the standing
 * directive MUST be caught up on.
 *
 * One window shows one stage, so a single value is enough.
 */
let lastExecuted: string | null = null

export function VideoScene({ view, variant, isAudioMaster = true, onCommand }: VideoSceneProps) {
  const t = textsFor(view)
  const elementRef = useRef<HTMLVideoElement | null>(null)
  const question = view.question
  const request = view.video
  const plays = variant !== 'preview'
  /*
   * On the touch device nobody stands there to press "Frage einblenden" -
   * there, it moves on by itself after the video. In the room this step
   * belongs to the operator, and the stage sends not a single command.
   */
  const advancesItself = variant === 'touch'
  /*
   * Exactly ONCE per question. The command would indeed be rejected the
   * second time (the phase is over by then), but a device that sends the
   * same request repeatedly is a device that has been misunderstood.
   */
  const advancedRef = useRef<string | null>(null)
  const goOn = useCallback(() => {
    if (!advancesItself || !question || advancedRef.current === question.id) return
    advancedRef.current = question.id
    onCommand?.({ type: 'SHOW_QUESTION_AFTER_VIDEO' })
  }, [advancesItself, question?.id, onCommand])

  /*
   * The browser refused audible playback.
   *
   * This is not a media error, but the autoplay policy of a window nobody
   * has clicked in yet - it does not occur in the desktop shell (see
   * `autoplayPolicy` there). The picture must run regardless: a silent video
   * is unpleasant in the room, a frozen one is an outage. It is reported in
   * the console of the window it concerns, and nowhere else.
   */
  const [soundRefused, setSoundRefused] = useState(false)
  useEffect(() => setSoundRefused(false), [isAudioMaster])
  const muted = !isAudioMaster || soundRefused

  const games = useCallback((element: HTMLVideoElement) => {
    void element.play().catch((error: Error) => {
      if (error.name === 'NotAllowedError' && !element.muted) {
        console.warn('Video ohne Ton gestartet: Das Fenster erlaubt noch keine hörbare Wiedergabe.', error)
        setSoundRefused(true)
        return
      }
      /*
       * "AbortError" means a newer directive superseded the start attempt.
       * Anything else is a genuine problem with the file - and stays in this
       * window, because the operator gets nothing from knowing about it.
       */
      if (error.name === 'AbortError') return
      console.error('Video konnte nicht abgespielt werden.', error)
    })
  }, [])

  useEffect(() => {
    const element = elementRef.current
    if (!element || !plays) return

    /*
     * No directive, or one for a different question: then the video simply
     * sits there. A directive that does not belong to the displayed question
     * is a straggler - otherwise it would start the wrong video.
     */
    if (!request || !question || request.questionId !== question.id) return
    // Question AND identifier: otherwise two questions could carry the same identifier.
    const task = `${request.questionId}:${request.requestId}`
    if (lastExecuted === task) return
    lastExecuted = task

    /*
     * From the top means from the top: pause, reset, start.
     *
     * STARTED IMMEDIATELY, even if the file is still loading - the browser
     * then begins as soon as it can, and at zero. If it is not ready yet,
     * the follow-up below catches the start; that is the case where `play()`
     * had no effect. All the waiting here is purely local: nobody outside
     * this window learns of it.
     */
    element.pause()
    element.currentTime = 0
    games(element)
    if (element.readyState >= 2 /* HAVE_CURRENT_DATA */) return

    const ready = () => {
      if (element.paused) games(element)
    }
    element.addEventListener('canplay', ready, { once: true })
    return () => element.removeEventListener('canplay', ready)
  }, [request?.questionId, request?.requestId, question?.id, plays, games])

  /*
   * QUESTION CHANGE AND UNMOUNT STOP PLAYBACK. The element belongs to the
   * scene: if it kept running on exit, the sound would keep playing under the
   * next question.
   *
   * The marker is NOT cleared here - it carries the question within it, and
   * rebuilding the scene is not a new directive.
   */
  useEffect(() => {
    const element = elementRef.current
    return () => element?.pause()
  }, [question?.id])

  /*
   * WITHOUT A FILE THERE IS NOTHING TO WAIT FOR.
   *
   * In the room, the operator is there and moves on when ready. On the
   * device nobody is there - a missing file must not halt the flow there, or
   * the quiz would get stuck on this question.
   */
  useEffect(() => {
    if (!question || question.videoUrl) return
    goOn()
  }, [question?.id, question?.videoUrl, goOn])

  if (!question) return null

  return (
    <div className={`${styles.scene} ${styles.video}`}>
      <div className={styles.videoBox}>
        {/*
         * Der Platzhalter ist die Flaeche des Videos, nicht seine Beigabe: Buehne
         * und Operatorvorschau zeigen dasselbe Rechteck an derselben Stelle, und
         * das Medium legt sich auf der Buehne hinein. Fehlt es oder laedt es noch,
         * bleibt die Komposition trotzdem stehen.
         */}
        <div className={styles.videoFrame} data-video-placeholder>
          {plays && question.videoUrl && (
            <video
              ref={elementRef}
              className={styles.videoPlayer}
              src={question.videoUrl}
              muted={muted}
              /*
               * PRELOADED, BUT NOT STARTED. The file sits ready as soon as
               * the question is up; it may only start on a directive.
               */
              preload="auto"
              playsInline
              loop={false}
              /*
               * The end is a local event. In the room NOTHING happens as a
               * result - the last frame stays on screen until the operator
               * moves on. Only the touch device, which has no operator,
               * shows the question itself afterward.
               */
              onEnded={goOn}
              /*
               * And if the file does not play at all, it is exactly the same
               * on the device: move on. In the room it has no consequence -
               * there, the operator decides whether to try again, show the
               * question, or skip it.
               */
              onError={goOn}
            />
          )}
          {!question.videoUrl && <p className={styles.videoMissing}>{t('video.missing')}</p>}
        </div>
      </div>
    </div>
  )
}
