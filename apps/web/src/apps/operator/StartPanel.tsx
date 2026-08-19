/**
 * Startansicht des Operators (Spezifikation 6.1).
 *
 * Modi und Presets kommen aus `view.catalog` und damit aus validierter Konfiguration.
 * Es gibt hier bewusst keine fest verdrahteten Listen wie "Erwachsene/Kinder/leicht" -
 * ein neuer Modus erscheint automatisch, sobald er konfiguriert ist.
 */
import { useEffect, useState } from 'react'
import { ConfirmDialog } from '../../ui/ConfirmDialog.tsx'
import type { Command, OperatorQuizViewModel } from '@quiz/contracts'

export function StartPanel({ view, send }: { view: OperatorQuizViewModel; send: (command: Command) => void }) {
  const catalog = view.catalog
  const [modeId, setModeId] = useState(catalog.modes[0]?.id ?? '')
  const mode = catalog.modes.find((entry) => entry.id === modeId) ?? catalog.modes[0]
  const allowedPresets = catalog.presets.filter((preset) => mode?.allowedPresetIds.includes(preset.id))
  const [presetId, setPresetId] = useState(allowedPresets[0]?.id ?? '')
  const [playerOne, setPlayerOne] = useState('Spieler 1')
  const [playerTwo, setPlayerTwo] = useState('Spieler 2')
  const [confirmDiscard, setConfirmDiscard] = useState(false)

  // Beim Moduswechsel auf ein erlaubtes Preset zurueckfallen.
  useEffect(() => {
    if (!allowedPresets.some((preset) => preset.id === presetId)) {
      setPresetId(allowedPresets[0]?.id ?? '')
    }
  }, [allowedPresets, presetId])

  const canStart = view.allowedCommands.includes('START_GAME') && modeId && presetId

  return (
    <div className="start-panel">
      {view.resumable && (
        <section className="resume" role="status">
          <h2>Unterbrochenes Spiel gefunden</h2>
          <p>
            Modus {view.resumable.quizModeId}, Preset {view.resumable.presetId}, Stand: {view.resumable.progress}.
            Eine laufende Bildenthüllung wurde sicherheitshalber pausiert wiederhergestellt.
          </p>
          <div className="controls__row">
            <button className="button button--primary" onClick={() => send({ type: 'RESUME_GAME' })}>
              Spiel fortsetzen
            </button>
            <button
              className="button button--technical"
              onClick={() => setConfirmDiscard(true)}
            >
              Verwerfen
            </button>
          </div>
        </section>
      )}

      <section className="start-panel__form">
        <h2>Neues Spiel</h2>

        <label className="field">
          <span>Quizmodus</span>
          <select value={modeId} onChange={(event) => setModeId(event.target.value)}>
            {catalog.modes.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.label}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>Schwierigkeits-Preset</span>
          <select value={presetId} onChange={(event) => setPresetId(event.target.value)}>
            {allowedPresets.map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.label} ({preset.slotCount} Fragen)
              </option>
            ))}
          </select>
        </label>

        <div className="field-row">
          <label className="field">
            <span>Spieler 1</span>
            <input value={playerOne} onChange={(event) => setPlayerOne(event.target.value)} maxLength={24} />
          </label>
          <label className="field">
            <span>Spieler 2</span>
            <input value={playerTwo} onChange={(event) => setPlayerTwo(event.target.value)} maxLength={24} />
          </label>
        </div>

        <button
          className="button button--large button--primary"
          disabled={!canStart}
          onClick={() =>
            send({
              type: 'START_GAME',
              quizModeId: modeId,
              presetId,
              playerLabels: [playerOne.trim() || 'Spieler 1', playerTwo.trim() || 'Spieler 2'],
            })
          }
        >
          Spiel starten
        </button>
      </section>
      {confirmDiscard && (
        <ConfirmDialog
          title="Unterbrochenes Spiel verwerfen"
          message="Der gespeicherte Spielstand wird gelöscht. Es wird kein Ergebnis angezeigt; die bereits gespielten Fragen bleiben in der Wiederholungshistorie."
          confirmLabel="Verwerfen"
          onConfirm={() => {
            send({ type: 'DISCARD_RESUMABLE_GAME' })
            setConfirmDiscard(false)
          }}
          onCancel={() => setConfirmDiscard(false)}
        />
      )}
    </div>
  )
}
