/**
 * Spielprotokoll: wie viele Spiele je Quizmodus bereits gelaufen sind.
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
import { Dialog } from '../../ui/Dialog.tsx'
import type { Command, GameStatisticsViewModel } from '@quiz/contracts'

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

  const total = statistics.modes.reduce((sum, mode) => sum + mode.total, 0)

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
      <table className="game-log">
        <thead>
          <tr>
            <th>Modus</th>
            <th className="game-log__number">Spiele</th>
            <th className="game-log__number">beendet</th>
            <th className="game-log__number">abgebrochen</th>
            <th className="game-log__when">zuletzt</th>
          </tr>
        </thead>
        <tbody>
          {statistics.modes.map((mode) => (
            <tr key={mode.quizModeId}>
              <td>{mode.label}</td>
              <td className="game-log__number">{mode.total}</td>
              <td className="game-log__number">{mode.completed}</td>
              <td className="game-log__number">{mode.aborted}</td>
              <td className="game-log__when">{formatDate(mode.lastPlayedIso)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td>Gesamt</td>
            <td className="game-log__number">{total}</td>
            <td className="game-log__number">
              {statistics.modes.reduce((sum, mode) => sum + mode.completed, 0)}
            </td>
            <td className="game-log__number">{statistics.modes.reduce((sum, mode) => sum + mode.aborted, 0)}</td>
            <td />
          </tr>
        </tfoot>
      </table>

      <p className="dialog__note">
        {statistics.countingSinceIso
          ? `Gezählt seit ${formatDate(statistics.countingSinceIso)}.`
          : 'Gezählt seit der ersten Inbetriebnahme.'}
      </p>
      {confirming && (
        <p className="dialog__note dialog__note--warning">
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
