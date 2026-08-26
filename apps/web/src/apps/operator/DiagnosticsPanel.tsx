/**
 * Diagnose und Protokoll fuer den Operator (Spezifikation 29).
 *
 * Enthaelt Paketversion, Veranstaltungstag, Session-Code fuer den Moderator,
 * verbundene Clients, Warnungen in klarer Sprache und das Auditlog. Moderatoraktionen
 * erscheinen hier ebenfalls, damit der Operator sie unmittelbar sieht.
 */
import { useState } from 'react'
import type { Command, OperatorQuizViewModel } from '@quiz/contracts'
import { ConfirmDialog } from '../../ui/ConfirmDialog'
import styles from './DiagnosticsPanel.module.css'

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
    <section className={`${styles.diagnostics} ${styles.compact}`}>
      <details>
        <summary data-diagnostics-summary="">Technik, Protokoll und Verbindung</summary>

        <dl className={styles.facts} data-diagnostics-facts="">
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
            <dd className={styles.code}>{diagnostics.sessionCode ?? '-'}</dd>
          </div>
          <div>
            <dt>Verbundene Clients</dt>
            <dd data-connected-clients="">{connectedClients}</dd>
          </div>
          {/* Haeufigste Tonfrage im Betrieb: "Warum hoere ich nichts?" */}
          <div>
            <dt>Tonausgabe</dt>
            <dd data-audio-master={audioMaster}>{audioMaster ? 'dieses Fenster' : 'Bühnenfenster'}</dd>
          </div>
        </dl>

        {diagnostics.lanUrls && diagnostics.lanUrls.length > 0 && (
          <p className={styles.lan}>
            Moderatoransicht im Netzwerk: {diagnostics.lanUrls.map((url) => `${url}/moderator`).join(', ')}
          </p>
        )}

        {diagnostics.selectionRationale && (
          <p className={styles.rationale}>Fragenauswahl: {diagnostics.selectionRationale}</p>
        )}

        {diagnostics.warnings.length > 0 && (
          <ul className={styles.warnings}>
            {diagnostics.warnings.map((warning, index) => (
              <li key={index}>{warning}</li>
            ))}
          </ul>
        )}

        <div className={styles.actions}>
          <a className="button" href="/api/export/changes" target="_blank" rel="noreferrer">
            Änderungsbericht exportieren
          </a>
          {view.allowedCommands.includes('START_NEW_EVENT_DAY') && (
            <button className="button button--technical" onClick={() => setConfirmNewDay(true)}>
              Neuen Veranstaltungstag beginnen
            </button>
          )}
        </div>

        <h3 className={styles.title}>Protokoll</h3>
        <ol className={styles.audit}>
          {view.auditSummary.map((entry) => (
            <li key={entry.id} className={`${styles.entry} ${entry.category === 'score' ? styles.entryScore : entry.category === 'buzzer' ? styles.entryBuzzer : ''}`}>
              <time>{new Date(entry.atMs).toLocaleTimeString('de-DE')}</time>
              <span className={styles.role}>{entry.actorRole}</span>
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
