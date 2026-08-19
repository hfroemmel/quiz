/**
 * Operatoransicht (Spezifikation 5.1 und 6.2).
 *
 * Informationshierarchie:
 *   1. Kopfbereich: Beenden, beide Punktestaende mit Plus/Minus, Fortschritt, Vollbild, Sound
 *   2. grosse Vorschau des oeffentlichen Buehnenscreens
 *   3. privater Informationsbereich mit richtiger Antwort und Zusatzinformationen
 *   4. kontextabhaengige Steuerung
 *
 * Diese Komponente implementiert keine Spielregeln. Sie rendert das View-Modell und
 * sendet Befehle; ueber Zulaessigkeit und Wirkung entscheidet der Server.
 */
import { useEffect, useState } from 'react'
import { useQuizConnection } from '../../client/useQuizConnection.ts'
import { useBuzzerKeys } from '../../client/useBuzzerKeys.ts'
import { StageScreen, themeVariables } from '../../presentation/StageScreen.tsx'
import { ConnectionBanner } from '../../components/ConnectionBanner.tsx'
import { unlockAudio } from '../../presentation/soundCues.ts'
import { requestStageFullscreen } from '../../client/desktopBridge.ts'
import { FullscreenIcon, IconButton, SoundOffIcon, SoundOnIcon } from '../../ui/IconButton.tsx'
import { scoringRules, type OperatorQuizViewModel } from '@quiz/contracts'
import { OperatorControls } from './OperatorControls.tsx'
import { PrivatePanel } from './PrivatePanel.tsx'
import { StartPanel } from './StartPanel.tsx'
import { HotfixPanel } from './HotfixPanel.tsx'
import { DiagnosticsPanel } from './DiagnosticsPanel.tsx'

export function OperatorApp() {
  const connection = useQuizConnection<OperatorQuizViewModel>('operator')
  const { view, send, connected, lastRejection, clearRejection, serverNow } = connection

  // Der Hardware-Buzzer ist nur sinnvoll, solange ein Spiel laeuft. Die Entprellung
  // steckt im Hook; ueber Gueltigkeit entscheidet weiterhin der Server.
  useBuzzerKeys(send, Boolean(view) && view!.phase !== 'idle')

  // Sobald ein neues Spiel laeuft, ist die Startansicht wieder Vergangenheit.
  const [wantsStartPanel, setWantsStartPanel] = useState(false)
  useEffect(() => {
    if (view?.phase && view.phase !== 'result') setWantsStartPanel(false)
  }, [view?.phase])

  // Browser erlauben Tonausgabe erst nach einer Nutzerinteraktion.
  useEffect(() => {
    const unlock = () => unlockAudio()
    window.addEventListener('pointerdown', unlock, { once: true })
    return () => window.removeEventListener('pointerdown', unlock)
  }, [])

  if (!view) {
    return (
      <div className="operator operator--loading">
        <ConnectionBanner connected={connected} rejection={lastRejection} />
        <p>Verbindung zum lokalen Quizserver wird aufgebaut...</p>
      </div>
    )
  }

  // Nach der letzten Frage bleibt das Ergebnis stehen, bis der Operator bewusst zur
  // Startansicht zurueckkehrt - dort wird dann das naechste Spiel mit zwei neuen
  // Spielern gestartet (Spezifikation 7.1).
  const canStartNewGame = view.allowedCommands.includes('START_GAME')
  const isResult = view.phase === 'result'
  const showStartPanel = canStartNewGame && (!isResult || wantsStartPanel)

  /**
   * Punktekorrektur des Operators.
   *
   * Sie liegt im Entwurf neben den Punktekacheln und wird deshalb als Slot in die
   * Kopfzeile der Buehnenflaeche gegeben. Sie gehoert NICHT zum oeffentlichen
   * Renderpfad: Das Buehnenfenster uebergibt keine Slots und zeigt sie nie.
   */
  const adjust = (playerId: 'player-1' | 'player-2') => (
    <div className="score-adjust">
      <button
        className="button button--tiny"
        disabled={!view.allowedCommands.includes('ADJUST_SCORE')}
        onClick={() => send({ type: 'ADJUST_SCORE', playerId, direction: 'increase' })}
        aria-label={`${playerId === 'player-1' ? 'Spieler 1' : 'Spieler 2'} plus ${scoringRules.manualAdjustmentStep}`}
      >
        +
      </button>
      <button
        className="button button--tiny"
        disabled={!view.allowedCommands.includes('ADJUST_SCORE')}
        onClick={() => send({ type: 'ADJUST_SCORE', playerId, direction: 'decrease' })}
        aria-label={`${playerId === 'player-1' ? 'Spieler 1' : 'Spieler 2'} minus ${scoringRules.manualAdjustmentStep}`}
      >
        −
      </button>
    </div>
  )
  const scoreControls = { beforePlayerOne: adjust('player-1'), afterPlayerTwo: adjust('player-2') }

  return (
    <div className="operator" style={themeVariables(view)}>
      <header className="operator__header">
        <div className="operator__header-left">
          {view.allowedCommands.includes('ABORT_GAME') && (
            <button
              className="button button--technical"
              onClick={() => {
                if (confirm('Laufendes Spiel wirklich beenden? Es wird kein Ergebnis angezeigt.')) {
                  send({ type: 'ABORT_GAME' })
                }
              }}
            >
              Beenden
            </button>
          )}
        </div>

        <div className="operator__header-right">
          {isResult && !wantsStartPanel && (
            <button className="button button--primary button--tiny" onClick={() => setWantsStartPanel(true)}>
              Zurueck zur Startansicht
            </button>
          )}
          <IconButton label="Buehne im Vollbild zeigen" onClick={() => void requestStageFullscreen()}>
            <FullscreenIcon />
          </IconButton>
          <IconButton
            label={view.soundEnabled ? 'Ton ausschalten' : 'Ton einschalten'}
            pressed={view.soundEnabled}
            disabled={!view.allowedCommands.includes('SET_SOUND_ENABLED')}
            onClick={() => send({ type: 'SET_SOUND_ENABLED', enabled: !view.soundEnabled })}
          >
            {view.soundEnabled ? <SoundOnIcon /> : <SoundOffIcon />}
          </IconButton>
        </div>
      </header>

      <ConnectionBanner connected={connected} rejection={lastRejection} onDismiss={clearRejection} />

      {!showStartPanel ? (
        <main className="operator__main">
          <section className="operator__preview" aria-label="Vorschau Buehnenscreen">
            <div className="operator__preview-frame">
              <StageScreen
                view={view}
                serverNow={serverNow}
                isAudioMaster={false}
                variant="preview"
                headerSlots={scoreControls}
              />
            </div>
          </section>

          <aside className="operator__side">
            <PrivatePanel view={view} />
            <HotfixPanel view={view} send={send} questionId={view.questionId} />
          </aside>

          <OperatorControls view={view} send={send} />
        </main>
      ) : (
        <main className="operator__main operator__main--start">
          <StartPanel view={view} send={send} />
          <section className="operator__preview" aria-label="Vorschau Buehnenscreen">
            <div className="operator__preview-frame">
              <StageScreen
                view={view}
                serverNow={serverNow}
                isAudioMaster={false}
                variant="preview"
                headerSlots={scoreControls}
              />
            </div>
          </section>
        </main>
      )}

      <DiagnosticsPanel view={view} send={send} connectedClients={view.diagnostics.connectedClients.length} />
    </div>
  )
}
