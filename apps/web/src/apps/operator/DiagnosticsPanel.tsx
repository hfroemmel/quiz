/**
 * Diagnose und Protokoll fuer den Operator (Spezifikation 29).
 *
 * Enthaelt Paketversion, Veranstaltungstag, Session-Code fuer den Moderator,
 * verbundene Clients, Warnungen in klarer Sprache und das Auditlog. Moderatoraktionen
 * erscheinen hier ebenfalls, damit der Operator sie unmittelbar sieht.
 */
import type { Command, OperatorQuizViewModel } from '@quiz/contracts'

export function DiagnosticsPanel({
  view,
  send,
  connectedClients,
}: {
  view: OperatorQuizViewModel
  send: (command: Command) => void
  connectedClients: number
}) {
  const diagnostics = view.diagnostics

  return (
    <section className="diagnostics">
      <details>
        <summary>Technik, Protokoll und Verbindung</summary>

        <dl className="diagnostics__facts">
          <div>
            <dt>Quizpaket</dt>
            <dd>{diagnostics.contentVersion}</dd>
          </div>
          <div>
            <dt>Veranstaltungstag</dt>
            <dd>{diagnostics.eventDayId}</dd>
          </div>
          <div>
            <dt>Session-Code (Moderator)</dt>
            <dd className="diagnostics__code">{diagnostics.sessionCode ?? '-'}</dd>
          </div>
          <div>
            <dt>Verbundene Clients</dt>
            <dd>{connectedClients}</dd>
          </div>
        </dl>

        {diagnostics.lanUrls && diagnostics.lanUrls.length > 0 && (
          <p className="diagnostics__lan">
            Moderatoransicht im Netzwerk: {diagnostics.lanUrls.map((url) => `${url}/moderator`).join(', ')}
          </p>
        )}

        {diagnostics.selectionRationale && (
          <p className="diagnostics__rationale">Fragenauswahl: {diagnostics.selectionRationale}</p>
        )}

        {diagnostics.warnings.length > 0 && (
          <ul className="diagnostics__warnings">
            {diagnostics.warnings.map((warning, index) => (
              <li key={index}>{warning}</li>
            ))}
          </ul>
        )}

        <div className="controls__row">
          <a className="button" href="/api/export/changes" target="_blank" rel="noreferrer">
            Aenderungsbericht exportieren
          </a>
          {view.allowedCommands.includes('START_NEW_EVENT_DAY') && (
            <button
              className="button button--technical"
              onClick={() => {
                if (confirm('Neuen Veranstaltungstag beginnen? Die Wiederholungshistorie startet damit neu.')) {
                  send({ type: 'START_NEW_EVENT_DAY' })
                }
              }}
            >
              Neuen Veranstaltungstag beginnen
            </button>
          )}
        </div>

        <h3 className="diagnostics__title">Protokoll</h3>
        <ol className="audit">
          {view.auditSummary.map((entry) => (
            <li key={entry.id} className={`audit__entry audit__entry--${entry.category}`}>
              <time>{new Date(entry.atMs).toLocaleTimeString('de-DE')}</time>
              <span className="audit__role">{entry.actorRole}</span>
              <span>{entry.message}</span>
            </li>
          ))}
        </ol>
      </details>
    </section>
  )
}
