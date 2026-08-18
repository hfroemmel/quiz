/**
 * Bildrahmen der Buehne.
 *
 * Zwei Aufgaben: das Bild im richtigen Verhaeltnis zeigen und - beim
 * Bilderkennen - die Schaerfe aus dem Enthuellungsfortschritt uebernehmen.
 *
 * Die Unschaerfe kommt als fertiger Wert herein. Dieses Bauteil rechnet nichts
 * aus; die Ableitung steht in der Domain und gilt fuer Ring und Bild gemeinsam.
 */
interface MediaFrameProps {
  src?: string
  /**
   * Unschaerfe in Bildpunkten; 0 bedeutet scharf.
   *
   * Wird der Wert uebergeben, steht er auch bei 0 im Stil. So ist an jedem
   * Bild ablesbar, ob es aus der Enthuellung stammt - das pruefen die Tests,
   * die Ring und Schaerfe gegeneinander halten.
   */
  blurPx?: number
  variant?: 'inline' | 'reveal' | 'solution'
  className?: string
}

export function MediaFrame({ src, blurPx, variant = 'inline', className }: MediaFrameProps) {
  if (!src) return null
  return (
    <div className={['media-frame', `media-frame--${variant}`, className].filter(Boolean).join(' ')}>
      <img
        className="media-frame__image"
        src={src}
        alt=""
        style={blurPx === undefined ? undefined : { filter: `blur(${blurPx.toFixed(2)}px)` }}
      />
    </div>
  )
}
