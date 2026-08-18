/**
 * Buehnenscreen (Spezifikation 5.3).
 *
 * Dieser Client bekommt ausschliesslich das oeffentliche View-Modell. Er kann die
 * Loesung nicht vorzeitig anzeigen, weil sie ihm gar nicht uebertragen wird - und er
 * darf keine Steuerbefehle senden. Erlaubt ist nur die Rueckmeldung des Medienstatus,
 * damit der Operator bei einem Videofehler eine verstaendliche Meldung bekommt.
 *
 * Weitere Praesentationsclients spiegeln denselben Zustand. Nur der vom Server
 * bestimmte Audio-Master spielt Ton ab.
 */
import { useEffect } from 'react'
import type { PublicQuizViewModel } from '@quiz/contracts'
import { useQuizConnection } from '../../client/useQuizConnection.ts'
import { StageScreen } from '../../presentation/StageScreen.tsx'
import { toggleOwnFullscreen } from '../../client/desktopBridge.ts'

export function StageApp() {
  const { view, send, connected, audioMaster, serverNow } = useQuizConnection<PublicQuizViewModel>('stage')

  // Vollbild direkt am Buehnenrechner: Taste F oder Doppelklick.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === 'f') void toggleOwnFullscreen()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  if (!view) {
    return (
      <div className="stage stage--offline">
        <p>{connected ? 'Warte auf den Quizserver...' : 'Keine Verbindung zum Quizserver.'}</p>
      </div>
    )
  }

  return (
    <div className="stage-host" onDoubleClick={() => void toggleOwnFullscreen()}>
      {/* Ein Verbindungsverlust darf den Saal nicht mit Technik behelligen: nur ein
          dezenter Punkt, keine Fehlermeldung auf der Buehne. */}
      {!connected && <span className="stage-host__offline" title="Keine Verbindung" aria-hidden="true" />}
      <StageScreen view={view} serverNow={serverNow} isAudioMaster={audioMaster} onReport={send} />
    </div>
  )
}
