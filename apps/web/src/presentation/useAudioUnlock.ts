/**
 * Gibt die Tonausgabe dieses Fensters frei und meldet die Freigabe dem Server.
 *
 * ZWEI DINGE, DIE ZUSAMMENGEHOEREN. Browser sperren jede hoerbare Wiedergabe,
 * bis in DEM Fenster einmal geklickt oder getippt wurde. Das betrifft die
 * Soundmarken und den Videoton gleichermassen - und es betrifft ausgerechnet das
 * Buehnenfenster, das im Betrieb nie angefasst wird. Deshalb wird hier nicht nur
 * freigegeben, sondern auch gemeldet: Der Server gibt die Tonhoheit einem
 * Fenster, das wirklich klingen darf (siehe `assignAudioMaster`).
 *
 * In der Desktop-Anwendung ist die Wiedergabe von vornherein erlaubt (siehe
 * `apps/desktop/src/main.ts`). Chromium sagt das auf Nachfrage, und dann steht
 * der Ton sofort bereit, ohne dass jemand geklickt haben muss.
 */
import { useEffect } from 'react'
import { unlockAudio } from './soundCues'

/**
 * Autoplay-Regel des Fensters, soweit der Browser sie preisgibt.
 *
 * `getAutoplayPolicy` kennt heute nur Chromium - genau die Umgebung, in der die
 * Anwendung ausgeliefert wird. Wo es die Auskunft nicht gibt, wird nichts
 * angenommen und auf die Nutzerinteraktion gewartet.
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
