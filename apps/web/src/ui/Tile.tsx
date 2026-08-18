/**
 * Kachel mit kleiner Beschriftung und grossem Wert.
 *
 * Sie traegt im Entwurf drei Aussagen: Spieler, Punkte und Fragezaehler - und in
 * der Ergebnisansicht dieselben Werte in gross. Deshalb gibt es genau ein
 * Bauteil mit Varianten statt drei aehnlicher Komponenten.
 *
 * Das Bauteil kennt nur Tokens und seine Varianten. Es liest kein View-Modell
 * und sendet keine Befehle.
 */
import type { ReactNode } from 'react'

export type TileTone = 'default' | 'active' | 'quiet'
export type TileSize = 'header' | 'result'

interface TileProps {
  label: string
  value: ReactNode
  tone?: TileTone
  size?: TileSize
  className?: string
}

export function Tile({ label, value, tone = 'default', size = 'header', className }: TileProps) {
  return (
    <div className={['tile', `tile--${tone}`, `tile--${size}`, className].filter(Boolean).join(' ')}>
      <span className="tile__label">{label}</span>
      <span className="tile__value">{value}</span>
    </div>
  )
}
