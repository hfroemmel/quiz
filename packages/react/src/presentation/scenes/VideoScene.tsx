/**
 * Videophase einer Videofrage (Spezifikation 12).
 *
 * Das Video ist Teil DERSELBEN Frage, nicht eine eigene Frage. Waehrend es laeuft,
 * ist der Buzzer serverseitig gesperrt.
 *
 * Wiedergabe und Position folgen dem Serverzustand; der Client startet nichts von
 * sich aus (kein Autoplay mit Ton). Kann das Medium nicht geladen werden, meldet der
 * Client das an den Server, damit der Operator eine verstaendliche Meldung und die
 * Aktion "Frage ueberspringen" bekommt.
 *
 * ABGESPIELT WIRD DORT, WO JEMAND ZUSCHAUT: auf der Buehne und am Touchgeraet.
 * Die Operatorvorschau zeigt denselben Platzhalter in derselben Groesse, aber kein
 * zweites Medium: Ein Video, das an zwei Stellen laeuft, kostet Rechenzeit auf
 * demselben Rechner, laeuft unweigerlich auseinander und meldet Ladefehler
 * doppelt. Was der Operator hier braucht, ist die Komposition - gefahren wird das
 * Video ueber seine Bedienleiste, und was der Saal sieht, steht auf der Buehne.
 *
 * Am Touchgeraet gibt es keine Vorschau daneben: Dort IST diese Flaeche das Bild.
 * Und es ist zugleich der Client, der die Laufzeit meldet - ohne ihn wuesste der
 * Server im Selbstbedienungsbetrieb nicht, wann das Video zu Ende ist.
 */
import { useEffect, useRef, useState } from 'react'
import type { Command } from '@hfroemmel/quiz-core'
import styles from './scenes.module.css'
import type { SceneProps } from './sceneProps'

interface VideoSceneProps extends SceneProps {
  /** Nur der Audio-Master spielt den Ton ab. */
  isAudioMaster?: boolean
  onReport?: (command: Command) => void
}

export function VideoScene({ view, variant, isAudioMaster = true, onReport }: VideoSceneProps) {
  const elementRef = useRef<HTMLVideoElement | null>(null)
  const question = view.question
  const video = view.video
  const plays = variant !== 'preview'

  /*
   * Der Browser hat die hoerbare Wiedergabe verweigert.
   *
   * Das ist KEIN Medienfehler und darf deshalb auch nicht als solcher gemeldet
   * werden - es ist die Autoplay-Regel des Fensters, in dem noch niemand
   * geklickt hat. Das Bild muss trotzdem laufen: Ein stummes Video ist im Saal
   * unangenehm, ein stehendes ist ein Ausfall. Sobald die Tonhoheit hier
   * ankommt, wird der Versuch wiederholt.
   */
  const [soundRefused, setSoundRefused] = useState(false)
  useEffect(() => setSoundRefused(false), [isAudioMaster])
  const muted = !isAudioMaster || soundRefused

  useEffect(() => {
    const element = elementRef.current
    if (!element || !video) return

    // Position nur nachziehen, wenn sie deutlich abweicht - sonst ruckelt die Wiedergabe.
    const target = video.positionMs / 1000
    if (Math.abs(element.currentTime - target) > 0.6) element.currentTime = target

    if (video.status === 'playing' && element.paused) {
      void element.play().catch((error: Error) => {
        if (error.name === 'NotAllowedError' && !element.muted) {
          setSoundRefused(true)
          return
        }
        /*
         * "AbortError" heisst: Ein neuerer Befehl hat den Startversuch abgeloest -
         * typischerweise ein Pausieren, das waehrend des Anlaufs eintrifft. Das
         * ist kein Medienfehler, und es als solchen zu melden hinterliesse die
         * Meldung "Video nicht verfuegbar" unter einem laufenden Video.
         */
        if (error.name === 'AbortError') return
        onReport?.({ type: 'REPORT_VIDEO_STATUS', error: error.message })
      })
    }
    if (video.status !== 'playing' && !element.paused) element.pause()
  }, [video, muted, onReport])

  if (!question) return null

  return (
    <div className={`${styles.scene} ${styles.video}`}>
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
            playsInline
            onLoadedMetadata={(event) =>
              onReport?.({ type: 'REPORT_VIDEO_STATUS', durationMs: event.currentTarget.duration * 1000 })
            }
            onError={() => onReport?.({ type: 'REPORT_VIDEO_STATUS', error: 'Datei konnte nicht geladen werden' })}
            /*
             * Es laeuft - damit ist jede fruehere Fehlermeldung ueberholt. Gemeldet
             * wird nur dann, wenn wirklich eine steht: Sonst schickte jedes
             * Fortsetzen einen Befehl, den niemand braucht.
             */
            onPlaying={() => {
              if (video?.hasError) onReport?.({ type: 'REPORT_VIDEO_STATUS' })
            }}
          />
        )}
        {!question.videoUrl && (
          <p className={styles.videoMissing}>Kein Video hinterlegt.</p>
        )}
      </div>
      {video?.hasError && <p className={styles.videoError}>Video nicht verfügbar.</p>}
    </div>
  )
}
