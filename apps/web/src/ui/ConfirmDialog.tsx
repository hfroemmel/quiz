/**
 * Rueckfrage vor einer Handlung, die sich nicht zuruecknehmen laesst.
 *
 * Der Fokus liegt beim Oeffnen auf `Abbrechen` - es steht als erste Taste in der
 * Fussleiste, und `Dialog` fokussiert genau diese. Die gefaehrliche Handlung ist
 * damit nie versehentlich mit der Eingabetaste ausloesbar.
 */
import { Dialog } from './Dialog.tsx'

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
  return (
    <Dialog
      title={title}
      role="alertdialog"
      onClose={onCancel}
      actions={
        <>
          <button className="button" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button className="button button--primary" onClick={onConfirm}>
            {confirmLabel}
          </button>
        </>
      }
    >
      <p className="dialog__message">{message}</p>
    </Dialog>
  )
}
