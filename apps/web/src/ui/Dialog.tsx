/**
 * Grundgeruest aller Popups der Anwendung.
 *
 * Bewusst kein `confirm()` oder `alert()` des Browsers: Das steht ausserhalb der
 * Anwendung, traegt deren Gestaltung nicht und sieht auf einem
 * Veranstaltungsrechner aus wie ein Fehler.
 *
 * Bedienung an einer Stelle: `Escape` schliesst, ein Klick auf den Hintergrund
 * schliesst, der Fokus liegt beim Oeffnen auf der ersten Taste der Fussleiste.
 * Jeder konkrete Dialog fuellt nur noch Inhalt und Tasten.
 */
import { useEffect, useRef, type ReactNode } from 'react'

interface DialogProps {
  title: string
  onClose: () => void
  /** `alertdialog` fuer Rueckfragen vor nicht umkehrbaren Handlungen. */
  role?: 'dialog' | 'alertdialog'
  children: ReactNode
  actions: ReactNode
}

export function Dialog({ title, onClose, role = 'dialog', children, actions }: DialogProps) {
  const actionsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    actionsRef.current?.querySelector('button')?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="dialog-backdrop" role="presentation" onClick={onClose}>
      <div className="dialog" role={role} aria-modal="true" aria-label={title} onClick={(event) => event.stopPropagation()}>
        <h2 className="dialog__title">{title}</h2>
        {children}
        <div className="dialog__actions" ref={actionsRef}>
          {actions}
        </div>
      </div>
    </div>
  )
}
