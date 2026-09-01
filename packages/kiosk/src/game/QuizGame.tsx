/**
 * Das spielbare Quiz als EINE Komponente.
 *
 * Sie ist der einzige Baustein, den ein Gastgeber kennt - der Kiosk genauso wie
 * eine Multigame-Anwendung. Was sie zeigt, entscheidet ausschliesslich der
 * Serverstand: Startauswahl, laufendes Spiel, Ergebnis.
 *
 * Die Flaeche in der Mitte ist DIESELBE Komposition wie auf dem Beamer
 * (`StageScreen`). Diese Ansicht ergaenzt nur, was es dort nicht gibt: die
 * Fussleiste mit den beiden Spielerecken und die Auswahl davor.
 *
 * Spielregeln stehen hier keine. Ob ein Fingertipp zaehlt, entscheidet der Server.
 */
import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import type { Command, PlayerCount, PlayerQuizViewModel, QuizRuntime } from '@hfroemmel/quiz-core'
import { deriveQuizEvents, type QuizGameResult } from '@hfroemmel/quiz-core'
import { QuizScene, releaseAudio, useAudioUnlock, useQuizRuntime, useQuizSnapshot } from '@hfroemmel/quiz-react'
import { themeForView, themeVariables } from '@hfroemmel/quiz-themes'
import { GameStart } from './GameStart'
import { GameSettings } from './GameSettings'
import { PlayerFoot } from './PlayerFoot'
import { klemmeZoom } from './zoom'
import { assignedPlayer, canAnswer, canBuzz } from './answering'
import { useHostVisible } from './useHostVisible'
import { useIdleWatch } from './useIdleWatch'
import styles from './Game.module.css'

// Die Ergebnisform kommt aus der Ereignisableitung der Domain - hier nur
// weitergereicht, damit Gastgeber sie beim Einbetten importieren koennen.
export type { QuizGameResult }

export interface QuizGameProps {
  /**
   * Die Laufzeit, gegen die gespielt wird.
   *
   * Ohne Angabe verbindet sich das Quiz als Spieler mit dem Server, der es
   * ausgeliefert hat - der Touchbetrieb am Buehnenabend. Gastgeber ohne Server
   * (Kiosk, Spielesammlung) geben hier ihre eigene `LocalQuizRuntime` und
   * bleiben damit vollstaendig offline. Wer sie stellt, raeumt sie auch auf.
   */
  runtime?: QuizRuntime<PlayerQuizViewModel>
  /** Zielgruppe, in der dieses Geraet spielt. Ohne Angabe die erste des Katalogs. */
  audience?: string
  /**
   * Spielerzahlen, die dieses Geraet anbietet. Ohne Angabe beide.
   *
   * Ein Geraet, an dem nur eine Person steht, gibt `[1]` an; die Frage nach der
   * Spielerzahl entfaellt dann. Der Buzzer der zweiten Ecke verschwindet
   * ohnehin von selbst - die Fussleiste folgt dem Spielstand des Servers.
   */
  playerCounts?: readonly PlayerCount[]
  /**
   * Ton beim Start dieses Geraets - die Vorgabe aus dem Config File des
   * Gastgebers.
   *
   * Ohne Angabe gilt, was zuletzt am Geraet eingestellt war (die Engine merkt
   * es sich). MIT Angabe gewinnt sie bei jedem Start: Eine Spielesammlung, die
   * still laufen soll, soll das nicht davon abhaengig machen, was jemand
   * gestern am Geraet gedrueckt hat. Waehrend des Betriebs bleibt der Schalter
   * in den Einstellungen trotzdem bedienbar.
   */
  soundEnabled?: boolean
  /**
   * Zoomstufe der Buehne zwischen 0,6 und 1 - ebenfalls Vorgabe aus dem Config
   * File.
   *
   * 1 ist die volle, entworfene Groesse und damit das Maximum. Kleinere Werte
   * verkleinern die Szene zur Mitte hin; Punkte, Zaehler und Logo bleiben am
   * Bildrand und schrumpfen mit. Fuer sehr grosse Touchtische, an denen die
   * volle Groesse aus dem Stand nicht mehr zu ueberblicken ist.
   */
  zoom?: number
  /** Ergebnis eines beendeten Spiels - fuer die Bestenliste des Gastgebers. */
  onFinished?: (result: QuizGameResult) => void
  /**
   * Ruecksprung in die Gastgeberanwendung. Ist er gesetzt, erscheint der
   * entsprechende Knopf; fehlt er, gibt es kein Zurueck - so wie im Kiosk.
   */
  onExit?: () => void
  /**
   * Leerlauf-Aufsicht: Wird waehrend eines laufenden Spiels so lange nichts
   * beruehrt, wird es abgebrochen und die Auswahl kehrt zurueck.
   *
   * Ohne diesen Wert gibt es keine Aufsicht. Am unbeaufsichtigten Geraet ist sie
   * noetig, weil bewusst kein Zeitdruck auf einer Frage liegt: Ohne sie bliebe
   * ein Geraet mit einer offenen Frage stehen, bis jemand kommt.
   */
  idleTimeoutMs?: number
}

export function QuizGame({
  runtime: hostRuntime,
  audience,
  playerCounts,
  soundEnabled: soundVorgabe,
  zoom: zoomVorgabe,
  onFinished,
  onExit,
  idleTimeoutMs,
}: QuizGameProps) {
  // Ohne Gastgeber-Laufzeit die eigene Verbindung; mit ihr keine.
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

  useAudioUnlock(notifyAudioReady)
  /*
   * Die Klangdateien liegen ausserhalb des Komponentenbaums und ueberleben das
   * Entfernen sonst. In einer Gastgeberanwendung bliebe sonst von jedem Besuch
   * des Quiz ein weiterer Rest zurueck.
   */
  useEffect(() => () => releaseAudio(), [])

  /**
   * Der Nutzer hat nach dem Ergebnis "Nochmal" gewaehlt: Die Auswahl erscheint,
   * obwohl auf dem Server noch das beendete Spiel steht. Das ist die einzige
   * Ansichtsentscheidung, die dieser Client selbst trifft - alles andere folgt
   * dem Serverstand.
   */
  const [showChoice, setShowChoice] = useState(false)
  const greetedRef = useRef(false)
  /**
   * "Los geht's" ist gedrueckt, der Server hat aber noch nicht geantwortet.
   *
   * Ohne diesen Zwischenzustand zeigte der Client so lange den alten Stand - und
   * das waere ausgerechnet das Ergebnis der Vorgaenger, das beim Start kurz
   * aufblitzt.
   *
   * Die Revision taugt dafuer uebrigens nicht: Sie zaehlt je Spiel und beginnt
   * bei einem neuen wieder klein.
   */
  const [pendingStart, setPendingStart] = useState(false)

  /**
   * Einstellungen des Geraets.
   *
   * Der Ton gehoert der Engine (sie merkt ihn sich ueber Neustarts hinweg), die
   * Groesse dieser Ansicht - sie ist reine Darstellung und hat im Spielstand
   * nichts verloren. Beide beginnen bei der Vorgabe aus dem Config File.
   */
  const [zoom, setZoom] = useState(() => klemmeZoom(zoomVorgabe))
  const [settingsOpen, setSettingsOpen] = useState(false)
  /*
   * EINSTELLUNGEN GIBT ES NUR AM EIGENEN GERAET.
   *
   * Bringt der Gastgeber seine eigene Laufzeit mit, gehoert ihm auch der
   * Zustand: Was hier am Ton gedreht wird, hoert nur, wer davorsteht. Haengt das
   * Quiz dagegen an einem Server, gehoert der Ton der Vorstellung - dann duerfte
   * ein Besucher am Touchtisch im Foyer den Saal stummschalten.
   */
  const eigenesGeraet = Boolean(hostRuntime)
  /** Der Beenden-Knopf hat gefragt und wartet auf die Antwort. */
  const [askExit, setAskExit] = useState(false)

  /*
   * Die Vorgabe aus dem Config File gilt bei jedem Start - aber nur einmal:
   * Danach gehoert der Schalter dem, der vor dem Geraet steht, bis zum
   * naechsten Start.
   */
  const soundGesetztRef = useRef(false)
  useEffect(() => {
    if (soundVorgabe === undefined || soundGesetztRef.current) return
    const stand = snapshot?.view
    if (!stand) return
    soundGesetztRef.current = true
    if (stand.soundEnabled !== soundVorgabe) send({ type: 'SET_SOUND_ENABLED', enabled: soundVorgabe })
  }, [soundVorgabe, snapshot, send])

  // Eine geaenderte Vorgabe des Gastgebers schlaegt auf die Anzeige durch.
  useEffect(() => {
    setZoom(klemmeZoom(zoomVorgabe))
  }, [zoomVorgabe])

  /*
   * Beim Einsetzen der Komponente kann auf dem Server noch das Ergebnis einer
   * frueheren Partie stehen - etwa nach einem Neustart des Geraets. Es gehoert
   * Spielern, die laengst weg sind; wer jetzt davorsteht, soll die Auswahl sehen.
   * Ein Ergebnis, das WAEHREND dieser Sitzung entsteht, bleibt dagegen stehen.
   */
  useEffect(() => {
    if (!view || greetedRef.current) return
    greetedRef.current = true
    // Melden muss hier nichts unterdrueckt werden: Die Ereignisableitung unten
    // meldet ohnehin nur Ergebnisse, die WAEHREND dieser Sitzung entstehen.
    if (view.scene === 'result') setShowChoice(true)
  }, [view])

  /*
   * Das angeforderte Spiel steht, sobald eine Szene erscheint, die es nur
   * waehrend eines laufenden Spiels gibt. Weist der Server den Start ab - etwa
   * weil kein passender Fragenplatz uebrig ist -, kehrt die Auswahl zurueck,
   * damit niemand vor einem wartenden Bildschirm steht.
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
   * Ereignisableitung ueber die GANZE Sitzung - bewusst hier und nicht in der
   * eingebetteten Buehne: Die Buehne wird beim Startbildschirm ausgesetzt, ein
   * genau dann eintreffendes Ergebnis ginge ihr verloren. Gemeldet wird je
   * beendetem Spiel genau einmal, weil das Ergebnis-Ereignis am Szeneneintritt
   * haengt und nicht an der Revision.
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

  const idle = useIdleWatch({
    ...(idleTimeoutMs === undefined ? {} : { timeoutMs: idleTimeoutMs }),
    active: Boolean(view && view.scene !== 'start'),
    onIdle: () => {
      send({ type: 'ABORT_GAME' })
      setShowChoice(false)
    },
  })

  if (!view || !runtime) {
    return (
      <div className={`${styles.game} ${styles.waiting}`} data-quiz-game="">
        <p>{connected ? 'Das Quiz wird vorbereitet...' : 'Keine Verbindung zum Quiz.'}</p>
      </div>
    )
  }

  const audienceId = audience ?? view.catalog.audiences[0]?.id ?? ''
  // Ohne laufendes oder beendetes Spiel zeigt der Server die Startszene.
  const hasGame = view.scene !== 'start'
  const finished = view.scene === 'result'

  const start = ({ playerCount, presetId }: { playerCount: PlayerCount; presetId: string }) => {
    setShowChoice(false)
    setPendingStart(true)
    clearRejection()
    // Ein zweiter Tipp waehrend des Startens legt kein zweites Spiel an: Der
    // Server weist ihn ab, weil dann bereits ein Spiel laeuft.
    send({ type: 'START_GAME', audience: audienceId, presetId, playerCount, flowProfile: 'self-service' })
  }

  const leave = () => {
    send({ type: 'ABORT_GAME' })
    setShowChoice(false)
    setPendingStart(false)
    onExit?.()
  }

  /**
   * Das laufende Spiel abbrechen und zurueck ins Startmenue.
   *
   * Nicht dasselbe wie `leave`: Dort verlaesst man das Quiz und kehrt in die
   * Gastgeberanwendung zurueck, hier bleibt man im Quiz und faengt neu an.
   */
  const abort = () => {
    setAskExit(false)
    send({ type: 'ABORT_GAME' })
    setShowChoice(true)
    setPendingStart(false)
  }

  /*
   * Die Zoomstufe steht als Variable UEBER der Buehne: Szene, Kopfzeile und
   * Fussleiste lesen sie dort und verkleinern sich jede fuer sich - die Szene
   * zur Mitte, die Ecken zu ihrem Bildrand. Sie steht an JEDER Ansicht dieser
   * Komponente, damit sie beim Wechsel zwischen Auswahl und Spiel nicht
   * kurzzeitig verschwindet.
   */
  const flaeche = { '--stage-zoom': zoom } as CSSProperties

  const settings = settingsOpen && eigenesGeraet && (
    <GameSettings
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
        style={{ ...themeVariables(themeForView(view)), ...flaeche }}
        data-quiz-game=""
      >
        <GameStart
          view={view}
          audience={audienceId}
          playerCounts={playerCounts}
          onStart={start}
          onExit={onExit}
          {...(eigenesGeraet ? { onOpenSettings: () => setSettingsOpen(true) } : {})}
        />
        {settings}
      </div>
    )
  }

  if (pendingStart) {
    return (
      <div
        className={`${styles.game} ${styles.waiting}`}
        style={{ ...themeVariables(themeForView(view)), ...flaeche }}
        data-quiz-game=""
      >
        <p>Das Quiz wird vorbereitet...</p>
      </div>
    )
  }

  const players = view.playerScores
  /*
   * Am Zug ist, wem der offene Versuch gehoert - das sagt der Server. Diesen
   * Client interessiert es nur dafuer, welche Flaeche stumpf aussieht.
   */
  const turn = assignedPlayer(view)
  const solo = players.length === 1
  /*
   * Die Zeilen sind waehrend des ganzen Spiels Schaltflaechen, auch bevor jemand
   * gebuzzert hat - dann eben gesperrte. Erschienen die Knoepfe erst mit dem
   * Zuschlag, baute sich die Liste mitten in der Frage neu auf, und ein Finger,
   * der schon unterwegs ist, traefe ins Leere.
   */
  const answering = finished
    ? undefined
    : {
        disabled: !turn || !canAnswer(view, turn),
        label: turn ? `Antworten ${players.find((entry) => entry.playerId === turn)?.label ?? ''}`.trim() : 'Antworten',
        onSelect: (optionId: string) => {
          // Ohne Zuschlag ist die Zeile gesperrt; der Server wiese sie ohnehin ab.
          if (!turn || !canAnswer(view, turn)) return
          /*
           * Im Einzelspiel gibt es keinen Buzzerknopf: Der erste Fingertipp holt
           * den Zuschlag und loggt die Antwort in einem Zug. Das Einloggen ist
           * revisionsbefreit, deshalb darf es dem eigenen Buzz vorauseilen.
           */
          if (solo && !view.allowedCommands.includes('LOG_OPTION_ANSWER')) {
            send({ type: 'BUZZ', playerId: turn })
          }
          send({ type: 'LOG_OPTION_ANSWER', optionId })
        },
      }



  return (
    <div className={styles.game} style={flaeche} data-quiz-game="" onPointerDown={idle.notice}>
      {!connected && <span className={styles.offline} title="Keine Verbindung" aria-hidden="true" />}

      {/*
        * Ausstieg aus einem laufenden Spiel.
        *
        * MIT RUECKFRAGE, und zwar nicht aus Vorsicht vor Datenverlust: Der Knopf
        * steht am Rand einer Flaeche, auf der die ganze Zeit getippt wird, und
        * ein versehentlicher Treffer beendete sonst mitten in der Frage das
        * Spiel der beiden, die davorstehen.
        *
        * Ob es ihn gibt, sagt der Serverstand: In einem Spiel, das ein Operator
        * fuehrt, darf ihn niemand am Geraet abbrechen.
        */}
      {!finished && view.allowedCommands.includes('ABORT_GAME') && (
        <button type="button" className={`button ${styles.abort}`} data-abort-game="" onClick={() => setAskExit(true)}>
          Spiel beenden
        </button>
      )}

      {askExit && (
        <div className={styles.overlay} data-abort-dialog="">
          <div className={styles.panel} role="dialog" aria-label="Spiel beenden">
            <h2 className={styles.panelTitle}>Spiel wirklich beenden?</h2>
            <div className={styles.actions}>
              <button
                type="button"
                className={`button button--primary button--large ${styles.go}`}
                data-abort-confirm=""
                onClick={abort}
              >
                Beenden
              </button>
              <button
                type="button"
                className={`button button--large ${styles.leave}`}
                data-abort-cancel=""
                onClick={() => setAskExit(false)}
              >
                Weiterspielen
              </button>
            </div>
          </div>
        </div>
      )}

      <QuizScene
        runtime={runtime}
        /*
         * Im Hintergrund bleibt es still: Ein verdecktes Quiz darf nicht in die
         * Anwendung hineinklingen, die der Gastgeber gerade zeigt.
         */
        audible={hostVisible}
        variant="touch"
        {...(answering ? { answering } : {})}
        pads={{
          bottom: finished ? (
            <div className={styles.footer}>
              <button
                type="button"
                className={`button button--primary button--large ${styles.go}`}
                onClick={() => setShowChoice(true)}
              >
                Nochmal spielen
              </button>
              {onExit && (
                <button type="button" className={`button button--large ${styles.leave}`} onClick={leave}>
                  Beenden
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
