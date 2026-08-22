/**
 * Das spielbare Quiz als eine Komponente.
 *
 * Sie ist der einzige Baustein, den ein Gastgeber kennt - der Kiosk genauso wie
 * eine Multigame-Anwendung. Was sie zeigt, entscheidet ausschliesslich der
 * Serverstand: Startauswahl, laufendes Spiel, Ergebnis.
 *
 * Die Buehnenflaeche in der Mitte ist dieselbe Komposition wie auf dem Beamer
 * (`@quiz/presentation`). Dieses Paket ergaenzt nur, was es dort nicht gibt: die
 * Antwortflaechen der Spieler und die Auswahl davor.
 *
 * Spielregeln stehen hier keine. Ob ein Fingertipp zaehlt, entscheidet der Server.
 */
import { useEffect, useRef, useState } from 'react'
import type { PlayerCount, PlayerId, PlayerQuizViewModel } from '@quiz/contracts'
import { useQuizConnection } from '@quiz/client'
import { StageScreen, themeVariables } from '@quiz/presentation'
import { AnswerPad } from './AnswerPad.tsx'
import { GameStart } from './GameStart.tsx'
import { canAnswer } from './answering.ts'

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
}

export function QuizGame({ quizModeId, onFinished, onExit }: QuizGameProps) {
  const { view, send, connected, audioMaster, serverNow } = useQuizConnection<PlayerQuizViewModel>('player')
  const reportedGameRef = useRef<string | null>(null)
  /**
   * Der Nutzer hat nach dem Ergebnis "Nochmal" gewaehlt: Die Auswahl erscheint,
   * obwohl auf dem Server noch das beendete Spiel steht. Das ist die einzige
   * Ansichtsentscheidung, die dieser Client selbst trifft - alles andere folgt
   * dem Serverstand.
   */
  const [showChoice, setShowChoice] = useState(false)

  useEffect(() => {
    if (!view || view.scene !== 'result' || !view.result) return
    // Genau einmal je beendetem Spiel melden. Die Revision aendert sich danach
    // noch, etwa durch eine Punktekorrektur - das ist kein zweites Ergebnis.
    const key = `${view.progress.total}:${view.result.scores.map((score) => score.score).join('-')}`
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

  if (!view) {
    return (
      <div className="quiz-game quiz-game--offline">
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
    // Ein zweiter Tipp waehrend des Startens legt kein zweites Spiel an: Der
    // Server weist ihn ab, weil dann bereits ein Spiel laeuft.
    send({ type: 'START_GAME', quizModeId: modeId, presetId, playerCount, flowProfile: 'self-service' })
  }

  const answer = (playerId: PlayerId, optionId: string) => {
    send({ type: 'ANSWER_BY_PLAYER', playerId, optionId })
  }

  const leave = () => {
    send({ type: 'ABORT_GAME' })
    setShowChoice(false)
    onExit?.()
  }

  if (showChoice || !hasGame) {
    return (
      <div className="quiz-game quiz-game--start" style={themeVariables(view)}>
        <GameStart view={view} quizModeId={modeId} onStart={start} onExit={onExit} />
      </div>
    )
  }

  const options = view.visibleOptions ?? []
  const players = view.playerScores

  return (
    <div className="quiz-game" style={themeVariables(view)}>
      {!connected && <span className="quiz-game__offline" title="Keine Verbindung" aria-hidden="true" />}

      {/* Zweiter Spieler sitzt gegenueber: eigene Leiste, um 180 Grad gedreht. */}
      {!finished && players[1] && (
        <AnswerPad
          playerId={players[1].playerId}
          label={players[1].label}
          options={options}
          enabled={canAnswer(view, players[1].playerId)}
          mirrored
          onAnswer={answer}
        />
      )}

      <div className="quiz-game__stage">
        <StageScreen
          view={view}
          serverNow={serverNow}
          isAudioMaster={audioMaster}
          onReport={send}
          variant="touch"
        />
      </div>

      {finished ? (
        <div className="quiz-game__footer">
          <button type="button" className="game-start__go" onClick={() => setShowChoice(true)}>
            Nochmal spielen
          </button>
          {onExit && (
            <button type="button" className="game-start__leave" onClick={leave}>
              Beenden
            </button>
          )}
        </div>
      ) : (
        players[0] && (
          <AnswerPad
            playerId={players[0].playerId}
            label={players[0].label}
            options={options}
            enabled={canAnswer(view, players[0].playerId)}
            onAnswer={answer}
          />
        )
      )}
    </div>
  )
}
