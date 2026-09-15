/**
 * The playable quiz as ONE component.
 *
 * It is the only building block a host needs to know - the kiosk just as much
 * as a multi-game application. What it shows is decided exclusively by the
 * server state: start selection, running game, result.
 *
 * The area in the middle is the SAME composition as on the projector
 * (`StageScreen`). This view only adds what is not there: the footer with the
 * two player corners and the selection in front of it.
 *
 * There are no game rules here. Whether a tap counts is decided by the
 * server.
 */
import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import type { Command, PlayerCount, PlayerQuizViewModel, QuizRuntime } from '@hfroemmel/quiz-core'
import { deriveQuizEvents, type QuizGameResult } from '@hfroemmel/quiz-core'
import {
  QuizScene,
  releaseAudio,
  textsFor,
  themeForSkin,
  useAudioUnlock,
  useQuizRuntime,
  useQuizSnapshot,
  useQuizTheme,
  useStageTheme,
} from '@hfroemmel/quiz-react'
import { themeVariables } from '@hfroemmel/quiz-themes'
import { StartMenu, type StartMenuChoice } from './StartMenu'
import { deviceStartMenu } from './startMenuModel'
import { GameSettings } from './GameSettings'
import { PlayerFoot } from './PlayerFoot'
import { clampZoom } from './zoom'
import { assignedPlayer, canAnswer, canBuzz } from './answering'
import { useHostVisible } from './useHostVisible'
import { useIdleWatch } from './useIdleWatch'
import styles from './Game.module.css'

// The result shape comes from the domain's event derivation - it is only
// re-exported here so hosts can import it when embedding.
export type { QuizGameResult }

export interface QuizGameProps {
  /**
   * The runtime to play against.
   *
   * Without one, the quiz connects as a player to the server that delivered
   * it - touch operation on a stage night. Hosts without a server (kiosk,
   * game collection) pass their own `LocalQuizRuntime` here and stay fully
   * offline that way. Whoever provides it also cleans it up.
   */
  runtime?: QuizRuntime<PlayerQuizViewModel>
  /** Audience this device plays in. Without one, the first in the catalog. */
  audience?: string
  /**
   * Player counts this device offers - it NARROWS what the package says.
   *
   * A device only one person stands at passes `[1]`; the question about the
   * number of players then falls away. The second corner's buzzer disappears
   * by itself anyway - the footer follows the server's game state.
   *
   * Without it, the menu offers what the quizzes of this audience state
   * (`quizzes[].playerCounts`).
   */
  playerCounts?: readonly PlayerCount[]
  /**
   * Sound at this device's startup - the default from the host's config
   * file.
   *
   * Without one, whatever was last set on the device applies (the engine
   * remembers it). WITH one, it wins on every start: a game collection meant
   * to run silently should not have to depend on what someone pressed on the
   * device yesterday. The toggle in settings stays operable during use
   * regardless.
   */
  soundEnabled?: boolean
  /**
   * Stage zoom level between 0.6 and 1 - likewise a default from the config
   * file.
   *
   * 1 is the full, designed size and thus the maximum. Smaller values shrink
   * the scene toward the centre; score, counter and logo stay at the screen
   * edge and shrink along with it. For very large touch tables where the full
   * size can no longer be taken in at a glance.
   */
  zoom?: number
  /**
   * Language at this device's startup - default from the config file.
   *
   * Without one, whatever was last chosen on the device applies; with one, it
   * wins on every start. If the content does not know the language, it falls
   * back to the base language - a typo must not be able to disable a device.
   */
  locale?: string
  /** Result of a finished game - for the host's leaderboard. */
  onFinished?: (result: QuizGameResult) => void
  /**
   * Jump back into the host application. If it is set, the corresponding
   * button appears; if it is missing, there is no way back - as in the kiosk.
   */
  onExit?: () => void
  /**
   * Idle watch: if nothing is touched for long enough during a running game,
   * it is aborted and the selection returns.
   *
   * Without this value there is no watch. On an unattended device it is
   * needed because there is deliberately no time pressure on a question:
   * without it, a device would sit with an open question until someone comes
   * along.
   */
  idleTimeoutMs?: number
  /**
   * A host's own layer ON TOP OF the stage - for example an extra
   * information step between the solution and the next question.
   *
   * It is placed INSIDE the stage, not next to it: only there do the stage's
   * colours, container units and zoom level apply. Outside it, it would keep
   * its full size while everything beneath it gets smaller. What it draws is
   * up to the host; the shared button is available to it as `stage-button`.
   */
  overlay?: ReactNode
}

export function QuizGame({
  runtime: hostRuntime,
  audience,
  playerCounts,
  soundEnabled: soundDefault,
  zoom: zoomDefault,
  locale: localeDefault,
  onFinished,
  onExit,
  idleTimeoutMs,
  overlay,
}: QuizGameProps) {
  // Without a host runtime, its own connection; with one, none.
  const own = useQuizRuntime<PlayerQuizViewModel>(hostRuntime ? null : 'player')
  const runtime = hostRuntime ?? own.runtime
  const snapshot = useQuizSnapshot(runtime)
  const view = snapshot?.view ?? null
  const connected = snapshot?.connection.connected ?? false
  const lastRejection = snapshot?.lastRejection ?? null
  const send = useCallback((command: Command) => void runtime?.dispatch(command), [runtime])
  const clearRejection = useCallback(() => runtime?.clearRejection(), [runtime])
  const notifyAudioReady = useCallback(() => runtime?.notifyAudioReady(), [runtime])
  const hostVisible = useHostVisible()
  /** The design of the host, where one surrounds this quiz (`QuizProvider`). */
  const hostTheme = useQuizTheme()
  const t = textsFor(snapshot?.view ?? null)

  useAudioUnlock(notifyAudioReady)
  /*
   * The sound files live outside the component tree, otherwise they would
   * survive removal. In a host application, every visit to the quiz would
   * otherwise leave another leftover behind.
   */
  useEffect(() => () => releaseAudio(), [])

  /**
   * The user chose "Play again" after the result: the selection appears even
   * though the server still holds the finished game. This is the only view
   * decision this client makes on its own - everything else follows the
   * server state.
   */
  const [showChoice, setShowChoice] = useState(false)
  const greetedRef = useRef(false)
  /**
   * "Let's go" has been pressed, but the server has not answered yet.
   *
   * Without this intermediate state, the client would keep showing the old
   * state in the meantime - and of all things that would be the previous
   * game's result briefly flashing up at start.
   *
   * The revision, incidentally, is not suited for this: it counts per game
   * and starts small again with a new one.
   */
  const [pendingStart, setPendingStart] = useState(false)

  /**
   * Device settings.
   *
   * Sound belongs to the engine (it remembers it across restarts), the size
   * to this view - it is pure presentation and has no place in the game
   * state. Both start at the default from the config file.
   */
  const [zoom, setZoom] = useState(() => clampZoom(zoomDefault))
  const [settingsOpen, setSettingsOpen] = useState(false)
  /*
   * SETTINGS ONLY EXIST ON THE DEVICE ITSELF.
   *
   * If the host brings its own runtime, the state belongs to it too:
   * whatever is turned here on sound is only heard by whoever stands in
   * front of it. If the quiz, on the other hand, is attached to a server, the
   * sound belongs to the show - in that case a visitor at the touch table in
   * the foyer must not be able to mute the hall.
   */
  const ownDevice = Boolean(hostRuntime)
  /** The end-game button has asked and is waiting for the answer. */
  const [askExit, setAskExit] = useState(false)

  /*
   * The default from the config file applies on every start - but only once:
   * after that, the toggle belongs to whoever stands in front of the device,
   * until the next start.
   */
  const soundSetRef = useRef(false)
  useEffect(() => {
    if (soundDefault === undefined || soundSetRef.current) return
    const state = snapshot?.view
    if (!state) return
    soundSetRef.current = true
    if (state.soundEnabled !== soundDefault) send({ type: 'SET_SOUND_ENABLED', enabled: soundDefault })
  }, [soundDefault, snapshot, send])

  // A changed host default takes effect on the display.
  useEffect(() => {
    setZoom(clampZoom(zoomDefault))
  }, [zoomDefault])

  // Same rule for the language: once per start, then it belongs to the device.
  const localeSetRef = useRef(false)
  useEffect(() => {
    if (localeDefault === undefined || localeSetRef.current) return
    const state = snapshot?.view
    if (!state) return
    localeSetRef.current = true
    if (state.locale !== localeDefault) send({ type: 'SET_LOCALE', locale: localeDefault })
  }, [localeDefault, snapshot, send])

  /*
   * When the component mounts, the server may still hold the result of an
   * earlier match - for example after a device restart. It belongs to
   * players long gone; whoever stands in front of it now should see the
   * selection. A result that arises DURING this session, by contrast, stays
   * visible.
   */
  useEffect(() => {
    if (!view || greetedRef.current) return
    greetedRef.current = true
    // Nothing needs to be suppressed from reporting here: the event derivation
    // below only ever reports results that arise DURING this session anyway.
    if (view.scene === 'result') setShowChoice(true)
  }, [view])

  /*
   * The requested game is considered started as soon as a scene appears that
   * only exists during a running game. If the server rejects the start -
   * say, because no matching question slot is left - the selection returns,
   * so nobody is left standing in front of a waiting screen.
   */
  useEffect(() => {
    if (!pendingStart) return
    if (view && view.scene !== 'start' && view.scene !== 'result') setPendingStart(false)
  }, [pendingStart, view])

  useEffect(() => {
    if (!pendingStart || !lastRejection) return
    setPendingStart(false)
    setShowChoice(true)
    clearRejection()
  }, [pendingStart, lastRejection, clearRejection])

  /*
   * Event derivation across the WHOLE session - deliberately here and not in
   * the embedded stage: the stage is suspended at the start screen, and a
   * result arriving exactly then would be lost to it. Reporting happens
   * exactly once per finished game, because the result event is tied to
   * scene entry, not to the revision.
   */
  const previousViewRef = useRef<PlayerQuizViewModel | null>(null)
  useEffect(() => {
    if (!view) return
    const events = deriveQuizEvents(previousViewRef.current, view)
    previousViewRef.current = view
    for (const event of events) {
      if (event.type === 'game-finished') onFinished?.(event.result)
    }
  }, [view, onFinished])

  /*
   * THE CONFIGURATION DECIDES, THE PROPERTY NARROWS.
   *
   * Idle time and player counts belong to the installation, and they live in
   * the quiz package (`rules.idleTimeoutMs`, `quizzes[].playerCounts`). A host
   * that still passes them as properties wins, so nothing changes for it from
   * one version to the next; a host that passes nothing gets what the package
   * says.
   */
  const effectiveIdleTimeoutMs = idleTimeoutMs ?? view?.catalog.rules.idleTimeoutMs
  const idle = useIdleWatch({
    ...(effectiveIdleTimeoutMs === undefined ? {} : { timeoutMs: effectiveIdleTimeoutMs }),
    active: Boolean(view && view.scene !== 'start'),
    onIdle: () => {
      send({ type: 'ABORT_GAME' })
      setShowChoice(false)
    },
  })

  if (!view || !runtime) {
    return (
      <div className={`${styles.game} ${styles.waiting}`} data-quiz-game="">
        <p>{t(connected ? 'kiosk.preparing' : 'kiosk.disconnected')}</p>
      </div>
    )
  }

  const audienceId = audience ?? view.catalog.audiences[0]?.id ?? ''
  // Without a running or finished game, the server shows the start scene.
  const hasGame = view.scene !== 'start'
  const finished = view.scene === 'result'

  /*
   * THE MENU HANDS IN WHAT IT ASKED, AND NOTHING ELSE.
   *
   * A quiz type brings audience and pools with it, so only its id travels -
   * both together are a contradiction and the engine refuses it. A package
   * without quiz types names audience and level instead, exactly as before. The
   * level is only sent where the offer has one; where a quiz offers no choice,
   * sending it would be refused.
   */
  const start = ({ quizId, audienceId: chosenAudience, playerCount, presetId }: StartMenuChoice) => {
    setShowChoice(false)
    setPendingStart(true)
    clearRejection()
    // A second tap while starting does not create a second game: the server
    // rejects it, because a game is already running by then.
    send({
      type: 'START_GAME',
      ...(quizId === undefined ? { audience: chosenAudience ?? audienceId } : { quizId }),
      ...(presetId === undefined ? {} : { presetId }),
      playerCount,
      flowProfile: 'self-service',
    })
  }

  const leave = () => {
    send({ type: 'ABORT_GAME' })
    setShowChoice(false)
    setPendingStart(false)
    onExit?.()
  }

  /**
   * Abort the running game and return to the start menu.
   *
   * Not the same as `leave`: there you leave the quiz and return to the host
   * application; here you stay in the quiz and start over.
   */
  const abort = () => {
    setAskExit(false)
    send({ type: 'ABORT_GAME' })
    setShowChoice(true)
    setPendingStart(false)
  }

  /*
   * The zoom level exists as a variable ABOVE the stage: scene, header and
   * footer read it there and each shrink on their own - the scene toward the
   * centre, the corners toward their screen edge. It is set on EVERY view of
   * this component, so it does not briefly disappear when switching between
   * selection and game.
   */
  const area = { '--stage-zoom': zoom } as CSSProperties

  /*
   * VISUAL WORLD OUTSIDE THE STAGE TOO.
   *
   * `.stage--kids` sits on the stage, and that only comes into being with the
   * game - start selection, settings and confirmation dialogs sit ABOVE it
   * and would therefore never learn which world they are in. That is why
   * this component's root element carries the world as a data attribute;
   * this module's rules read it there (`[data-skin='kids'] .start`).
   *
   * An attribute and not a `.stage--*` class: otherwise every component
   * outside the stage would inherit the world's stage rules - answer cards,
   * buzzer, header - and those are designed for the area inside it.
   *
   * WHERE IT COMES FROM DEPENDS ON WHETHER A GAME IS RUNNING: `view.theme`
   * belongs to the running game and reports the base world before that.
   * Before the start, therefore, the world of the audience this device
   * belongs to applies - otherwise the adults' selection would stand in
   * front of the kids' quiz and only switch with the first question.
   */
  const skin =
    (hasGame && !showChoice ? view.theme.skin : view.catalog.audiences.find((entry) => entry.id === audienceId)?.skin) ??
    'default'

  /*
   * LIGHT OR DARK VARIANT - OUTSIDE THE STAGE TOO.
   *
   * `.stage--bright` sits on the stage, and that only comes into being with
   * the game. Start selection, settings and confirmation dialogs sit above it
   * and therefore always carried the dark variant, even when the game
   * afterwards ran on paper. The variant now exists as an attribute on the
   * root element; the `--start-*` colours of the light variant depend on it
   * (see `palette.css`).
   *
   * The kids' world does not know this switch - it brings its own paper and
   * reports here as its own world.
   */
  const [stageTheme] = useStageTheme()
  /*
   * The device's own surfaces - start selection, settings, confirmation - carry
   * the theme of the world they stand in front of: the host's where it is meant
   * for that world, the package's otherwise (see `themeForSkin`).
   */
  const worldTheme = themeForSkin(hostTheme, skin)
  /*
   * ON THIS ELEMENT, not inherited: the light variant of the start menu
   * declares its tokens on the device's root element
   * (`[data-quiz-game][data-theme='bright']`), and that beats an inherited
   * value. A host theme meant for this world therefore lands here as an inline
   * style - with all its families, because it is a complete set.
   */
  const ownTheme = hostTheme && hostTheme.skin === skin ? hostTheme : null
  const worldVariables = ownTheme ? ownTheme.variables : themeVariables(worldTheme)
  /*
   * And the variant follows the host theme where there is one: whoever designs
   * a dark device has designed it dark, and the light-or-dark preference of a
   * window applies where no host says otherwise.
   */
  const variant = skin === 'kids' ? 'kids' : (ownTheme?.base ?? stageTheme)

  const settings = settingsOpen && ownDevice && (
    <GameSettings
      view={view}
      soundEnabled={view.soundEnabled}
      onSoundEnabled={(enabled) => send({ type: 'SET_SOUND_ENABLED', enabled })}
      zoom={zoom}
      onZoom={setZoom}
      onClose={() => setSettingsOpen(false)}
    />
  )

  if (!pendingStart && (showChoice || !hasGame)) {
    return (
      <div
        className={`${styles.game} ${styles.startScreen}`}
        style={{ ...worldVariables, ...area }}
        data-quiz-game=""
        data-skin={skin}
        data-theme={variant}
      >
        <StartMenu
          model={deviceStartMenu(view, audienceId, playerCounts)}
          texts={view.texts}
          brand={{ visualUrl: view.theme.startVisualUrl, title: view.theme.startTitle }}
          canStart={view.allowedCommands.includes('START_GAME')}
          onStart={start}
          onExit={onExit}
          onSelectLocale={(locale) => send({ type: 'SET_LOCALE', locale })}
          {...(ownDevice ? { onOpenSettings: () => setSettingsOpen(true) } : {})}
        />
        {settings}
      </div>
    )
  }

  if (pendingStart) {
    return (
      <div
        className={`${styles.game} ${styles.waiting}`}
        style={{ ...worldVariables, ...area }}
        data-quiz-game=""
        data-skin={skin}
        data-theme={variant}
      >
        <p>{t('kiosk.preparing')}</p>
      </div>
    )
  }

  const players = view.playerScores
  /*
   * Whoever the open attempt belongs to is on turn - the server says so.
   * This client only cares about that to decide which area looks dimmed.
   */
  const turn = assignedPlayer(view)
  const solo = players.length === 1
  /*
   * The rows are buttons throughout the whole game, even before anyone has
   * buzzed - just locked ones then. If the buttons only appeared with the
   * successful buzz, the list would rebuild itself in the middle of the
   * question, and a finger already on its way would hit nothing.
   */
  const answering = finished
    ? undefined
    : {
        disabled: !turn || !canAnswer(view, turn),
        label: turn ? `Antworten ${players.find((entry) => entry.playerId === turn)?.label ?? ''}`.trim() : 'Antworten',
        onSelect: (optionId: string) => {
          // Without a successful buzz the row is locked; the server would reject it anyway.
          if (!turn || !canAnswer(view, turn)) return
          /*
           * In single-player mode there is no buzzer button: the first tap
           * grabs the buzz and logs the answer in one move. Logging is exempt
           * from the revision check, so it may run ahead of its own buzz.
           */
          if (solo && !view.allowedCommands.includes('LOG_OPTION_ANSWER')) {
            send({ type: 'BUZZ', playerId: turn })
          }
          send({ type: 'LOG_OPTION_ANSWER', optionId })
        },
      }



  return (
    <div className={styles.game} style={area} data-quiz-game=""
      data-skin={skin}
      data-theme={variant}
      onPointerDown={idle.notice}>
      {!connected && <span className={styles.offline} title="Keine Verbindung" aria-hidden="true" />}

      {/*
        * Exiting a running game.
        *
        * WITH A CONFIRMATION DIALOG, and not out of caution about data loss:
        * the button sits at the edge of an area that is being tapped the
        * whole time, and an accidental hit would otherwise end the game for
        * both players standing in front of it in the middle of a question.
        *
        * Whether it exists is decided by the server state: in a game run by
        * an operator, nobody may abort it from the device.
        */}
      {!finished && view.allowedCommands.includes('ABORT_GAME') && (
        <button type="button" className={styles.abort} data-abort-game="" onClick={() => setAskExit(true)}>
          {t('kiosk.endGame')}
        </button>
      )}

      {askExit && (
        <div className={styles.overlay} data-abort-dialog="">
          <div className={styles.panel} role="dialog" aria-label={t('kiosk.endGame')}>
            <h2 className={styles.panelTitle}>{t('kiosk.endGameQuestion')}</h2>
            <div className={styles.actions}>
              <button
                type="button"
                className={styles.action}
                data-abort-confirm=""
                onClick={abort}
              >
                {t('kiosk.end')}
              </button>
              <button
                type="button"
                className={styles.actionSecondary}
                data-abort-cancel=""
                onClick={() => setAskExit(false)}
              >
                {t('kiosk.keepPlaying')}
              </button>
            </div>
          </div>
        </div>
      )}

      <QuizScene
        runtime={runtime}
        /*
         * It stays silent in the background: a hidden quiz must not sound
         * into the application the host is currently showing.
         */
        audible={hostVisible}
        variant="touch"
        {...(answering ? { answering } : {})}
        pads={{
          ...(overlay ? { overlay } : {}),
          bottom: finished ? (
            <div className={styles.footer}>
              <button
                type="button"
                className={styles.action}
                onClick={() => setShowChoice(true)}
              >
                {t('kiosk.playAgain')}
              </button>
              {onExit && (
                <button type="button" className={styles.actionSecondary} onClick={leave}>
                  {t('kiosk.end')}
                </button>
              )}
            </div>
          ) : (
            <PlayerFoot
              view={view}
              turn={turn}
              canBuzz={(playerId) => canBuzz(view, playerId)}
              onBuzz={(playerId) => send({ type: 'BUZZ', playerId })}
              onResolve={() => send({ type: 'RESOLVE_ATTEMPT' })}
              onContinue={() => send({ type: 'CONTINUE' })}
            />
          ),
        }}
      />
    </div>
  )
}
