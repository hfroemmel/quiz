/**
 * Gezeichnete Flaeche hinter beliebigem Inhalt.
 *
 * Die Konturen des Kinderquiz sind GEZEICHNET, nicht gerechnet: Jede Karte ist
 * ein SVG mit ungleichmaessigen Linien. Ein CSS-`border` waere eine perfekte
 * Linie und wuerde die Handschrift der Illustration zerstoeren - deshalb gibt es
 * in dieser Welt keine Rahmen, sondern nur diese Komponente.
 *
 * Das SVG liegt als Pseudoelement HINTER dem Inhalt (`z-index: -1`) und wird auf
 * `100% 100%` gezogen. Alle Flaechen des Pakets tragen `preserveAspectRatio="none"`
 * und nicht skalierende Strichstaerken; die Karte darf deshalb mit ihrem Inhalt
 * wachsen, ohne dass die Zeichnung verzerrt aussieht.
 */
import type { CSSProperties, ElementType, ReactNode } from 'react'

interface KidsSurfaceProps {
  /** Adresse des Flaechen-SVG aus `kidsAssets`. */
  image: string
  className?: string
  /** Standard ist `div`; Listeneintraege setzen hier `li`. */
  as?: ElementType
  style?: CSSProperties
  children?: ReactNode
  /** Zusaetzliche Datenattribute fuer Zustaende und Tests. */
  [key: `data-${string}`]: string | undefined
}

export function KidsSurface({ image, className, as, style, children, ...rest }: KidsSurfaceProps) {
  const Tag = (as ?? 'div') as ElementType
  return (
    <Tag
      className={['kids-surface', className].filter(Boolean).join(' ')}
      style={{ ...style, ['--kids-surface' as string]: `url(${image})` }}
      {...rest}
    >
      {children}
    </Tag>
  )
}
