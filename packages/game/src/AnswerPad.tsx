/**
 * Antwortflaechen eines Spielers.
 *
 * Sie sind der Ersatz fuer den Hardware-Buzzer: Wer zuerst tippt, hat geantwortet.
 * Deshalb ist jede Flaeche eine ganze Schaltflaeche und kein kleines Ziel - am
 * Tisch wird schnell und ungenau getippt.
 *
 * Beim Duell liegt die Leiste des zweiten Spielers auf der gegenueberliegenden
 * Tischseite und ist deshalb um 180 Grad gedreht. Die Drehung ist reine
 * Darstellung; beide Leisten zeigen dieselben Optionen in derselben Reihenfolge.
 */
import type { PlayerId, PublicOption } from '@quiz/contracts'
import { OptionBar, optionLetter } from '@quiz/presentation'

interface AnswerPadProps {
  playerId: PlayerId
  label: string
  options: PublicOption[]
  /** Darf dieser Spieler jetzt antworten? */
  enabled: boolean
  /** Gespiegelte Tischseite. */
  mirrored?: boolean
  onAnswer(playerId: PlayerId, optionId: string): void
}

export function AnswerPad({ playerId, label, options, enabled, mirrored, onAnswer }: AnswerPadProps) {
  return (
    <div
      className={['answer-pad', mirrored ? 'answer-pad--mirrored' : ''].filter(Boolean).join(' ')}
      data-player={playerId}
      data-enabled={enabled}
    >
      <div className="answer-pad__grid" role="group" aria-label={`Antworten ${label}`}>
        {options.map((option, index) => (
          <button
            key={option.id}
            type="button"
            className="answer-pad__button"
            disabled={!enabled}
            onClick={() => onAnswer(playerId, option.id)}
          >
            <OptionBar
              letter={optionLetter(index)}
              text={option.text}
              tone={toneFor(option, enabled)}
              className="answer-pad__option"
            />
          </button>
        ))}
      </div>
    </div>
  )
}

/**
 * Der Zustand einer Option kommt ausschliesslich aus dem View-Modell: Vor der
 * Loesung traegt keine Option einen Zustand, danach genau die richtige und die
 * gewaehlte falsche. Der Client faerbt nichts auf eigene Rechnung.
 */
function toneFor(option: PublicOption, enabled: boolean) {
  if (option.state === 'correct') return 'solution' as const
  if (option.state === 'chosen-incorrect') return 'chosen' as const
  return enabled ? ('neutral' as const) : ('muted' as const)
}
