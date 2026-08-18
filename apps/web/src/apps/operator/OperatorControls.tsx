/**
 * Kontextabhaengige Steuerung des Operators (Spezifikation 6.2).
 *
 * Regel: Ein Button benennt genau die Aktion, die er im aktuellen Zustand ausfuehrt.
 * Welche Aktionen es gibt, kommt ausschliesslich aus `view.allowedCommands` - diese
 * Datei baut die Regeln NICHT nach. Dadurch gibt es keine Reihe dauerhaft
 * deaktivierter Buttons mehr, und Operator- und Moderatorclient koennen niemals
 * auseinanderlaufen.
 */
import type { Command, CommandType, OperatorQuizViewModel } from '@quiz/contracts'
import { optionLetter } from '../../ui/OptionBar.tsx'

interface Props {
  view: OperatorQuizViewModel
  send: (command: Command) => void
}

export function OperatorControls({ view, send }: Props) {
  const can = (type: CommandType) => view.allowedCommands.includes(type)
  const question = view.privateSolution
  const answering = view.answering

  return (
    <section className="controls" aria-label="Steuerung">
      {/* --- Spieler bestimmen --- */}
      {(can('OPEN_BUZZER') || can('SELECT_PLAYER_MANUALLY') || can('RESET_BUZZER')) && (
        <div className="controls__group">
          <h3 className="controls__title">Spielerauswahl</h3>
          <div className="controls__row">
            {can('OPEN_BUZZER') && (
              <button className="button button--primary" onClick={() => send({ type: 'OPEN_BUZZER' })}>
                Buzzer freigeben
              </button>
            )}
            {can('SELECT_PLAYER_MANUALLY') &&
              view.playerScores.map((score) => (
                <button
                  key={score.playerId}
                  className="button"
                  disabled={score.locked}
                  onClick={() => send({ type: 'SELECT_PLAYER_MANUALLY', playerId: score.playerId })}
                  title="Fallback, falls der Hardware-Buzzer nicht funktioniert"
                >
                  {score.label} manuell auswaehlen
                </button>
              ))}
            {can('RESET_BUZZER') && (
              <button className="button" onClick={() => send({ type: 'RESET_BUZZER' })}>
                Buzzer zuruecksetzen
              </button>
            )}
          </div>
        </div>
      )}

      {/* --- Antwort einloggen und auswerten --- */}
      {(can('LOG_OPTION_ANSWER') || can('MARK_MANUAL_ANSWER')) && (
        <div className="controls__group">
          <h3 className="controls__title">
            Antwort einloggen
            {answering && (
              <span className="controls__badge">
                Versuch {answering.attemptNumber} &middot; {answering.pointsIfCorrect} Punkte bei richtig
              </span>
            )}
          </h3>

          {can('LOG_OPTION_ANSWER') && view.visibleOptions && (
            <div className="controls__row controls__row--options">
              {view.visibleOptions.map((option, index) => {
                const isCorrect = option.id === question?.correctOptionId
                const isLogged = answering?.loggedOptionId === option.id
                return (
                  <button
                    key={option.id}
                    className={`button button--option ${isLogged ? 'button--selected' : ''} ${isCorrect ? 'button--marks-correct' : ''}`}
                    onClick={() => send({ type: 'LOG_OPTION_ANSWER', optionId: option.id })}
                    // Der Antworttext steht bereits auf der Buehne. Die Taste traegt
                    // deshalb nur den Buchstaben; der Volltext bleibt als Tooltip.
                    title={option.text}
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
            <div className="controls__row">
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
        <div className="controls__group">
          <h3 className="controls__title">Aufloesen</h3>
          <div className="controls__row">
            {can('RESOLVE_ATTEMPT') && (
              <button
                className="button button--primary"
                disabled={!answering?.loggedOptionId && !answering?.loggedManualVerdict}
                onClick={() => send({ type: 'RESOLVE_ATTEMPT' })}
                title="Wertet den eingeloggten Versuch verbindlich aus und bucht die Punkte"
              >
                Aufloesen und bewerten
              </button>
            )}
            {can('PASS_SECOND_CHANCE') && (
              <button className="button" onClick={() => send({ type: 'PASS_SECOND_CHANCE' })}>
                Spieler passt (0 Punkte)
              </button>
            )}
            {can('RESOLVE_WITHOUT_ANSWER') && (
              <button className="button" onClick={() => send({ type: 'RESOLVE_WITHOUT_ANSWER' })}>
                Ohne Antwort aufloesen
              </button>
            )}
          </div>
        </div>
      )}

      {/* --- Bilderkennen --- */}
      {(can('PAUSE_IMAGE_REVEAL') || can('RESUME_IMAGE_REVEAL') || can('REVEAL_IMAGE_COMPLETELY')) && (
        <div className="controls__group">
          <h3 className="controls__title">Bildenthuellung</h3>
          <div className="controls__row">
            {can('PAUSE_IMAGE_REVEAL') && (
              <button className="button" onClick={() => send({ type: 'PAUSE_IMAGE_REVEAL' })}>
                Enthuellung pausieren
              </button>
            )}
            {can('RESUME_IMAGE_REVEAL') && (
              <button className="button" onClick={() => send({ type: 'RESUME_IMAGE_REVEAL' })}>
                Enthuellung fortsetzen
              </button>
            )}
            {can('REVEAL_IMAGE_COMPLETELY') && (
              <button className="button" onClick={() => send({ type: 'REVEAL_IMAGE_COMPLETELY' })}>
                Bild vollstaendig aufdecken
              </button>
            )}
            {can('RESET_IMAGE_REVEAL') && (
              // Technische Korrekturaktion - bewusst klar getrennt von "Buzzer zuruecksetzen".
              <button
                className="button button--technical"
                onClick={() => {
                  if (confirm('Enthuellung technisch auf Sekunde 10 zuruecksetzen?')) {
                    send({ type: 'RESET_IMAGE_REVEAL' })
                  }
                }}
              >
                Enthuellung auf Anfang zuruecksetzen
              </button>
            )}
          </div>
        </div>
      )}

      {/* --- Video --- */}
      {(can('START_VIDEO') || can('PAUSE_VIDEO') || can('SHOW_QUESTION_AFTER_VIDEO')) && (
        <div className="controls__group">
          <h3 className="controls__title">Video</h3>
          <div className="controls__row">
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
            {can('SEEK_VIDEO') && (
              <label className="controls__seek">
                Position
                <input
                  type="range"
                  min={0}
                  max={Math.max(1000, view.video?.positionMs ?? 0)}
                  step={1000}
                  value={view.video?.positionMs ?? 0}
                  onChange={(event) => send({ type: 'SEEK_VIDEO', positionMs: Number(event.target.value) })}
                />
                <span>{Math.round((view.video?.positionMs ?? 0) / 1000)} s</span>
              </label>
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
        <div className="controls__group controls__group--continue">
          <button className="button button--large button--primary" onClick={() => send({ type: 'CONTINUE' })}>
            {view.progress.current >= view.progress.total ? 'Weiter zum Ergebnis' : 'Weiter zur naechsten Frage'}
          </button>
        </div>
      )}
    </section>
  )
}
