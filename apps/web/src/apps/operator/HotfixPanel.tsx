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
  /** `null` heisst "nicht angefasst"; dann gilt die richtige Antwort des Pakets. */
  const [correctId, setCorrectId] = useState<string | null>(null)
  /** Freie Antwort - dasselbe Prinzip: leer heisst "unveraendert". */
  const [answerText, setAnswerText] = useState('')
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
    setCorrectId(null)
    setAnswerText('')
  }, [questionId])

  /** Nur tatsaechlich geaenderte Felder werden gepatcht. */
  const editedOptions = (editable?.options ?? [])
    .map((option) => ({ id: option.id, text: (optionTexts[option.id] ?? option.text).trim() }))
    .filter((option) => option.text.length > 0)
  const optionsChanged =
    editedOptions.length === (editable?.options.length ?? 0) &&
    editedOptions.some((option, index) => option.text !== editable?.options[index]?.text)
  const promptChanged = prompt.trim().length > 0 && prompt.trim() !== editable?.prompt
  /*
   * Welche Option richtig ist, steht als Verweis in `correctOptionId` - nie als
   * Reihenfolge oder Markierung im Text. Der Radiobutton setzt genau diesen Verweis.
   */
  const selectedCorrectId = correctId ?? editable?.correctOptionId
  const correctChanged = Boolean(correctId) && correctId !== editable?.correctOptionId

  /*
   * Fragen ohne Auswahl - Bilderkennen und jede andere freie Antwort - haben
   * keine Optionen und damit auch keinen Radiobutton. Ihre richtige Antwort steht
   * in `acceptedAnswerText`; die erste Formulierung ist die, die auf der Buehne
   * erscheint. Weitere werden mit Semikolon getrennt, damit der Moderator
   * Alternativen behalten kann.
   */
  const hasOptions = (editable?.options.length ?? 0) > 0
  const acceptedFromPackage = (editable?.acceptedAnswerText ?? []).join('; ')
  const acceptedEntries = answerText
    .split(';')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
  const answerChanged = answerText.trim().length > 0 && answerText.trim() !== acceptedFromPackage && acceptedEntries.length > 0

  const hasChanges = promptChanged || optionsChanged || correctChanged || answerChanged

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
                    <div key={option.id} className="hotfix__option">
                      <span className="hotfix__option-marker">{optionLetter(index)}</span>
                      <input
                        className="hotfix__option-text"
                        aria-label={`Antwort ${optionLetter(index)}`}
                        value={optionTexts[option.id] ?? option.text}
                        onChange={(event) =>
                          setOptionTexts((current) => ({ ...current, [option.id]: event.target.value }))
                        }
                      />
                      <input
                        type="radio"
                        className="hotfix__option-correct"
                        name="hotfix-correct-option"
                        title="als richtige Antwort markieren"
                        aria-label={`Antwort ${optionLetter(index)} ist richtig`}
                        checked={selectedCorrectId === option.id}
                        onChange={() => setCorrectId(option.id)}
                      />
                    </div>
                  ))}
                </div>
              )}
              {editable && !hasOptions && (
                <label className="field">
                  <span>Richtige Antwort (mehrere Formulierungen mit Semikolon trennen)</span>
                  <input
                    value={answerText || acceptedFromPackage}
                    onChange={(event) => setAnswerText(event.target.value)}
                  />
                </label>
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
                      ...(correctChanged && correctId ? { correctOptionId: correctId } : {}),
                      ...(answerChanged ? { acceptedAnswerText: acceptedEntries } : {}),
                    },
                    reason: reason || 'Textkorrektur',
                    applyMode,
                  })
                  setPrompt('')
                  setOptionTexts({})
                  setCorrectId(null)
                  setAnswerText('')
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
