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
import { useQuizConnection } from '../../client/useQuizConnection'
import { useBuzzerKeys } from '../../client/useBuzzerKeys'
import { StageScreen } from '../../presentation/StageScreen'
import { themeForView, themeVariables } from '../../theme/sceneTheme'
import { useStageTheme } from '../../presentation/stageTheme'
import { ConnectionBanner } from '../../components/ConnectionBanner'
import { useAudioUnlock } from '../../presentation/useAudioUnlock'
import { requestStageFullscreen } from '../../client/desktopBridge'
import { ConfirmDialog } from '../../ui/ConfirmDialog'
import { GameLogDialog } from './GameLogDialog'
import {
  BrightThemeIcon,
  DarkThemeIcon,
  FullscreenIcon,
  IconButton,
  SoundOffIcon,
  SoundOnIcon,
} from '../../ui/IconButton'
import { scoringRules, type OperatorQuizViewModel } from '@quiz/contracts'
import { OperatorControls } from './OperatorControls'
import { PrivatePanel } from './PrivatePanel'
import { StartPanel } from './StartPanel'
import { HotfixPanel } from './HotfixPanel'
import { DiagnosticsPanel } from './DiagnosticsPanel'
import styles from './OperatorApp.module.css'

export function OperatorApp() {
  const connection = useQuizConnection<OperatorQuizViewModel>('operator')
  const { view, send, connected, lastRejection, clearRejection, serverNow, audioMaster, notifyAudioReady } =
    connection

  // Der Hardware-Buzzer ist nur sinnvoll, solange ein Spiel laeuft. Die Entprellung
  // steckt im Hook; ueber Gueltigkeit entscheidet weiterhin der Server.
  useBuzzerKeys(send, Boolean(view) && view!.phase !== 'idle')

  // Sobald ein neues Spiel laeuft, ist die Startansicht wieder Vergangenheit.
  const [wantsStartPanel, setWantsStartPanel] = useState(false)
  const [confirmAbort, setConfirmAbort] = useState(false)
  const [showGameLog, setShowGameLog] = useState(false)
  // Ansichtssache des Bedienenden, kein Spielzustand - deshalb lokal, nicht im Snapshot.
  const [stageTheme, setStageTheme] = useStageTheme()
  useEffect(() => {
    if (view?.phase && view.phase !== 'result') setWantsStartPanel(false)
  }, [view?.phase])

  // Browser erlauben Tonausgabe erst nach einer Nutzerinteraktion in diesem Fenster.
  // Ohne geoeffnete Buehne - oder solange dort niemand geklickt hat - klingt es hier.
  useAudioUnlock(notifyAudioReady)

  if (!view) {
    return (
      <div className={`${styles.operator} ${styles.loading}`}>
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
    <div className={styles.scoreAdjust}>
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
    <div className={styles.operator} data-operator="" style={themeVariables(themeForView(view))}>
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          {view.allowedCommands.includes('ABORT_GAME') && (
            <button className="button button--technical" onClick={() => setConfirmAbort(true)}>
              Beenden
            </button>
          )}
        </div>

        <div className={styles.headerRight}>
          {/*
            * Der Session-Code steht dort, wo der Operator ihn im Zweifel sucht:
            * neben den Fensterschaltern. Der Moderator braucht ihn zum Anmelden.
            */}
          {view.diagnostics.sessionCode && (
            <div className={styles.sessionCode}>
              <span className={styles.sessionLabel}>Session-Code</span>
              <span className={styles.sessionValue}>{view.diagnostics.sessionCode}</span>
            </div>
          )}
          {/*
            * Helle oder dunkle Buehne. Nur der Erwachsenenmodus kennt beide
            * Fassungen - die Kinderwelt bringt ihr eigenes Papier mit, dort
            * gaebe es nichts umzuschalten.
            */}
          {view.theme.skin !== 'kids' && (
            <IconButton
              label={stageTheme === 'bright' ? 'Bühne dunkel zeigen' : 'Bühne hell zeigen'}
              onClick={() => setStageTheme(stageTheme === 'bright' ? 'dark' : 'bright')}
            >
              {stageTheme === 'bright' ? <DarkThemeIcon /> : <BrightThemeIcon />}
            </IconButton>
          )}
          <IconButton label="Bühne im Vollbild zeigen" onClick={() => void requestStageFullscreen()}>
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
        <main className={styles.main}>
          <section className={styles.preview} aria-label="Vorschau Bühnenscreen">
            <div className={styles.previewFrame}>
              <StageScreen
                view={view}
                serverNow={serverNow}
                isAudioMaster={audioMaster}
                variant="preview"
                headerSlots={scoreControls}
              />
            </div>
          </section>

          <aside className={styles.side}>
            <PrivatePanel view={view} />
            <HotfixPanel view={view} send={send} questionId={view.questionId} />
          </aside>

          <OperatorControls
            view={view}
            send={send}
            className={styles.controlsArea}
            onBackToStart={isResult && !wantsStartPanel ? () => setWantsStartPanel(true) : undefined}
          />
        </main>
      ) : (
        <main className={`${styles.main} ${styles.mainStart}`}>
          <StartPanel view={view} send={send} />
          <section className={styles.preview} aria-label="Vorschau Bühnenscreen">
            <div className={styles.previewFrame}>
              <StageScreen
                view={view}
                serverNow={serverNow}
                isAudioMaster={audioMaster}
                variant="preview"
                headerSlots={scoreControls}
              />
            </div>
          </section>
        </main>
      )}

      <footer className={styles.footer}>
        <DiagnosticsPanel
          view={view}
          send={send}
          connectedClients={view.diagnostics.connectedClients.length}
          audioMaster={audioMaster}
        />
        {/* Gleiche ruhige Tonlage wie die Diagnosezeile links - kein Knopf im Knopfgewand. */}
        <button className={styles.logOpen} onClick={() => setShowGameLog(true)}>
          <svg className={styles.logIcon} viewBox="0 0 16 16" aria-hidden="true">
            <path
              d="M5.5 2.5h6A1.5 1.5 0 0 1 13 4v9a1.5 1.5 0 0 1-1.5 1.5h-7A1.5 1.5 0 0 1 3 13V5.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.3"
              strokeLinecap="round"
            />
            <path d="M5.5 1.5v2h-2z" fill="currentColor" />
            <path d="M5.5 7h5M5.5 9.5h5M5.5 12h3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          </svg>
          Spielprotokoll
        </button>
      </footer>

      {showGameLog && (
        <GameLogDialog
          statistics={view.statistics}
          canReset={view.allowedCommands.includes('RESET_GAME_STATISTICS')}
          send={send}
          onClose={() => setShowGameLog(false)}
        />
      )}

      {confirmAbort && (
        <ConfirmDialog
          title="Spiel beenden"
          message="Das laufende Spiel wird abgebrochen. Es wird kein Ergebnis angezeigt, und die bisherigen Punkte bleiben im Protokoll stehen."
          confirmLabel="Spiel beenden"
          onConfirm={() => {
            send({ type: 'ABORT_GAME' })
            setConfirmAbort(false)
          }}
          onCancel={() => setConfirmAbort(false)}
        />
      )}
    </div>
  )
}
