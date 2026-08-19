/**
 * Gezeichnete Flaeche hinter beliebigem Inhalt.
 *
 * Die Konturen des Kinderquiz sind GEZEICHNET, nicht gerechnet: Jede Karte ist
 * ein SVG mit den Originalpfaden des Entwurfs. Ein CSS-`border` waere eine
 * perfekte Linie und wuerde die Handschrift der Illustration zerstoeren -
 * deshalb gibt es in dieser Welt keine Rahmen, sondern nur diese Komponente.
 *
 * ZWEI ARTEN DER SKALIERUNG:
 *
 * Ohne `slice` wird das SVG auf `100% 100%` gezogen (fuer Zeichnungen mit
 * `preserveAspectRatio="none"` und nicht skalierenden Strichstaerken).
 *
 * Mit `slice` wird die Zeichnung per 9-Slice (`border-image`) zerlegt: Ecken
 * bleiben unverzerrt, Kanten und Mitte strecken sich. Das ist der Weg des
 * Boxen-Pakets - handgezeichnete Ecken duerfen nicht verzerrt werden. Der Wert
 * kommt aus `boxes.json` des Pakets; die Breite des Randes setzt die jeweilige
 * Komponentenklasse in `kids.css` (`--kids-slice-width`), weil sie vom
 * Groessenverhaeltnis zwischen Zeichnung und Element abhaengt.
 */
import type { CSSProperties, ElementType, ReactNode } from 'react'

interface KidsSurfaceProps {
  /** Adresse des Flaechen-SVG aus `kidsAssets`. */
  image: string
  /** 9-Slice-Wert aus `boxes.json`; fehlt er, wird die Zeichnung gestreckt. */
  slice?: number
  className?: string
  /** Standard ist `div`; Listeneintraege setzen hier `li`. */
  as?: ElementType
  style?: CSSProperties
  children?: ReactNode
  /** Zusaetzliche Datenattribute fuer Zustaende und Tests. */
  [key: `data-${string}`]: string | undefined
}

export function KidsSurface({ image, slice, className, as, style, children, ...rest }: KidsSurfaceProps) {
  const Tag = (as ?? 'div') as ElementType
  return (
    <Tag
      className={['kids-surface', slice !== undefined ? 'kids-surface--slice' : '', className].filter(Boolean).join(' ')}
      style={{
        ...style,
        ['--kids-surface' as string]: `url(${image})`,
        ...(slice !== undefined ? { ['--kids-slice' as string]: String(slice) } : {}),
      }}
      {...rest}
    >
      {children}
    </Tag>
  )
}
