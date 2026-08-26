/**
 * Startansicht des Operators (Spezifikation 6.1).
 *
 * Zielgruppen, Pools und Presets kommen aus `view.catalog` und damit aus
 * validierter Konfiguration. Es gibt hier bewusst keine fest verdrahteten Listen
 * wie "Erwachsene/Kinder/leicht" - eine neue Zielgruppe oder ein neuer Pool
 * erscheint automatisch, sobald er konfiguriert ist.
 */
import { useEffect, useState } from 'react'
import { ConfirmDialog } from '../../ui/ConfirmDialog'
import type { Command, OperatorQuizViewModel } from '@hfroemmel/quiz-core'
import shell from './OperatorApp.module.css'
import styles from './StartPanel.module.css'

export function StartPanel({ view, send }: { view: OperatorQuizViewModel; send: (command: Command) => void }) {
  const catalog = view.catalog
  const [audience, setAudience] = useState(catalog.audiences[0]?.id ?? '')
  const audienceEntry = catalog.audiences.find((entry) => entry.id === audience) ?? catalog.audiences[0]
  const allowedPresets = catalog.presets.filter((preset) => audienceEntry?.allowedPresetIds.includes(preset.id))
  const [presetId, setPresetId] = useState(allowedPresets[0]?.id ?? '')
  /** Leer = keine Einschraenkung, alle Pools spielen mit. */
  const [poolId, setPoolId] = useState('')
  const [confirmDiscard, setConfirmDiscard] = useState(false)

  // Beim Zielgruppenwechsel auf ein erlaubtes Preset zurueckfallen.
  useEffect(() => {
    if (!allowedPresets.some((preset) => preset.id === presetId)) {
      setPresetId(allowedPresets[0]?.id ?? '')
    }
  }, [allowedPresets, presetId])

  const canStart = view.allowedCommands.includes('START_GAME') && audience && presetId

  return (
    <div className={shell.startArea} data-start-panel="">
      {view.resumable && (
        <section className={styles.resume} role="status">
          <h2>Unterbrochenes Spiel gefunden</h2>
          <p>
            Zielgruppe {view.resumable.audience}, Preset {view.resumable.presetId}, Stand: {view.resumable.progress}.
            Eine laufende Bildenthüllung wurde sicherheitshalber pausiert wiederhergestellt.
          </p>
          <div className={styles.buttonRow}>
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

      <section className={styles.form} data-start-form="">
        <h2>Neues Spiel</h2>

        <label className="field">
          <span>Zielgruppe</span>
          <select value={audience} onChange={(event) => setAudience(event.target.value)}>
            {catalog.audiences.map((entry) => (
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

        {/*
          * Der Pool ist eine INHALTSAUSWAHL, keine Spielregel: "Saarbruecken"
          * ist genau so ein Pool. Ohne Auswahl spielen alle Pools mit - das ist
          * der Normalfall der Buehne.
          */}
        {catalog.pools.length > 1 && (
          <label className="field">
            <span>Fragenpool</span>
            <select value={poolId} onChange={(event) => setPoolId(event.target.value)} data-pool-select="">
              <option value="">Alle Pools</option>
              {catalog.pools.map((pool) => (
                <option key={pool.id} value={pool.id}>
                  {pool.label}
                </option>
              ))}
            </select>
          </label>
        )}

        <button
          className="button button--large button--primary"
          disabled={!canStart}
          onClick={() =>
            send({ type: 'START_GAME', audience, presetId, ...(poolId ? { poolIds: [poolId] } : {}) })
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
