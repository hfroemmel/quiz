/**
 * Spielprotokoll: wie viele Spiele je Zielgruppe bereits gelaufen sind.
 *
 * Die Zahlen kommen aus der Datenbank des Servers, nicht aus dem Browser. Sie
 * ueberleben deshalb das Schliessen des Fensters, einen Neustart der Anwendung
 * und einen Wechsel des Bediengeraets.
 *
 * ZURUECKSETZEN heisst: Die ZAEHLUNG beginnt neu. Die Spiele selbst bleiben in
 * der Datenbank - an ihnen haengen Spielstaende, Versuche und Auditlog. Der
 * Dialog sagt das ausdruecklich, damit niemand ein Loeschen erwartet.
 */
import { useState } from 'react'
import { Dialog } from '../../ui/Dialog'
import type { Command, GameStatisticsViewModel } from '@hfroemmel/quiz-core'
import styles from '../../ui/Dialog.module.css'
import log from './GameLogDialog.module.css'

export function GameLogDialog({
  statistics,
  canReset,
  send,
  onClose,
}: {
  statistics: GameStatisticsViewModel
  canReset: boolean
  send: (command: Command) => void
  onClose: () => void
}) {
  // Zweistufig statt zweiter Dialog: ein Popup ueber dem Popup waere unbedienbar.
  const [confirming, setConfirming] = useState(false)

  const total = statistics.audiences.reduce((sum, entry) => sum + entry.total, 0)

  return (
    <Dialog
      title="Spielprotokoll"
      onClose={onClose}
      actions={
        <>
          <button className="button" onClick={onClose}>
            Schließen
          </button>
          {canReset &&
            (confirming ? (
              <button
                className="button button--primary"
                onClick={() => {
                  send({ type: 'RESET_GAME_STATISTICS' })
                  setConfirming(false)
                }}
              >
                Wirklich zurücksetzen
              </button>
            ) : (
              <button className="button" disabled={total === 0} onClick={() => setConfirming(true)}>
                Protokoll zurücksetzen
              </button>
            ))}
        </>
      }
    >
      <table className={log.table} data-game-log="">
        <thead>
          <tr>
            <th>Zielgruppe</th>
            <th className={log.number}>Spiele</th>
            <th className={log.number}>beendet</th>
            <th className={log.number}>abgebrochen</th>
            <th className={log.when}>zuletzt</th>
          </tr>
        </thead>
        <tbody>
          {statistics.audiences.map((entry) => (
            <tr key={entry.audience}>
              <td>{entry.label}</td>
              <td className={log.number}>{entry.total}</td>
              <td className={log.number}>{entry.completed}</td>
              <td className={log.number}>{entry.aborted}</td>
              <td className={log.when}>{formatDate(entry.lastPlayedIso)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td>Gesamt</td>
            <td className={log.number}>{total}</td>
            <td className={log.number}>
              {statistics.audiences.reduce((sum, entry) => sum + entry.completed, 0)}
            </td>
            <td className={log.number}>{statistics.audiences.reduce((sum, entry) => sum + entry.aborted, 0)}</td>
            <td />
          </tr>
        </tfoot>
      </table>

      <p className={styles.note}>
        {statistics.countingSinceIso
          ? `Gezählt seit ${formatDate(statistics.countingSinceIso)}.`
          : 'Gezählt seit der ersten Inbetriebnahme.'}
      </p>
      {confirming && (
        <p className={`${styles.note} ${styles.noteWarning}`}>
          Die Zählung beginnt neu. Die gespielten Spiele bleiben mit Punktestand und Protokoll in der Datenbank.
        </p>
      )}
    </Dialog>
  )
}

/** Datum und Uhrzeit in deutscher Schreibweise; ohne Wert bleibt ein Strich. */
function formatDate(iso: string | undefined): string {
  if (!iso) return '–'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '–'
  return date.toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })
}
