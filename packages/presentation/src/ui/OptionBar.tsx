/**
 * Antwortleiste mit Buchstabenchip.
 *
 * Sie deckt alle Zustaende ab, die der Entwurf kennt: neutral, oeffentlich
 * gewaehlt, richtige Loesung, zurueckgenommene Option. Der Buchstabe entfaellt,
 * wenn es nichts zu waehlen gibt - etwa beim Bilderkennen mit freier Antwort.
 *
 * Welcher Zustand gilt, entscheidet der Aufrufer aus dem View-Modell. Dieses
 * Bauteil leitet nichts ab.
 */
export type OptionTone = 'neutral' | 'chosen' | 'solution' | 'muted'

interface OptionBarProps {
  /** Buchstabe A bis D. Fehlt er, entfaellt der Chip. */
  letter?: string
  text: string
  tone?: OptionTone
  /** Versatz der Einlaufanimation in Millisekunden. */
  delayMs?: number
  className?: string
}

export function OptionBar({ letter, text, tone = 'neutral', delayMs, className }: OptionBarProps) {
  return (
    <div
      className={['option-bar', `option-bar--${tone}`, className].filter(Boolean).join(' ')}
      style={delayMs === undefined ? undefined : { animationDelay: `${delayMs}ms` }}
    >
      {letter && <span className="option-bar__chip">{letter}</span>}
      <span className="option-bar__text">{text}</span>
    </div>
  )
}

/** Buchstabe zur Position: 0 wird zu A. */
export function optionLetter(index: number): string {
  return String.fromCharCode(65 + index)
}
