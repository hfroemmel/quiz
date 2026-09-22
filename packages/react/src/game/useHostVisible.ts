/**
 * Is the page the quiz is running in currently visible?
 *
 * WHAT FOR: if the host switches to another window or another tab, the quiz
 * should not keep sounding into the room.
 *
 * A LIMIT that has to be named honestly: the browser only reports switching
 * windows or tabs. If a host application merely hides the quiz - say with
 * `display: none` - the page stays visible to the browser. The reliable
 * means therefore is and remains removing the component; that clears
 * everything away.
 */
import { useEffect, useState } from 'react'

export function useHostVisible(): boolean {
  const [visible, setVisible] = useState(() => typeof document === 'undefined' || !document.hidden)

  useEffect(() => {
    const update = () => setVisible(!document.hidden)
    document.addEventListener('visibilitychange', update)
    return () => document.removeEventListener('visibilitychange', update)
  }, [])

  return visible
}
