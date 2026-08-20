/**
 * Moderatoransicht (Spezifikation 5.2).
 *
 * Responsive Webanwendung fuer ein iPad im lokalen Netzwerk. Sie zeigt privat, was der
 * Moderator zum Sprechen braucht, und erlaubt genau vier Aktionen: aufloesen,
 * weiterschalten, Enthuellung pausieren/fortsetzen und die naechste Antwortphase
 * freigeben.
 *
 * Punkte, Spielabbruch, technische Einstellungen und Inhalte bleiben ausschliesslich
 * beim Operator. Das wird serverseitig erzwungen; hier werden nur die Aktionen
 * angeboten, die in `allowedCommands` stehen.
 *
 * Die Anwendung muss ohne diesen Client vollstaendig nutzbar bleiben.
 */
import { useEffect, useState } from 'react'
import type { ModeratorQuizViewModel } from '@quiz/contracts'
import { useQuizConnection } from '../../client/useQuizConnection.ts'
import { useRevealClock } from '../../client/useRevealClock.ts'
import { ConnectionBanner } from '../../components/ConnectionBanner.tsx'
import { themeVariables } from '../../presentation/StageScreen.tsx'
import styles from './ModeratorApp.module.css'

const CODE_STORAGE_KEY = 'quiz.moderator.session-code'

export function ModeratorApp() {
  const [code, setCode] = useState<string | null>(() => window.localStorage.getItem(CODE_STORAGE_KEY))
  const [draft, setDraft] = useState('')

  if (!code) {
    return (
      <div className={`${styles.moderator} ${styles.login}`}>
        <h1>Moderatoransicht</h1>
        <p>Bitte den Session-Code eingeben, der im Operatorfenster angezeigt wird.</p>
        <form
          onSubmit={(event) => {
            event.preventDefault()
            const value = draft.trim()
            if (!value) return
            window.localStorage.setItem(CODE_STORAGE_KEY, value)
            setCode(value)
          }}
        >
          <input
            className={styles.codeInput}
            inputMode="numeric"
            autoFocus
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            aria-label="Session-Code"
          />
          <button className="button button--primary button--large" type="submit">
            Verbinden
          </button>
        </form>
      </div>
    )
  }

  return <ModeratorSession code={code} onReset={() => {
    window.localStorage.removeItem(CODE_STORAGE_KEY)
    setCode(null)
  }} />
}

function ModeratorSession({ code, onReset }: { code: string; onReset: () => void }) {
  const { view, send, connected, lastRejection, clearRejection, serverNow } =
    useQuizConnection<ModeratorQuizViewModel>('moderator', code)
  const reveal = useRevealClock(view?.reveal, view?.serverTimeMs ?? 0, serverNow)

  // Ein falscher Code fuehrt zu einer sofort geschlossenen Verbindung. Nach mehreren
  // Fehlversuchen wird die Eingabe wieder angeboten.
  const [failedAttempts, setFailedAttempts] = useState(0)
  useEffect(() => {
    if (connected) setFailedAttempts(0)
    else {
      const timer = setTimeout(() => setFailedAttempts((value) => value + 1), 2_500)
      return () => clearTimeout(timer)
    }
  }, [connected, view])

  if (!view) {
    return (
      <div className={`${styles.moderator} ${styles.login}`}>
        <p>{connected ? 'Warte auf den Quizserver...' : 'Verbindung wird aufgebaut...'}</p>
        {failedAttempts > 1 && (
          <button className="button" onClick={onReset}>
            Anderen Session-Code eingeben
          </button>
        )}
      </div>
    )
  }

  const can = (type: Parameters<typeof view.allowedCommands.includes>[0]) => view.allowedCommands.includes(type)

  return (
    <div className={styles.moderator} data-moderator="" style={themeVariables(view)}>
      <ConnectionBanner connected={connected} rejection={lastRejection} onDismiss={clearRejection} />

      <header className={styles.header}>
        {/*
          * Der Moderator liest, er praesentiert nicht: Der Punktestand steht als
          * Textzeile, nicht als Buehnenkachel (docs/screens.md).
          */}
        <div className={styles.scores}>
          {view.playerScores.map((score) => (
            <span
              key={score.playerId}
              className={`${styles.score} ${score.active ? styles.scoreActive : ''}`}
            >
              {score.label}: <strong>{score.score}</strong>
              {score.locked && ' (gesperrt)'}
            </span>
          ))}
        </div>
        {view.progress.total > 0 && (
          <span>
            Frage {Math.min(view.progress.current, view.progress.total)}/{view.progress.total}
          </span>
        )}
      </header>

      <main className={styles.main}>
        <p className={styles.hint} data-moderator-hint="">{view.nextStepHint}</p>

        {view.question && (
          <section className={styles.question}>
            <h2>{view.question.prompt}</h2>
            {view.visibleOptions && (
              <ul className={styles.options}>
                {view.visibleOptions.map((option) => (
                  <li
                    key={option.id}
                    className={[
                      option.id === view.privateSolution?.correctOptionId ? styles.optionCorrect : '',
                      // Bereits als falsch bewertet - fuer die zweite Chance verbraucht.
                      option.state === 'chosen-incorrect' ? styles.optionUsed : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                  >
                    {option.text}
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {view.privateSolution && (
          <section className={styles.solution}>
            <p className={styles.answer} data-moderator-answer="">{view.privateSolution.answerText}</p>
            {view.explanation?.summary && <p>{view.explanation.summary}</p>}
            {view.explanation?.moderatorNotes && (
              <p className={styles.notes}>Regiehinweis: {view.explanation.moderatorNotes}</p>
            )}
          </section>
        )}

        <section className={styles.status}>
          {view.reveal && (
            <span>
              Enthuellung: {reveal.countdownSeconds} s
              {view.reveal.status === 'paused' ? ' (pausiert)' : ''}
            </span>
          )}
          {view.video && <span>Video: {view.video.status}</span>}
          {view.currentPlayer && (
            <span>
              Am Zug: {view.playerScores.find((score) => score.playerId === view.currentPlayer)?.label}
            </span>
          )}
          {view.answering?.loggedOptionId && (
            <span>
              Eingeloggt: {view.visibleOptions?.find((option) => option.id === view.answering?.loggedOptionId)?.text}
            </span>
          )}
        </section>
      </main>

      <footer className={styles.actions} data-moderator-actions="">
        {can('OPEN_BUZZER') && (
          <button className="button button--large" onClick={() => send({ type: 'OPEN_BUZZER' })}>
            Antworten einblenden
          </button>
        )}
        {can('START_IMAGE_REVEAL') && (
          <button className="button button--large" onClick={() => send({ type: 'START_IMAGE_REVEAL' })}>
            Enthüllung starten
          </button>
        )}
        {can('PAUSE_IMAGE_REVEAL') && (
          <button className="button button--large" onClick={() => send({ type: 'PAUSE_IMAGE_REVEAL' })}>
            Enthüllung pausieren
          </button>
        )}
        {can('RESUME_IMAGE_REVEAL') && (
          <button className="button button--large" onClick={() => send({ type: 'RESUME_IMAGE_REVEAL' })}>
            Enthüllung fortsetzen
          </button>
        )}
        {can('SHOW_QUESTION_AFTER_VIDEO') && (
          <button className="button button--large" onClick={() => send({ type: 'SHOW_QUESTION_AFTER_VIDEO' })}>
            Frage einblenden
          </button>
        )}
        {can('RESOLVE_ATTEMPT') && (
          <button className="button button--large button--primary" onClick={() => send({ type: 'RESOLVE_ATTEMPT' })}>
            Auflösen
          </button>
        )}
        {can('RESOLVE_WITHOUT_ANSWER') && (
          <button className="button button--large" onClick={() => send({ type: 'RESOLVE_WITHOUT_ANSWER' })}>
            Ohne Antwort auflösen
          </button>
        )}
        {can('CONTINUE') && (
          <button className="button button--large button--primary" onClick={() => send({ type: 'CONTINUE' })}>
            Weiter
          </button>
        )}
      </footer>
    </div>
  )
}
