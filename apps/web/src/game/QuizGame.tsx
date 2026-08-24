/**
 * Das spielbare Quiz als EINE Komponente.
 *
 * Sie ist der einzige Baustein, den ein Gastgeber kennt - der Kiosk genauso wie
 * eine Multigame-Anwendung. Was sie zeigt, entscheidet ausschliesslich der
 * Serverstand: Startauswahl, laufendes Spiel, Ergebnis.
 *
 * Die Flaeche in der Mitte ist DIESELBE Komposition wie auf dem Beamer
 * (`StageScreen`). Diese Ansicht ergaenzt nur, was es dort nicht gibt: die
 * Antwortflaechen der Spieler und die Auswahl davor.
 *
 * Spielregeln stehen hier keine. Ob ein Fingertipp zaehlt, entscheidet der Server.
 */
import { useEffect, useRef, useState } from 'react'
import type { PlayerCount, PlayerId, PlayerQuizViewModel } from '@quiz/contracts'
import { useQuizConnection } from '../client/useQuizConnection.ts'
import { StageScreen, themeVariables } from '../presentation/StageScreen.tsx'
import { releaseAudio } from '../presentation/soundCues.ts'
import { useAudioUnlock } from '../presentation/useAudioUnlock.ts'
import { AnswerPad } from './AnswerPad.tsx'
import { GameStart } from './GameStart.tsx'
import { canAnswer } from './answering.ts'
import { useHostVisible } from './useHostVisible.ts'
import { useIdleWatch } from './useIdleWatch.ts'
import styles from './Game.module.css'

export interface QuizGameResult {
  playerCount: number
  scores: { playerId: PlayerId; label: string; score: number }[]
  /** `null` bei Unentschieden und im Einzelspiel. */
  winnerPlayerId: PlayerId | null
  isDraw: boolean
  /** Nur im Einzelspiel gesetzt. */
  correctAnswers?: number
  questionCount: number
}

export interface QuizGameProps {
  /** Quizmodus, in dem dieses Geraet spielt. Ohne Angabe der erste des Katalogs. */
  quizModeId?: string
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

/**
 * Kennzeichen eines Ergebnisses.
 *
 * Es dient nur dazu, dasselbe Ergebnis nicht zweimal zu melden. Die Revision
 * taugt dafuer nicht: Sie aendert sich nach dem Spielende noch, etwa durch eine
 * Punktekorrektur, und das ist kein zweites Ergebnis.
 */
function resultKey(view: PlayerQuizViewModel): string {
  const scores = view.result?.scores.map((score) => score.score).join('-') ?? ''
  return `${view.progress.total}:${scores}`
}

export function QuizGame({ quizModeId, onFinished, onExit, idleTimeoutMs }: QuizGameProps) {
  const { view, send, connected, audioMaster, notifyAudioReady, serverNow, lastRejection, clearRejection } =
    useQuizConnection<PlayerQuizViewModel>('player')
  const reportedGameRef = useRef<string | null>(null)
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

  /*
   * Beim Einsetzen der Komponente kann auf dem Server noch das Ergebnis einer
   * frueheren Partie stehen - etwa nach einem Neustart des Geraets. Es gehoert
   * Spielern, die laengst weg sind; wer jetzt davorsteht, soll die Auswahl sehen.
   * Ein Ergebnis, das WAEHREND dieser Sitzung entsteht, bleibt dagegen stehen.
   */
  useEffect(() => {
    if (!view || greetedRef.current) return
    greetedRef.current = true
    if (view.scene !== 'result') return
    setShowChoice(true)
    /*
     * Dieses Ergebnis gilt als gemeldet, ohne es zu melden: Es gehoert einer
     * frueheren Partie. Ein Gastgeber wuerde sonst eine Punktzahl verbuchen, die
     * bei ihm nie gespielt wurde.
     */
    reportedGameRef.current = resultKey(view)
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

  useEffect(() => {
    if (!view || view.scene !== 'result' || !view.result) return
    // Genau einmal je beendetem Spiel melden. Die Revision aendert sich danach
    // noch, etwa durch eine Punktekorrektur - das ist kein zweites Ergebnis.
    const key = resultKey(view)
    if (reportedGameRef.current === key) return
    reportedGameRef.current = key
    onFinished?.({
      playerCount: view.result.scores.length,
      scores: view.result.scores.map(({ playerId, label, score }) => ({ playerId, label, score })),
      winnerPlayerId: view.result.winnerPlayerId,
      isDraw: view.result.isDraw,
      ...(view.result.solo ? { correctAnswers: view.result.solo.correctAnswers } : {}),
      questionCount: view.progress.total,
    })
  }, [view, onFinished])

  const idle = useIdleWatch({
    ...(idleTimeoutMs === undefined ? {} : { timeoutMs: idleTimeoutMs }),
    active: Boolean(view && view.scene !== 'start'),
    onIdle: () => {
      send({ type: 'ABORT_GAME' })
      setShowChoice(false)
    },
  })

  if (!view) {
    return (
      <div className={`${styles.game} ${styles.waiting}`} data-quiz-game="">
        <p>{connected ? 'Das Quiz wird vorbereitet...' : 'Keine Verbindung zum Quiz.'}</p>
      </div>
    )
  }

  const modeId = quizModeId ?? view.catalog.modes[0]?.id ?? ''
  // Ohne laufendes oder beendetes Spiel zeigt der Server die Startszene.
  const hasGame = view.scene !== 'start'
  const finished = view.scene === 'result'

  const start = ({ playerCount, presetId }: { playerCount: PlayerCount; presetId: string }) => {
    reportedGameRef.current = null
    setShowChoice(false)
    setPendingStart(true)
    clearRejection()
    // Ein zweiter Tipp waehrend des Startens legt kein zweites Spiel an: Der
    // Server weist ihn ab, weil dann bereits ein Spiel laeuft.
    send({ type: 'START_GAME', quizModeId: modeId, presetId, playerCount, flowProfile: 'self-service' })
  }

  const leave = () => {
    send({ type: 'ABORT_GAME' })
    setShowChoice(false)
    setPendingStart(false)
    onExit?.()
  }

  if (!pendingStart && (showChoice || !hasGame)) {
    return (
      <div className={`${styles.game} ${styles.startScreen}`} style={themeVariables(view)} data-quiz-game="">
        <GameStart view={view} quizModeId={modeId} onStart={start} onExit={onExit} />
      </div>
    )
  }

  if (pendingStart) {
    return (
      <div className={`${styles.game} ${styles.waiting}`} style={themeVariables(view)} data-quiz-game="">
        <p>Das Quiz wird vorbereitet...</p>
      </div>
    )
  }

  const options = view.visibleOptions ?? []
  const players = view.playerScores
  const answer = (playerId: PlayerId, optionId: string) => send({ type: 'ANSWER_BY_PLAYER', playerId, optionId })

  const pad = (index: 0 | 1, mirrored?: boolean) => {
    const player = players[index]
    if (finished || !player) return undefined
    return (
      <AnswerPad
        playerId={player.playerId}
        label={player.label}
        options={options}
        scene={view.scene}
        enabled={canAnswer(view, player.playerId)}
        {...(mirrored ? { mirrored: true } : {})}
        onAnswer={answer}
      />
    )
  }

  return (
    <div className={styles.game} data-quiz-game="" onPointerDown={idle.notice}>
      {!connected && <span className={styles.offline} title="Keine Verbindung" aria-hidden="true" />}

      <StageScreen
        view={view}
        serverNow={serverNow}
        /*
         * Im Hintergrund bleibt es still: Ein verdecktes Quiz darf nicht in die
         * Anwendung hineinklingen, die der Gastgeber gerade zeigt.
         */
        isAudioMaster={audioMaster && hostVisible}
        onReport={send}
        variant="touch"
        pads={{
          // Zweiter Spieler sitzt gegenueber: eigene Leiste, um 180 Grad gedreht.
          ...(pad(1, true) ? { top: pad(1, true) } : {}),
          bottom: finished ? (
            <div className={styles.footer}>
              <button type="button" className={styles.go} onClick={() => setShowChoice(true)}>
                Nochmal spielen
              </button>
              {onExit && (
                <button type="button" className={styles.leave} onClick={leave}>
                  Beenden
                </button>
              )}
            </div>
          ) : (
            pad(0)
          ),
        }}
      />
    </div>
  )
}
