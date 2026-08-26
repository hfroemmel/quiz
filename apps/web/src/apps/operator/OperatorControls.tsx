/**
 * Kontextabhaengige Steuerung des Operators (Spezifikation 6.2).
 *
 * Regel: Ein Button benennt genau die Aktion, die er im aktuellen Zustand ausfuehrt.
 * Welche Aktionen es gibt, kommt ausschliesslich aus `view.allowedCommands` - diese
 * Datei baut die Regeln NICHT nach. Dadurch gibt es keine Reihe dauerhaft
 * deaktivierter Buttons mehr, und Operator- und Moderatorclient koennen niemals
 * auseinanderlaufen.
 */
import { useState } from 'react'
import type { Command, CommandType, OperatorQuizViewModel } from '@hfroemmel/quiz-core'
import { ConfirmDialog } from '../../ui/ConfirmDialog'
import { optionLetter } from '../../presentation/stage/answerState'
import styles from './OperatorControls.module.css'

interface Props {
  view: OperatorQuizViewModel
  send: (command: Command) => void
  /** Rasterzelle im Rahmen - wo das Bauteil sitzt, weiss der Rahmen. */
  className?: string
  /**
   * Zurueck zur Startansicht. Nur gesetzt, wenn es dorthin auch etwas
   * zurueckzugehen gibt - also nach dem Ergebnis.
   */
  onBackToStart?: () => void
}

export function OperatorControls({ view, send, className, onBackToStart }: Props) {
  const [confirmReset, setConfirmReset] = useState(false)
  const can = (type: CommandType) => view.allowedCommands.includes(type)
  const question = view.privateSolution
  const answering = view.answering

  return (
    <section className={[styles.controls, className].filter(Boolean).join(' ')} data-controls="" aria-label="Steuerung">
      {/* --- Runde freigeben --- */}
      {(can('OPEN_BUZZER') || can('START_IMAGE_REVEAL')) && (
        <div className={styles.group}>
          <h3 className={styles.title}>Runde</h3>
          <div className={styles.row}>
            {/*
              * Der Zwischenschritt: Erst steht nur die Frage, der Moderator liest
              * sie vor. Antwortmoeglichkeiten bzw. Enthuellung erscheinen auf
              * Klick - und erst dann darf gebuzzert werden.
              */}
            {can('OPEN_BUZZER') && (
              <button className="button button--primary" onClick={() => send({ type: 'OPEN_BUZZER' })}>
                Antworten einblenden
              </button>
            )}
            {can('START_IMAGE_REVEAL') && (
              <button className="button button--primary" onClick={() => send({ type: 'START_IMAGE_REVEAL' })}>
                Enthüllung starten
              </button>
            )}
          </div>
        </div>
      )}

      {/* --- Spieler bestimmen --- */}
      {(can('SELECT_PLAYER_MANUALLY') || can('RESET_BUZZER')) && (
        <div className={styles.group}>
          <h3 className={styles.title}>Spielerauswahl</h3>
          <div className={styles.row}>
            {can('SELECT_PLAYER_MANUALLY') &&
              view.playerScores.map((score) => (
                <button
                  key={score.playerId}
                  className={`button ${view.currentPlayer === score.playerId ? 'button--selected' : ''}`}
                  disabled={score.locked}
                  onClick={() => send({ type: 'SELECT_PLAYER_MANUALLY', playerId: score.playerId })}
                  title="Fallback, falls der Hardware-Buzzer nicht funktioniert"
                >
                  {score.label}
                </button>
              ))}
            {can('RESET_BUZZER') && (
              <button
                className="button"
                // Ohne zugeordneten Spieler gibt es nichts zurueckzunehmen.
                disabled={!view.currentPlayer}
                onClick={() => send({ type: 'RESET_BUZZER' })}
                title="Spielerzuordnung und eingeloggte Antwort verwerfen"
              >
                zurücksetzen
              </button>
            )}
          </div>
        </div>
      )}

      {/* --- Antwort einloggen und auswerten --- */}
      {(can('LOG_OPTION_ANSWER') || can('MARK_MANUAL_ANSWER')) && (
        <div className={styles.group}>
          <h3 className={styles.title}>Antwort einloggen</h3>

          {can('LOG_OPTION_ANSWER') && view.visibleOptions && (
            <div className={`${styles.row} ${styles.rowOptions}`} data-option-buttons="">
              {view.visibleOptions.map((option, index) => {
                const isCorrect = option.id === question?.correctOptionId
                const isLogged = answering?.loggedOptionId === option.id
                /*
                 * In der zweiten Chance ist eine schon als falsch bewertete Option
                 * verbraucht. Der Server lehnt sie ab; die Taste zeigt das vorher.
                 */
                const isUsedUp = option.state === 'chosen-incorrect'
                return (
                  <button
                    key={option.id}
                    className={`button button--option ${isLogged ? 'button--selected' : ''}`}
                    data-marks-correct={isCorrect ? '' : undefined}
                    disabled={isUsedUp}
                    onClick={() => send({ type: 'LOG_OPTION_ANSWER', optionId: option.id })}
                    // Der Antworttext steht bereits auf der Buehne. Die Taste traegt
                    // deshalb nur den Buchstaben; der Volltext bleibt als Tooltip.
                    title={isUsedUp ? `${option.text} - bereits als falsch bewertet` : option.text}
                  >
                    <span className="button__marker">{optionLetter(index)}</span>
                    {/* Nur der Operator sieht, welche Option richtig ist. */}
                    {isCorrect && <span className="button__flag">richtig</span>}
                  </button>
                )
              })}
            </div>
          )}

          {can('MARK_MANUAL_ANSWER') && (
            <div className={styles.row}>
              <button
                className={`button button--correct ${answering?.loggedManualVerdict === 'correct' ? 'button--selected' : ''}`}
                onClick={() => send({ type: 'MARK_MANUAL_ANSWER', verdict: 'correct' })}
              >
                Antwort war richtig
              </button>
              <button
                className={`button button--incorrect ${answering?.loggedManualVerdict === 'incorrect' ? 'button--selected' : ''}`}
                onClick={() => send({ type: 'MARK_MANUAL_ANSWER', verdict: 'incorrect' })}
              >
                Antwort war falsch
              </button>
            </div>
          )}
        </div>
      )}

      {/* --- Aufloesen --- */}
      {(can('RESOLVE_ATTEMPT') || can('RESOLVE_WITHOUT_ANSWER') || can('PASS_SECOND_CHANCE')) && (
        <div className={styles.group}>
          <h3 className={styles.title}>Auflösen</h3>
          <div className={styles.row}>
            {can('RESOLVE_ATTEMPT') && (
              <button
                className="button button--primary"
                disabled={!answering?.loggedOptionId && !answering?.loggedManualVerdict}
                onClick={() => send({ type: 'RESOLVE_ATTEMPT' })}
                title="Wertet den eingeloggten Versuch verbindlich aus und bucht die Punkte"
              >
                Auflösen und bewerten
              </button>
            )}
            {can('PASS_SECOND_CHANCE') && (
              <button className="button" onClick={() => send({ type: 'PASS_SECOND_CHANCE' })}>
                Spieler passt (0 Punkte)
              </button>
            )}
            {can('RESOLVE_WITHOUT_ANSWER') && (
              <button className="button" onClick={() => send({ type: 'RESOLVE_WITHOUT_ANSWER' })}>
                Ohne Antwort auflösen
              </button>
            )}
          </div>
        </div>
      )}

      {/* --- Bilderkennen --- */}
      {(can('PAUSE_IMAGE_REVEAL') || can('RESUME_IMAGE_REVEAL') || can('REVEAL_IMAGE_COMPLETELY')) && (
        <div className={styles.group}>
          <h3 className={styles.title}>Bildenthüllung</h3>
          <div className={styles.row}>
            {can('PAUSE_IMAGE_REVEAL') && (
              <button className="button" onClick={() => send({ type: 'PAUSE_IMAGE_REVEAL' })}>
                Enthüllung pausieren
              </button>
            )}
            {can('RESUME_IMAGE_REVEAL') && (
              <button className="button" onClick={() => send({ type: 'RESUME_IMAGE_REVEAL' })}>
                Enthüllung fortsetzen
              </button>
            )}
            {can('REVEAL_IMAGE_COMPLETELY') && (
              <button className="button" onClick={() => send({ type: 'REVEAL_IMAGE_COMPLETELY' })}>
                Bild vollständig aufdecken
              </button>
            )}
            {can('RESET_IMAGE_REVEAL') && (
              // Technische Korrekturaktion - bewusst klar getrennt von "Buzzer zuruecksetzen".
              <button className="button button--technical" onClick={() => setConfirmReset(true)}>
                Enthüllung auf Anfang zurücksetzen
              </button>
            )}
          </div>
        </div>
      )}

      {/* --- Video --- */}
      {(can('START_VIDEO') || can('PAUSE_VIDEO') || can('SHOW_QUESTION_AFTER_VIDEO')) && (
        <div className={styles.group}>
          <h3 className={styles.title}>Video</h3>
          <div className={styles.row}>
            {can('START_VIDEO') && (
              <button className="button button--primary" onClick={() => send({ type: 'START_VIDEO' })}>
                Video starten
              </button>
            )}
            {can('PAUSE_VIDEO') && (
              <button className="button" onClick={() => send({ type: 'PAUSE_VIDEO' })}>
                Video pausieren
              </button>
            )}
            {can('RESTART_VIDEO') && (
              <button className="button" onClick={() => send({ type: 'RESTART_VIDEO' })}>
                Video neu starten
              </button>
            )}
            {can('SHOW_QUESTION_AFTER_VIDEO') && (
              <button className="button button--primary" onClick={() => send({ type: 'SHOW_QUESTION_AFTER_VIDEO' })}>
                Frage einblenden
              </button>
            )}
          </div>
        </div>
      )}

      {/* --- Weiter --- */}
      {can('CONTINUE') && (
        <div className={styles.group}>
          <button className="button button--large button--primary" onClick={() => send({ type: 'CONTINUE' })}>
            {view.progress.current >= view.progress.total ? 'Weiter zum Ergebnis' : 'Weiter zur nächsten Frage'}
          </button>
        </div>
      )}
      {/* --- Nach dem Ergebnis --- */}
      {onBackToStart && (
        <div className={styles.group}>
          <button className="button button--large button--primary" onClick={onBackToStart}>
            Zurück zur Startansicht
          </button>
        </div>
      )}
      {confirmReset && (
        <ConfirmDialog
          title="Enthüllung zurücksetzen"
          message="Das Bild wird wieder vollständig verdeckt und deckt sich erneut auf. Bereits gebuchte Punkte bleiben unverändert."
          confirmLabel="Zurücksetzen"
          onConfirm={() => {
            send({ type: 'RESET_IMAGE_REVEAL' })
            setConfirmReset(false)
          }}
          onCancel={() => setConfirmReset(false)}
        />
      )}
    </section>
  )
}
