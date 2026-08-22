/**
 * Beispielhafte Gastgeberanwendung (nur im Entwicklungsmodus).
 *
 * Sie ist kein Produkt, sondern der erste fremde Nutzer von `<QuizGame/>`: eine
 * winzige Spielesammlung, die das Quiz startet, wieder verlaesst und erneut
 * startet. Genau daran laesst sich pruefen, was der Einbettungsvertrag zusagt:
 *
 *   - das Quiz bleibt in seinem Kasten und faerbt die Sammlung nicht um;
 *   - beim Verlassen bleibt nichts zurueck - keine Verbindung, kein Timer, kein Ton;
 *   - Ergebnis und Ruecksprung kommen ueber `onFinished` und `onExit` heraus.
 *
 * Die Sammlung hat bewusst ein eigenes Aussehen. Bliebe es beim Spielen nicht
 * erhalten, waere der Vertrag gebrochen.
 */
import { useState } from 'react'
import { QuizGame, type QuizGameResult } from '@quiz/game'

export function ShellApp() {
  const [running, setRunning] = useState(false)
  const [lastResult, setLastResult] = useState<QuizGameResult | null>(null)
  const [rounds, setRounds] = useState(0)

  if (!import.meta.env.DEV) {
    return (
      <div className="shell shell--disabled">
        <p>Die Beispielsammlung gibt es nur im Entwicklungsmodus.</p>
      </div>
    )
  }

  return (
    <div className="shell">
      <header className="shell__bar">
        <h1 className="shell__title">Spielesammlung</h1>
        {running && (
          <button className="shell__back" onClick={() => setRunning(false)}>
            Zur Sammlung
          </button>
        )}
      </header>

      {running ? (
        <main className="shell__frame">
          {/*
            * Das Quiz laeuft in einem Kasten, nicht im Vollbild. Der Rahmen ist
            * Absicht: Er macht sichtbar, dass die Komponente sich an ihre Flaeche
            * haelt.
            */}
          <QuizGame
            quizModeId="adults"
            idleTimeoutMs={120_000}
            onFinished={(result) => {
              setLastResult(result)
              setRounds((value) => value + 1)
            }}
            onExit={() => setRunning(false)}
          />
        </main>
      ) : (
        <main className="shell__menu">
          <button className="shell__tile" onClick={() => setRunning(true)}>
            <span className="shell__tile-name">Quiz</span>
            <span className="shell__tile-note">1 oder 2 Spieler</span>
          </button>
          <span className="shell__tile shell__tile--empty">
            <span className="shell__tile-name">Platzhalter</span>
            <span className="shell__tile-note">ein anderes Spiel</span>
          </span>

          {lastResult && (
            <p className="shell__result" data-rounds={rounds}>
              Letztes Ergebnis:{' '}
              {lastResult.scores.map((score) => `${score.label} ${score.score}`).join(' · ')}
              {lastResult.correctAnswers !== undefined &&
                ` (${lastResult.correctAnswers} von ${lastResult.questionCount} richtig)`}
            </p>
          )}
        </main>
      )}
    </div>
  )
}
