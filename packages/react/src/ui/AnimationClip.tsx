/**
 * Playback building block for the delivered motion graphics.
 *
 * It knows exactly one job: display a file from `animationClips`. It reads
 * no game state, sends no commands and decides nothing about phases - the
 * domain transition never depends on whether this video has finished playing
 * (specification 22.1).
 *
 * REDUCED MOTION: instead of leaving out the statement, the video is set to
 * its final frame and paused. The viewer then sees the same result - just
 * without motion.
 *
 * SIZE: the clip always fills its parent element. The scene thus determines
 * the size, not the component - that way a single file stays a different
 * size in different places without needing two variants.
 *
 * SOUND: the files have no audio track. Sound comes exclusively through the
 * sound cues, which only the audio master plays.
 */
import { useEffect, useRef } from 'react'
import { animationClips, type AnimationClipId } from '../presentation/animationAssets'
import { prefersReducedMotion } from '../presentation/animationPresets'
import styles from './AnimationClip.module.css'

interface AnimationClipProps {
  clipId: AnimationClipId
  className?: string
  /** Restarts playback as soon as the value changes. */
  restartKey?: string | number
}

export function AnimationClip({ clipId, className, restartKey }: AnimationClipProps) {
  const clip = animationClips[clipId]
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    if (prefersReducedMotion()) {
      // Jump to the final frame: statement visible, no motion.
      video.pause()
      video.currentTime = clip.durationMs / 1000
      return
    }
    video.currentTime = 0
    // A rejected autoplay must not block anything - then the first frame shows.
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
