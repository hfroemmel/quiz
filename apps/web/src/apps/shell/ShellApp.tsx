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
import { QuizGame, type QuizGameResult } from '../../game/QuizGame'
import styles from './ShellApp.module.css'

export function ShellApp() {
  const [running, setRunning] = useState(false)
  const [lastResult, setLastResult] = useState<QuizGameResult | null>(null)
  const [rounds, setRounds] = useState(0)

  if (!import.meta.env.DEV) {
    return (
      <div className={styles.shell}>
        <p>Die Beispielsammlung gibt es nur im Entwicklungsmodus.</p>
      </div>
    )
  }

  return (
    <div className={styles.shell} data-shell="">
      <header className={styles.bar} data-shell-bar="">
        <h1 className={styles.title}>Spielesammlung</h1>
        {running && (
          <button className={styles.back} onClick={() => setRunning(false)}>
            Zur Sammlung
          </button>
        )}
      </header>

      {running ? (
        <main className={styles.frame} data-shell-frame="">
          {/*
            * Das Quiz laeuft in einem Kasten, nicht im Vollbild. Der Rahmen ist
            * Absicht: Er macht sichtbar, dass die Komponente sich an ihre Flaeche
            * haelt.
            */}
          <QuizGame
            audience="adults"
            idleTimeoutMs={120_000}
            onFinished={(result) => {
              setLastResult(result)
              setRounds((value) => value + 1)
            }}
            onExit={() => setRunning(false)}
          />
        </main>
      ) : (
        <main className={styles.menu} data-shell-menu="">
          <button className={styles.tile} onClick={() => setRunning(true)}>
            <span className={styles.tileName}>Quiz</span>
            <span className={styles.tileNote}>1 oder 2 Spieler</span>
          </button>
          <span className={`${styles.tile} ${styles.tileEmpty}`}>
            <span className={styles.tileName}>Platzhalter</span>
            <span className={styles.tileNote}>ein anderes Spiel</span>
          </span>

          {lastResult && (
            <p className={styles.result} data-shell-result="" data-rounds={rounds}>
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
