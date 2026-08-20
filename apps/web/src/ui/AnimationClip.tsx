/**
 * Abspielbaustein fuer die gelieferten Bewegtgrafiken.
 *
 * Er kennt genau eine Aufgabe: eine Datei aus `animationClips` darstellen.
 * Er liest keinen Spielzustand, sendet keine Befehle und entscheidet nichts
 * ueber Phasen - der fachliche Wechsel haengt niemals daran, ob dieses Video
 * fertig gespielt hat (Spezifikation 22.1).
 *
 * REDUZIERTE BEWEGUNG: Statt die Aussage wegzulassen, wird das Video auf sein
 * Endbild gesetzt und angehalten. Der Zuschauer sieht dann dasselbe Ergebnis -
 * nur ohne Bewegung.
 *
 * GROESSE: Der Clip fuellt immer sein Elternelement. Die Groesse bestimmt also
 * die Szene, nicht das Bauteil - so bleibt eine Datei an verschiedenen Stellen
 * unterschiedlich gross, ohne dass es zwei Varianten braucht.
 *
 * TON: Die Dateien haben keine Tonspur. Klang kommt ausschliesslich ueber die
 * Soundmarken, die nur der Audio-Master abspielt.
 */
import { useEffect, useRef } from 'react'
import { animationClips, type AnimationClipId } from '../presentation/animationAssets.ts'
import { prefersReducedMotion } from '../presentation/animationPresets.ts'
import styles from './AnimationClip.module.css'

interface AnimationClipProps {
  clipId: AnimationClipId
  className?: string
  /** Startet die Wiedergabe neu, sobald sich der Wert aendert. */
  restartKey?: string | number
}

export function AnimationClip({ clipId, className, restartKey }: AnimationClipProps) {
  const clip = animationClips[clipId]
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    if (prefersReducedMotion()) {
      // Auf das Endbild springen: Aussage sichtbar, keine Bewegung.
      video.pause()
      video.currentTime = clip.durationMs / 1000
      return
    }
    video.currentTime = 0
    // Ein abgelehntes Autoplay darf nichts blockieren - dann steht das erste Bild.
    void video.play().catch(() => undefined)
  }, [clip, restartKey])

  return (
    <video
      ref={videoRef}
      className={className ? `${styles.clip} ${className}` : styles.clip}
      src={clip.url}
      width={clip.sourceSizePx}
      height={clip.sourceSizePx}
      autoPlay
      muted
      playsInline
      preload="auto"
      aria-hidden="true"
      data-clip={clip.id}
    />
  )
}
