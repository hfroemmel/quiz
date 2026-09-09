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
 * Die Operatorvorschau zeigt denselben Platzhalter in derselben Groesse - darin
 * aber die RESTZEIT statt eines zweiten Mediums: Ein Video, das an zwei Stellen laeuft, kostet Rechenzeit auf
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
import { texteFuer } from '../texts'
import { formatiereDauer, videoProgress } from '../videoClock'
import { laufzeitMelden, videoangleich } from '../videoSync'
import styles from './scenes.module.css'
import type { SceneProps } from './sceneProps'

interface VideoSceneProps extends SceneProps {
  /** Nur der Audio-Master spielt den Ton ab. */
  isAudioMaster?: boolean
  onReport?: (command: Command) => void
}

export function VideoScene({ view, variant, serverNow, isAudioMaster = true, onReport }: VideoSceneProps) {
  const t = texteFuer(view)
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

  /*
   * DIE UHR DER VORSCHAU. Sie laeuft nur dort, wo kein Bild ist: Wo das Video
   * laeuft, sieht man ja, wie weit es ist. Ein Viertelsekundentakt reicht - die
   * Anzeige zeigt Sekunden, und ein Bildtakt kostete nur Rechenzeit auf
   * demselben Rechner, der gleich die Buehne fahren muss.
   */
  const [, tick] = useState(0)
  const laeuft = video?.status === 'playing'
  useEffect(() => {
    if (plays || !laeuft) return
    const uhr = setInterval(() => tick((wert) => wert + 1), 250)
    return () => clearInterval(uhr)
  }, [plays, laeuft])

  /*
   * Die zuletzt gesehene Serverposition. Sie ist der einzige Weg, einen NEUSTART
   * des Videos von seinem gewoehnlichen Weiterlaufen zu unterscheiden: Der eine
   * setzt die Position zurueck, das andere nicht. Siehe `videoSync`.
   */
  const letzteServerpositionRef = useRef<number | undefined>(undefined)

  useEffect(() => {
    const element = elementRef.current
    if (!element || !video) return

    const angleich = videoangleich(
      video,
      { positionMs: element.currentTime * 1000, paused: element.paused, ended: element.ended },
      letzteServerpositionRef.current,
    )
    letzteServerpositionRef.current = video.positionMs

    if (angleich.springeNachMs !== undefined) element.currentTime = angleich.springeNachMs / 1000

    if (angleich.starten) {
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
    if (angleich.anhalten) element.pause()
  }, [video, muted, onReport])

  if (!question) return null

  // Einmal je Bild gerechnet - beide Zweige der Anzeige lesen dieselbe Zahl.
  const fortschritt = video ? videoProgress(video, view.serverTimeMs, serverNow()) : undefined

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
            /*
             * Die Laufzeit wird nur gemeldet, wenn der Server sie noch nicht hat:
             * Zwei Fenster messen dieselbe Datei, und jede Meldung ist ein Befehl,
             * der gespeichert und an alle verteilt wird.
             */
            onLoadedMetadata={(event) => {
              const dauerMs = event.currentTarget.duration * 1000
              if (!laufzeitMelden(video?.durationMs, dauerMs)) return
              onReport?.({ type: 'REPORT_VIDEO_STATUS', durationMs: dauerMs })
            }}
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
          <p className={styles.videoMissing}>{t('video.missing')}</p>
        )}
        {!plays && question.videoUrl && video && fortschritt && !video.hasError && (
          /*
           * WAS DER OPERATOR HIER BRAUCHT, IST DIE ZEIT.
           *
           * Ein leeres Rechteck sagt ihm nur, dass gerade ein Video laeuft -
           * nicht, wann er wieder dran ist. Die Restzeit sagt es ihm; sie steht
           * an der Stelle, an der im Saal das Bild ist.
           */
          <div className={styles.videoClock} data-video-clock="">
            {video.durationMs === undefined ? (
              <>
                <span className={styles.videoClockTime}>
                  {formatiereDauer(fortschritt.playedMs)}
                </span>
                <span className={styles.videoClockLabel}>{t('video.unknownDuration')}</span>
              </>
            ) : (
              <>
                <span className={styles.videoClockTime}>
                  {formatiereDauer(fortschritt.remainingMs ?? 0)}
                </span>
                <span className={styles.videoClockLabel}>
                  {t(video.status === 'playing' ? 'video.remaining' : 'video.paused')}
                </span>
              </>
            )}
          </div>
        )}
      </div>
      {video?.hasError && <p className={styles.videoError}>{t('video.error')}</p>}
    </div>
  )
}
