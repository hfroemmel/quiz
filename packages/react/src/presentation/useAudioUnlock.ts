/**
 * Releases this window's audio output and reports the unlock to the server.
 *
 * TWO THINGS THAT BELONG TOGETHER. Browsers block every audible playback
 * until a click or tap has happened once in THAT window. This affects the
 * sound cues - and it affects, of all windows,
 * the stage window, which is never touched during operation. That is why
 * this not only unlocks but also reports: the server assigns audio authority
 * to a window that is really allowed to sound (see `assignAudioMaster`).
 *
 * In the desktop application, playback is allowed from the outset (see the
 * Electron wrappers). Chromium confirms that on request, and then the sound
 * is ready immediately, without anyone having had to click.
 */
import { useEffect } from 'react'
import { unlockAudio } from './soundCues'

/**
 * The window's autoplay policy, as far as the browser discloses it.
 *
 * `getAutoplayPolicy` today only knows Chromium - precisely the environment
 * the application is shipped in. Where it does not give an answer, nothing
 * is assumed and the interaction is awaited.
 */
function audioAllowedWithoutGesture(): boolean {
  const query = (navigator as { getAutoplayPolicy?: (type: string) => string }).getAutoplayPolicy
  if (typeof query !== 'function') return false
  try {
    return query.call(navigator, 'mediaelement') === 'allowed'
  } catch {
    return false
  }
}

export function useAudioUnlock(notifyAudioReady: () => void): void {
  useEffect(() => {
    if (audioAllowedWithoutGesture()) {
      unlockAudio()
      notifyAudioReady()
      return
    }
    const unlock = () => {
      unlockAudio()
      notifyAudioReady()
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('keydown', unlock)
    }
    window.addEventListener('pointerdown', unlock)
    window.addEventListener('keydown', unlock)
    return () => {
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('keydown', unlock)
    }
  }, [notifyAudioReady])
}
