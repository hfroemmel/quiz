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
 */
import { useEffect, useRef } from 'react'
import type { Command } from '@quiz/contracts'
import type { SceneProps } from './sceneProps.ts'

interface VideoSceneProps extends SceneProps {
  /** Nur der Audio-Master spielt den Ton ab. */
  isAudioMaster?: boolean
  onReport?: (command: Command) => void
}

export function VideoScene({ view, isAudioMaster = true, onReport }: VideoSceneProps) {
  const elementRef = useRef<HTMLVideoElement | null>(null)
  const question = view.question
  const video = view.video

  useEffect(() => {
    const element = elementRef.current
    if (!element || !video) return

    // Position nur nachziehen, wenn sie deutlich abweicht - sonst ruckelt die Wiedergabe.
    const target = video.positionMs / 1000
    if (Math.abs(element.currentTime - target) > 0.6) element.currentTime = target

    if (video.status === 'playing' && element.paused) {
      void element.play().catch((error: Error) => {
        onReport?.({ type: 'REPORT_VIDEO_STATUS', error: error.message })
      })
    }
    if (video.status !== 'playing' && !element.paused) element.pause()
  }, [video, onReport])

  if (!question) return null

  return (
    <div className="scene scene--video">
      {question.videoUrl ? (
        <video
          ref={elementRef}
          className="video__player"
          src={question.videoUrl}
          muted={!isAudioMaster}
          playsInline
          onLoadedMetadata={(event) =>
            onReport?.({ type: 'REPORT_VIDEO_STATUS', durationMs: event.currentTarget.duration * 1000 })
          }
          onError={() => onReport?.({ type: 'REPORT_VIDEO_STATUS', error: 'Datei konnte nicht geladen werden' })}
        />
      ) : (
        <div className="video__missing">
          <p>Kein Video hinterlegt.</p>
        </div>
      )}
      {video?.hasError && <p className="video__error">Video nicht verfuegbar.</p>}
    </div>
  )
}
