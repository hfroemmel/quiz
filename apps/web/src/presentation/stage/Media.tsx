/**
 * Bildrahmen der Buehne - EIN Bauteil fuer beide Gestaltungswelten.
 *
 * Zwei Aufgaben: das Bild im richtigen Verhaeltnis zeigen und - beim
 * Bilderkennen - die Kacheldecke darueber halten, die es Stueck fuer Stueck
 * freigibt.
 *
 * Der Fortschritt kommt als fertiger Wert herein. Dieses Bauteil rechnet nichts
 * aus; die Ableitung steht in der Domain und gilt fuer Ring und Bild gemeinsam.
 *
 * Das Foto liegt INNERHALB des Rahmens, nie in einer Rahmengrafik: Es wechselt
 * mit jeder Frage, der Rahmen nie.
 */
import type { RevealGrid } from '@quiz/contracts'
import { RevealTiles } from './RevealTiles.tsx'
import styles from './Media.module.css'

interface MediaProps {
  src?: string
  /**
   * Nur beim Bilderkennen: Raster und Fortschritt der Aufloesung.
   *
   * Fehlt der Wert, liegt keine Decke ueber dem Bild - jede andere Szene zeigt
   * ihr Foto offen.
   */
  reveal?: { grid: RevealGrid; progress: number }
  variant?: 'inline' | 'reveal' | 'solution' | 'portrait'
}

export function Media({ src, reveal, variant = 'inline' }: MediaProps) {
  if (!src) return null
  return (
    <div className={`${styles.media} ${styles[variant]}`} data-media="" data-variant={variant}>
      {/*
        * Die Bildflaeche als eigene Ebene: Sie ist genau so gross wie das Foto,
        * also OHNE den Innenabstand, den die Kinderwelt fuer ihre gezeichnete
        * Rahmung braucht. Nur so liegt die Kacheldecke auf dem Bild und nicht
        * ueber der Zeichnung.
        */}
      <div className={styles.canvas}>
        <img className={styles.image} data-media-image="" src={src} alt="" />
        {reveal && <RevealTiles grid={reveal.grid} progress={reveal.progress} seedSource={src} />}
      </div>
      {/*
        * Platz fuer eine Figur, die ueber die obere Bildkante schaut. Reine
        * Dekoration: Ob dort etwas zu sehen ist, entscheidet die Gestaltungswelt
        * im Stylesheet - im Markup steht kein Modusname.
        */}
      <span className={styles.peek} data-peek="" aria-hidden="true" />
    </div>
  )
}
