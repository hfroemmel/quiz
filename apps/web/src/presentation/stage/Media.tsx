/**
 * Bildrahmen der Buehne - EIN Bauteil fuer beide Gestaltungswelten.
 *
 * Zwei Aufgaben: das Bild im richtigen Verhaeltnis zeigen und - beim
 * Bilderkennen - die Schaerfe aus dem Enthuellungsfortschritt uebernehmen.
 *
 * Die Unschaerfe kommt als fertiger Wert herein. Dieses Bauteil rechnet nichts
 * aus; die Ableitung steht in der Domain und gilt fuer Ring und Bild gemeinsam.
 *
 * Das Foto liegt INNERHALB des Rahmens, nie in einer Rahmengrafik: Es wechselt
 * mit jeder Frage, der Rahmen nie.
 */
import styles from './Media.module.css'

interface MediaProps {
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
}

export function Media({ src, blurPx, variant = 'inline' }: MediaProps) {
  if (!src) return null
  return (
    <div className={`${styles.media} ${styles[variant]}`} data-media="" data-variant={variant}>
      <img
        className={styles.image}
        data-media-image=""
        src={src}
        alt=""
        style={blurPx === undefined ? undefined : { filter: `blur(${blurPx.toFixed(2)}px)` }}
      />
      {/*
        * Platz fuer eine Figur, die ueber die obere Bildkante schaut. Reine
        * Dekoration: Ob dort etwas zu sehen ist, entscheidet die Gestaltungswelt
        * im Stylesheet - im Markup steht kein Modusname.
        */}
      <span className={styles.peek} data-peek="" aria-hidden="true" />
    </div>
  )
}
