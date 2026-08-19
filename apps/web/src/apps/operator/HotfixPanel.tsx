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
import { useEffect, useState } from 'react'
import { ConfirmDialog } from '../../ui/ConfirmDialog.tsx'
import { optionLetter } from '../../ui/OptionBar.tsx'
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
  const editable = view.editableQuestion
  const [open, setOpen] = useState(false)
  const [prompt, setPrompt] = useState('')
  const [optionTexts, setOptionTexts] = useState<Record<string, string>>({})
  const [reason, setReason] = useState('')
  const [immediate, setImmediate] = useState(false)
  const [confirmDisable, setConfirmDisable] = useState(false)

  /*
   * Beim Fragenwechsel werden die Felder geleert. Sonst stuende die Korrektur der
   * vorigen Frage im Formular und liesse sich versehentlich auf die neue anwenden.
   */
  useEffect(() => {
    setPrompt('')
    setOptionTexts({})
  }, [questionId])

  /** Nur tatsaechlich geaenderte Felder werden gepatcht. */
  const editedOptions = (editable?.options ?? [])
    .map((option) => ({ id: option.id, text: (optionTexts[option.id] ?? option.text).trim() }))
    .filter((option) => option.text.length > 0)
  const optionsChanged =
    editedOptions.length === (editable?.options.length ?? 0) &&
    editedOptions.some((option, index) => option.text !== editable?.options[index]?.text)
  const promptChanged = prompt.trim().length > 0 && prompt.trim() !== editable?.prompt
  const hasChanges = promptChanged || optionsChanged

  const canPatch = view.allowedCommands.includes('APPLY_QUESTION_PATCH') && Boolean(questionId)
  const canSkip = view.allowedCommands.includes('SKIP_QUESTION')
  if (!canPatch && !canSkip) return null

  const applyMode = immediate ? 'immediate-confirmed' : 'next-use'

  return (
    <section className="hotfix">
      <button type="button" className="button button--technical" onClick={() => setOpen((value) => !value)}>
        {open ? 'Fragenkorrektur schließen' : 'Fehlerhafte Frage korrigieren'}
      </button>

      {open && (
        <div className="hotfix__body">
          <p className="hotfix__note">
            Aenderungen werden als lokaler Hotfix gespeichert. Das Basispaket bleibt unverändert.
          </p>

          <div className="controls__row">
            {canSkip && (
              <button
                className="button"
                onClick={() => send({ type: 'SKIP_QUESTION', reason: reason || 'Operator hat übersprungen' })}
              >
                Frage überspringen
              </button>
            )}
            {canPatch && (
              <button
                className="button button--technical"
                disabled={!questionId}
                onClick={() => setConfirmDisable(true)}
              >
                Frage deaktivieren
              </button>
            )}
          </div>

          {canPatch && (
            <>
              <label className="field">
                <span>Fragetext</span>
                <textarea
                  rows={3}
                  value={prompt || (editable?.prompt ?? '')}
                  onChange={(event) => setPrompt(event.target.value)}
                />
              </label>

              {editable && editable.options.length > 0 && (
                <div className="field">
                  <span>Antwortmöglichkeiten</span>
                  {editable.options.map((option, index) => (
                    <label key={option.id} className="hotfix__option">
                      <span className="hotfix__option-marker">
                        {optionLetter(index)}
                        {option.id === editable.correctOptionId && (
                          <em className="hotfix__option-correct" title="richtige Antwort">
                            ✓
                          </em>
                        )}
                      </span>
                      <input
                        value={optionTexts[option.id] ?? option.text}
                        onChange={(event) =>
                          setOptionTexts((current) => ({ ...current, [option.id]: event.target.value }))
                        }
                      />
                    </label>
                  ))}
                </div>
              )}
              <label className="field">
                <span>Grund (wird protokolliert)</span>
                <input value={reason} onChange={(event) => setReason(event.target.value)} />
              </label>
              <label className="field field--checkbox">
                <input type="checkbox" checked={immediate} onChange={(event) => setImmediate(event.target.checked)} />
                <span>Jetzt übernehmen (auch auf dem laufenden Bühnenscreen)</span>
              </label>
              <button
                className="button button--primary"
                disabled={!hasChanges || !questionId}
                onClick={() => {
                  if (!questionId) return
                  send({
                    type: 'APPLY_QUESTION_PATCH',
                    questionId,
                    changes: {
                      ...(promptChanged ? { prompt: prompt.trim() } : {}),
                      ...(optionsChanged ? { options: editedOptions } : {}),
                    },
                    reason: reason || 'Textkorrektur',
                    applyMode,
                  })
                  setPrompt('')
                  setOptionTexts({})
                }}
              >
                Korrektur speichern
              </button>
            </>
          )}
        </div>
      )}
      {confirmDisable && questionId && (
        <ConfirmDialog
          title="Frage deaktivieren"
          message="Die Frage wird für den Rest der Veranstaltung nicht mehr gezogen. Das Basispaket bleibt unverändert; die Änderung steht im Änderungsbericht."
          confirmLabel="Deaktivieren"
          onConfirm={() => {
            send({
              type: 'APPLY_QUESTION_PATCH',
              questionId,
              changes: { enabled: false },
              reason: reason || 'Frage fehlerhaft',
              applyMode: 'next-use',
            })
            setConfirmDisable(false)
          }}
          onCancel={() => setConfirmDisable(false)}
        />
      )}
    </section>
  )
}
