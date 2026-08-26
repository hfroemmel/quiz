/**
 * Buzzer eines Spielers am Touchgeraet.
 *
 * Beide Spieler stehen nebeneinander vor demselben Bildschirm; jeder hat seine
 * Ecke unten an seiner Seite, und die vier Antworten stehen genau einmal in der
 * Mitte. Wer zuerst drueckt, bekommt sie.
 *
 * Der Zuschlag faellt auf dem Server: Der Knopf sendet nur `BUZZ` mit dem
 * eigenen Spieler, und der Server nimmt den ersten gueltigen Buzz an - mit
 * derselben Regel wie beim Hardware-Buzzer der Buehne. Wer zu spaet drueckt,
 * wird abgewiesen; dieser Client zeigt danach einfach den neuen Stand.
 *
 * Die Flaeche traegt nur ein Wort. Am Geraet wird schnell und ungenau gedrueckt,
 * und wer buzzert, schaut dabei auf die Frage, nicht auf seine Hand; wem die
 * Ecke gehoert, sagt die Farbe und die Punktekarte darueber.
 */
import type { PlayerId } from '@hfroemmel/quiz-core'
import styles from './Game.module.css'

interface BuzzerProps {
  playerId: PlayerId
  label: string
  side: 'left' | 'right'
  /** Kann dieser Spieler den Zuschlag jetzt holen? */
  enabled: boolean
  /** Er hat ihn bereits - die Antworten in der Mitte gehoeren ihm. */
  armed: boolean
  onBuzz(playerId: PlayerId): void
}

export function Buzzer({ playerId, label, side, enabled, armed, onBuzz }: BuzzerProps) {
  return (
    <button
      type="button"
      className={styles.buzzer}
      data-buzzer=""
      data-player={playerId}
      data-side={side}
      data-enabled={String(enabled)}
      data-armed={String(armed)}
      disabled={!enabled}
      /*
       * `onPointerDown` statt `onClick`: Beim Buzzern zaehlt der Moment der
       * Beruehrung. Ein Klick entsteht erst beim Loslassen und gaebe dem
       * Langsameren die Chance, den Schnelleren zu ueberholen.
       */
      onPointerDown={() => onBuzz(playerId)}
      aria-label={`${label} buzzern`}
    >
      Buzzern
    </button>
  )
}
