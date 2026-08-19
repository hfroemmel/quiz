/**
 * Diagnose und Protokoll fuer den Operator (Spezifikation 29).
 *
 * Enthaelt Paketversion, Veranstaltungstag, Session-Code fuer den Moderator,
 * verbundene Clients, Warnungen in klarer Sprache und das Auditlog. Moderatoraktionen
 * erscheinen hier ebenfalls, damit der Operator sie unmittelbar sieht.
 */
import { useState } from 'react'
import type { Command, OperatorQuizViewModel } from '@quiz/contracts'
import { ConfirmDialog } from '../../ui/ConfirmDialog.tsx'

export function DiagnosticsPanel({
  view,
  send,
  connectedClients,
  audioMaster,
}: {
  view: OperatorQuizViewModel
  send: (command: Command) => void
  connectedClients: number
  /** Ob dieses Fenster gerade den Ton ausgibt - der Server entscheidet das. */
  audioMaster: boolean
}) {
  const diagnostics = view.diagnostics
  const [confirmNewDay, setConfirmNewDay] = useState(false)

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
          {/* Haeufigste Tonfrage im Betrieb: "Warum hoere ich nichts?" */}
          <div>
            <dt>Tonausgabe</dt>
            <dd data-audio-master={audioMaster}>{audioMaster ? 'dieses Fenster' : 'Bühnenfenster'}</dd>
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
            Änderungsbericht exportieren
          </a>
          {view.allowedCommands.includes('START_NEW_EVENT_DAY') && (
            <button className="button button--technical" onClick={() => setConfirmNewDay(true)}>
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
      {confirmNewDay && (
        <ConfirmDialog
          title="Neuen Veranstaltungstag beginnen"
          message="Die Wiederholungshistorie startet neu. Fragen der bisherigen Spiele können danach wieder gezogen werden."
          confirmLabel="Neuen Tag beginnen"
          onConfirm={() => {
            send({ type: 'START_NEW_EVENT_DAY' })
            setConfirmNewDay(false)
          }}
          onCancel={() => setConfirmNewDay(false)}
        />
      )}
    </section>
  )
}
