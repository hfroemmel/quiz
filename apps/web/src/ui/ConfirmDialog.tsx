/**
 * Rueckfrage vor einer Handlung, die sich nicht zuruecknehmen laesst.
 *
 * Bewusst kein `confirm()` des Browsers: Das steht ausserhalb der Anwendung,
 * traegt deren Gestaltung nicht und sieht auf einem Veranstaltungsrechner aus
 * wie ein Fehler. Dieser Dialog liegt im Fenster, folgt dem Farbsystem und
 * benennt die Folge der Handlung.
 *
 * Bedienung: `Escape` bricht ab, der Fokus liegt beim Oeffnen auf der
 * Abbrechen-Taste - die gefaehrliche Handlung ist nie versehentlich ausloesbar.
 */
import { useEffect, useRef } from 'react'

interface ConfirmDialogProps {
  title: string
  /** Was passiert, wenn bestaetigt wird. Klartext, keine Warnfloskel. */
  message: string
  confirmLabel: string
  cancelLabel?: string
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  title,
  message,
  confirmLabel,
  cancelLabel = 'Abbrechen',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    cancelRef.current?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel])

  return (
    <div className="dialog-backdrop" role="presentation" onClick={onCancel}>
      <div
        className="dialog"
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
      >
        <h2 className="dialog__title">{title}</h2>
        <p className="dialog__message">{message}</p>
        <div className="dialog__actions">
          <button ref={cancelRef} className="button" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button className="button button--primary" onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
