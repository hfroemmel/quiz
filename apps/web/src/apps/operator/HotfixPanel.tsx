/**
 * Live-Korrekturen an Fragen (Spezifikation 25).
 *
 * Das gebaute Basis-Quizpaket wird NICHT veraendert. Jede Korrektur wird als Patch
 * gespeichert, gegen dasselbe Schema geprueft und protokolliert; nach der
 * Veranstaltung laesst sich daraus ein Aenderungsbericht exportieren.
 *
 * "Erst beim naechsten Einsatz" ist der Standard. Nur mit "Jetzt uebernehmen" geht
 * eine Aenderung sofort auf den Buehnenscreen.
 */
import { useState } from 'react'
import type { Command, OperatorQuizViewModel } from '@quiz/contracts'

export function HotfixPanel({
  view,
  send,
  questionId,
}: {
  view: OperatorQuizViewModel
  send: (command: Command) => void
  questionId: string | undefined
}) {
  const [open, setOpen] = useState(false)
  const [prompt, setPrompt] = useState('')
  const [reason, setReason] = useState('')
  const [immediate, setImmediate] = useState(false)

  const canPatch = view.allowedCommands.includes('APPLY_QUESTION_PATCH') && Boolean(questionId)
  const canSkip = view.allowedCommands.includes('SKIP_QUESTION')
  if (!canPatch && !canSkip) return null

  const applyMode = immediate ? 'immediate-confirmed' : 'next-use'

  return (
    <section className="hotfix">
      <button type="button" className="button button--technical" onClick={() => setOpen((value) => !value)}>
        {open ? 'Fragenkorrektur schliessen' : 'Fehlerhafte Frage korrigieren'}
      </button>

      {open && (
        <div className="hotfix__body">
          <p className="hotfix__note">
            Aenderungen werden als lokaler Hotfix gespeichert. Das Basispaket bleibt unveraendert.
          </p>

          <div className="controls__row">
            {canSkip && (
              <button
                className="button"
                onClick={() => send({ type: 'SKIP_QUESTION', reason: reason || 'Operator hat uebersprungen' })}
              >
                Frage ueberspringen
              </button>
            )}
            {canPatch && (
              <button
                className="button button--technical"
                onClick={() => {
                  if (!questionId) return
                  if (confirm('Frage fuer den Rest der Veranstaltung deaktivieren?')) {
                    send({
                      type: 'APPLY_QUESTION_PATCH',
                      questionId,
                      changes: { enabled: false },
                      reason: reason || 'Frage fehlerhaft',
                      applyMode: 'next-use',
                    })
                  }
                }}
              >
                Frage deaktivieren
              </button>
            )}
          </div>

          {canPatch && (
            <>
              <label className="field">
                <span>Fragetext korrigieren</span>
                <textarea
                  rows={3}
                  value={prompt}
                  placeholder="Leer lassen, wenn der Text unveraendert bleibt"
                  onChange={(event) => setPrompt(event.target.value)}
                />
              </label>
              <label className="field">
                <span>Grund (wird protokolliert)</span>
                <input value={reason} onChange={(event) => setReason(event.target.value)} />
              </label>
              <label className="field field--checkbox">
                <input type="checkbox" checked={immediate} onChange={(event) => setImmediate(event.target.checked)} />
                <span>Jetzt uebernehmen (auch auf dem laufenden Buehnenscreen)</span>
              </label>
              <button
                className="button button--primary"
                disabled={!prompt.trim() || !questionId}
                onClick={() => {
                  if (!questionId) return
                  send({
                    type: 'APPLY_QUESTION_PATCH',
                    questionId,
                    changes: { prompt: prompt.trim() },
                    reason: reason || 'Textkorrektur',
                    applyMode,
                  })
                  setPrompt('')
                }}
              >
                Korrektur speichern
              </button>
            </>
          )}
        </div>
      )}
    </section>
  )
}
