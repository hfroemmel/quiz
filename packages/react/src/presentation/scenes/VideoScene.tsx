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
 * AUFTRITT UND ABGANG SIND ANIMIERT. Beim Eintritt in die Szene faehrt die
 * Videoflaeche auf (`video-enter` im Uebergangsregistry). Ist das Video
 * durchgelaufen, meldet der Server `ended`, und die Flaeche blendet aus - im
 * gefuehrten Spiel steht der Ablauf dann, bis der Operator die Frage einblendet.
 *
 * ABGESPIELT WIRD NUR, WO JEMAND ZUSCHAUT: auf der Buehne und am Touchgeraet.
 * Die Operatorvorschau zeigt dieselbe Flaeche in derselben Groesse, darin aber
 * nur, WIE ES UM DAS VIDEO STEHT - bereit, laeuft, angehalten, zu Ende. Ein
 * zweites Medium kostete Rechenzeit auf demselben Rechner, liefe unweigerlich
 * auseinander und meldete Ladefehler doppelt. Gefahren wird das Video ueber die
 * Bedienleiste, und was der Saal sieht, steht auf der Buehne.
 *
 * Am Touchgeraet gibt es keine Vorschau daneben: Dort IST diese Flaeche das Bild.
 * Und es ist zugleich der Client, der die Laufzeit meldet - ohne ihn wuesste der
 * Server im Selbstbedienungsbetrieb nicht, wann das Video zu Ende ist.
 */
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import type { Command, PublicVideoState } from '@hfroemmel/quiz-core'
import { presentationTiming } from '../animationPresets'
import { texteFuer, type TextKey } from '../texts'
import { laufzeitMelden, serverpositionJetzt, videoangleich } from '../videoSync'
import styles from './scenes.module.css'
import type { SceneProps } from './sceneProps'

interface VideoSceneProps extends SceneProps {
  /** Nur der Audio-Master spielt den Ton ab. */
  isAudioMaster?: boolean
  onReport?: (command: Command) => void
}

/** Was die Operatorvorschau zu jedem Stand des Videos sagt. */
const statusTexte: Record<PublicVideoState['status'], TextKey> = {
  idle: 'video.status.ready',
  playing: 'video.status.playing',
  paused: 'video.status.paused',
  ended: 'video.status.ended',
}

export function VideoScene({ view, variant, serverNow, isAudioMaster = true, onReport }: VideoSceneProps) {
  const t = texteFuer(view)
  const elementRef = useRef<HTMLVideoElement | null>(null)
  const question = view.question
  const video = view.video
  const plays = variant !== 'preview'
  const ended = video?.status === 'ended'

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

    /*
     * Verglichen wird mit der Position von JETZT: Waehrend das Video laeuft,
     * kommt kein Schnappschuss, und ein Neustart ist nur daran zu erkennen, dass
     * das Element weit vor dem Server liegt. Siehe `videoSync`.
     */
    const angleich = videoangleich(
      { status: video.status, positionMs: serverpositionJetzt(video, view.serverTimeMs, serverNow()) },
      { positionMs: element.currentTime * 1000, paused: element.paused, ended: element.ended },
    )

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
    // Ein beendetes Video haelt erst nach seinem Abgang an - siehe unten.
    if (angleich.anhalten && video.status !== 'ended') element.pause()
  }, [video, view.serverTimeMs, serverNow, muted, onReport])

  /*
   * DAS ENDE LAESST DAS BILD AUSLAUFEN.
   *
   * Der Server meldet das Ende nach seiner Uhr, und das Element hinkt ihr meist
   * ein paar Bilder hinterher. Angehalten wird deshalb erst, wenn die Flaeche
   * ausgeblendet ist - sonst froere das letzte Bild mitten im Abgang ein.
   *
   * Der Zeitgeber haengt allein am Ende und nicht an jedem Schnappschuss: Jeder
   * Schnappschuss waehrend des Abgangs schoebe das Anhalten sonst weiter hinaus.
   */
  useEffect(() => {
    const element = elementRef.current
    if (!ended || !element) return
    const abgang = setTimeout(() => element.pause(), presentationTiming.videoExitMs)
    return () => clearTimeout(abgang)
  }, [ended])

  if (!question) return null

  return (
    <div className={`${styles.scene} ${styles.video}`}>
      <div
        className={styles.videoBox}
        style={{ '--video-exit-duration': `${presentationTiming.videoExitMs}ms` } as CSSProperties}
      >
        {/*
         * Der Platzhalter ist die Flaeche des Videos, nicht seine Beigabe: Buehne
         * und Operatorvorschau zeigen dasselbe Rechteck an derselben Stelle, und
         * das Medium legt sich auf der Buehne hinein. Fehlt es oder laedt es noch,
         * bleibt die Komposition trotzdem stehen.
         */}
        <div className={styles.videoFrame} data-video-placeholder data-video-state={video?.status ?? 'idle'}>
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
          {!question.videoUrl && <p className={styles.videoMissing}>{t('video.missing')}</p>}
        </div>
        {!plays && question.videoUrl && video && !video.hasError && (
          /*
           * WAS DER OPERATOR HIER BRAUCHT, IST DER STAND - NICHT DAS BILD.
           *
           * Er steht NEBEN der Flaeche und nicht darin: Blendet das Video am Ende
           * aus, bleibt "zu Ende" trotzdem lesbar - genau dann, wenn der Operator
           * wieder dran ist.
           */
          <p className={styles.videoStatus} data-video-status={video.status} role="status">
            <span className={styles.videoStatusDot} aria-hidden="true" />
            {t(statusTexte[video.status])}
          </p>
        )}
      </div>
      {video?.hasError && !ended && <p className={styles.videoError}>{t('video.error')}</p>}
    </div>
  )
}
