/**
 * Schaltflaeche, die nur ein Symbol zeigt.
 *
 * Der Entwurf setzt Vollbild und Ton als reine Symbolschalter oben rechts. Damit
 * sie trotzdem bedienbar und vorlesbar bleiben, ist die Beschriftung verpflichtend
 * und wandert nach `aria-label` und in den Tooltip.
 *
 * Die Symbole sind Inline-SVG mit `currentColor` - keine Icon-Schriftart, keine
 * externen Dateien (docs/design-system.md).
 */
import type { ReactNode } from 'react'

interface IconButtonProps {
  label: string
  onClick: () => void
  children: ReactNode
  disabled?: boolean
  pressed?: boolean
  className?: string
}

export function IconButton({ label, onClick, children, disabled, pressed, className }: IconButtonProps) {
  return (
    <button
      type="button"
      className={['icon-button', className].filter(Boolean).join(' ')}
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={pressed}
      title={label}
    >
      {children}
    </button>
  )
}

/** Vier Eckwinkel - oeffnet den Buehnenscreen im Vollbild. */
export function FullscreenIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="M3 9V4h5M21 9V4h-5M3 15v5h5M21 15v5h-5" />
    </svg>
  )
}

/** Lautsprecher mit Schallwellen. */
export function SoundOnIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 9v6h4l5 4V5L8 9H4z" />
      <path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12" strokeLinecap="round" />
    </svg>
  )
}

/** Lautsprecher mit Schraegstrich. */
export function SoundOffIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 9v6h4l5 4V5L8 9H4z" />
      <path d="M17 9.5l4 5M21 9.5l-4 5" strokeLinecap="round" />
    </svg>
  )
}
