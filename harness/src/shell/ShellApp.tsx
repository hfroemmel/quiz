/**
 * Example host application.
 *
 * It is not a product but the first external user of `<QuizGame/>`: a tiny
 * game collection that starts the quiz, leaves it again, and starts it
 * again. This is exactly what lets the embedding contract's promises be
 * checked:
 *
 *   - the quiz stays in its box and doesn't recolour the collection;
 *   - result and return come out via `onFinished` and `onExit`, exactly
 *     once per finished game;
 *   - whoever provides the runtime also tears it down;
 *   - a host layer of its own (`overlay`) sits IN the stage and carries its
 *     dimensions, colours and zoom level;
 *   - a sound switch of the host's own is followed - at the start of a round
 *     and while one is running.
 *
 * The runtime therefore belongs to THIS component, not to the quiz: it is
 * created on entry and torn down on exit. The shipped game collection
 * (`hfroemmel/app-collection`) does the same.
 *
 * The collection deliberately has a look of its own. If that didn't survive
 * while playing, the contract would be broken.
 */
import { useState, type ReactNode } from 'react'
import { QuizGame, type QuizGameResult } from '@hfroemmel/quiz-react'
import { useLocalRuntime } from '../useLocalRuntime'
import styles from './ShellApp.module.css'

/**
 * A host layer of its own.
 *
 * It stands in here for the step a real application inserts between two
 * questions - `hfroemmel/bundestags-app` shows the background there for the
 * question. What matters is not what it says but WHERE it sits: the quiz
 * places it in the stage, so its colours, its container units and its zoom
 * level apply to it. Its button carries `stage-button` and therefore looks
 * like `Weiter` (Continue) in the footer bar.
 */
function HostLayer({ onClose }: { onClose: () => void }) {
  return (
    <div className={styles.layer} data-shell-layer="">
      <div className={styles.layerPanel}>
        <p className={styles.layerText}>Eine Ebene des Gastgebers.</p>
        <button
          type="button"
          className="stage-button stage-button--primary"
          data-shell-layer-close=""
          onClick={onClose}
        >
          Verstanden
        </button>
      </div>
    </div>
  )
}

/** Holds the runtime - and releases it again on removal. */
function Game({
  overlay,
  soundEnabled,
  onFinished,
  onExit,
}: {
  overlay?: ReactNode
  /**
   * The collection's own sound setting.
   *
   * A host application that has one switch for everything it runs owns this
   * decision, and the quiz follows it - not only when a round starts but also
   * when the switch is thrown while one is running.
   */
  soundEnabled: boolean
  onFinished: (result: QuizGameResult) => void
  onExit: () => void
}) {
  const { runtime, errors } = useLocalRuntime()

  if (errors) return <p className={styles.result}>Das Quiz konnte nicht geladen werden: {errors}</p>
  if (!runtime) return <p className={styles.result}>Das Quiz wird vorbereitet...</p>
  return (
    <QuizGame
      runtime={runtime}
      /*
       * The audience comes from the URL, just as on the device
       * (`?audience=kids`). A host sets it once and for all; but the harness
       * must be able to show BOTH worlds - the kids world looks the same
       * embedded as it does otherwise, and that's exactly what's being
       * checked here.
       */
      audience={audienceFromLocation()}
      soundEnabled={soundEnabled}
      idleTimeoutMs={120_000}
      onFinished={onFinished}
      onExit={onExit}
      {...(overlay ? { overlay } : {})}
    />
  )
}

/** Audience from the URL - the adult one if none is given. */
function audienceFromLocation(): string {
  return new URLSearchParams(window.location.search).get('audience') ?? 'adults'
}

export function ShellApp() {
  const [running, setRunning] = useState(false)
  const [lastResult, setLastResult] = useState<QuizGameResult | null>(null)
  const [rounds, setRounds] = useState(0)
  const [layer, setLayer] = useState(false)
  /* The collection's sound setting - one switch for every game in it. */
  const [sound, setSound] = useState(true)

  return (
    <div className={styles.shell} data-shell="">
      <header className={styles.bar} data-shell-bar="">
        <h1 className={styles.title}>Spielesammlung</h1>
        <div className={styles.barActions}>
          {/*
            * The collection's sound switch stands in the bar all the time -
            * in the menu as in a running round, because that is where a host
            * application keeps such a switch.
            */}
          <button
            className={styles.back}
            data-shell-sound=""
            aria-pressed={sound}
            onClick={() => setSound((value) => !value)}
          >
            {sound ? 'Ton aus' : 'Ton an'}
          </button>
          {running && (
            <>
              <button className={styles.back} data-shell-layer-open="" onClick={() => setLayer(true)}>
                Eigene Ebene
              </button>
              <button className={styles.back} onClick={() => setRunning(false)}>
                Zur Sammlung
              </button>
            </>
          )}
        </div>
      </header>

      {running ? (
        <main className={styles.frame} data-shell-frame="">
          {/*
            * The quiz runs in a box, not fullscreen. The border is
            * deliberate: it makes visible that the component stays within
            * its area.
            */}
          <Game
            soundEnabled={sound}
            {...(layer ? { overlay: <HostLayer onClose={() => setLayer(false)} /> } : {})}
            onFinished={(result) => {
              setLastResult(result)
              setRounds((value) => value + 1)
            }}
            onExit={() => {
              setLayer(false)
              setRunning(false)
            }}
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
