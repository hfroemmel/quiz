/**
 * Buzzer eines Spielers am Touchgeraet.
 *
 * Er ersetzt die frueheren Antwortleisten: Beide Spieler stehen nebeneinander
 * vor demselben Bildschirm, jeder hat seine Flaeche an seiner Seite, und die
 * vier Antworten stehen genau einmal in der Mitte. Wer zuerst drueckt, bekommt
 * sie.
 *
 * WARUM DER ZUSCHLAG HIER FAELLT und nicht auf dem Server: Beide Buzzer liegen
 * auf EINEM Geraet, es gibt also kein Rennen zwischen zwei Clients, das ein
 * Schiedsrichter entscheiden muesste. Verbindlich bleibt der Server trotzdem -
 * er bekommt mit der Antwort auch den Spieler und weist sie ab, wenn dieser
 * nicht antworten darf.
 *
 * Die Flaeche ist absichtlich riesig und traegt nur den Namen: Am Geraet wird
 * schnell und ungenau gedrueckt, und wer buzzert, schaut dabei auf die Frage,
 * nicht auf seine Hand. Der Punktestand steht in der Kopfzeile und gehoert nicht
 * ein zweites Mal hierher.
 */
import type { PlayerId } from '@quiz/contracts'
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
      <span className={styles.buzzerLabel}>{label}</span>
    </button>
  )
}
