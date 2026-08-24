/**
 * Antwortflaechen eines Spielers.
 *
 * Sie sind der Ersatz fuer den Hardware-Buzzer: Wer zuerst tippt, hat geantwortet.
 * Deshalb ist jede Zeile eine ganze Schaltflaeche und kein kleines Ziel - am Tisch
 * wird schnell und ungenau getippt.
 *
 * Gezeichnet wird mit DENSELBEN Zeilen wie auf der Buehne (`AnswerList`). Das ist
 * keine Sparsamkeit, sondern die Zusage, dass eine richtige Antwort am Geraet
 * genauso aussieht wie im Saal: gleiche Zustaende, gleicher Buchstabenchip,
 * gleiche Zeichnung der Kinderwelt.
 *
 * Beim Duell liegt die Leiste des zweiten Spielers auf der gegenueberliegenden
 * Tischseite und ist deshalb um 180 Grad gedreht. Die Drehung ist reine
 * Darstellung; beide Leisten zeigen dieselben Optionen in derselben Reihenfolge.
 */
import type { PlayerId, PublicOption, PublicScene } from '@quiz/contracts'
import { AnswerList } from '../presentation/stage/AnswerList.tsx'
import { answerRows } from '../presentation/stage/answerState.ts'
import styles from './Game.module.css'

interface AnswerPadProps {
  playerId: PlayerId
  label: string
  options: PublicOption[]
  scene: PublicScene
  /** Darf dieser Spieler jetzt antworten? */
  enabled: boolean
  /** Gespiegelte Tischseite. */
  mirrored?: boolean
  onAnswer(playerId: PlayerId, optionId: string): void
}

export function AnswerPad({ playerId, label, options, scene, enabled, mirrored, onAnswer }: AnswerPadProps) {
  return (
    <div
      className={`${styles.pad} ${mirrored ? styles.mirrored : ''}`}
      data-answer-pad=""
      data-player={playerId}
      data-enabled={String(enabled)}
      data-mirrored={String(Boolean(mirrored))}
    >
      <AnswerList
        rows={answerRows(options, scene)}
        disabled={!enabled}
        label={`Antworten ${label}`}
        onSelect={(optionId) => onAnswer(playerId, optionId)}
      />
    </div>
  )
}
