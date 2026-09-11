/**
 * The lifeline status of ONE player: two small round dots.
 *
 * It is deliberately dumb. It is handed a list of `{ type, used }` and renders
 * it - it does not know who may trigger a lifeline, whether a server is
 * involved, or what an operator is. That is what makes the same component work
 * on the live stage (pure status, not touchable) and at a kiosk (touchable,
 * with a hit area a thumb can find).
 *
 * NOT RENDERED AT ALL where the installation offers no lifelines: the list is
 * then absent from the view model and this component returns null, so nothing
 * in the surrounding layout moves.
 *
 * The spent state is legible WITHOUT colour: the dot loses its fill, the icon
 * mutes, the whole thing dims - and a diagonal line crosses it. The line is the
 * part that survives a monochrome print, a projector with a broken colour
 * channel, and colour blindness.
 */
import type { LifelineType, PlayerId, PublicLifelineStatus } from '@hfroemmel/quiz-core'
import { AudienceIcon, FiftyFiftyIcon } from './lifelineIcons'
import styles from './Lifelines.module.css'

export interface LifelinesProps {
  /** Which lifelines this player has, and whether they are spent. */
  lifelines: readonly PublicLifelineStatus[]
  /** Whose lifelines - for the accessible name and for diagnosis. */
  playerId: PlayerId
  /**
   * Mirrored: dots to the LEFT of the player number instead of the right.
   * Player 2 sits on the other side of the stage and their scoreboard is
   * mirrored; the dots follow it.
   */
  mirrored?: boolean
  /**
   * Names of the lifelines, in the language of the game. Without them the
   * German names stand - a dot without a name would be worse than one in the
   * wrong language.
   */
  labels?: Partial<Record<LifelineType, string>>
  /** Wording of the spent state, for the accessible name. */
  usedText?: string
  availableText?: string
  /**
   * Only where a player triggers their own lifelines: what happens on a tap.
   * With this set every dot becomes a real button with a hit area of at least
   * 44 by 44 pixels. Without it - the live stage - the dots are plain status and
   * catch nothing.
   */
  onUse?: (type: LifelineType) => void
  /** Which dots may currently be tapped. Ignored where `onUse` is absent. */
  canUse?: (type: LifelineType) => boolean
}

const defaultLabels: Record<LifelineType, string> = {
  fiftyFifty: '50:50-Joker',
  audience: 'Publikumsjoker',
}

function iconFor(type: LifelineType, className: string | undefined) {
  const props = className === undefined ? {} : { className }
  return type === 'fiftyFifty' ? <FiftyFiftyIcon {...props} /> : <AudienceIcon {...props} />
}

export function Lifelines({
  lifelines,
  playerId,
  mirrored = false,
  labels,
  usedText = 'verbraucht',
  availableText = 'verfügbar',
  onUse,
  canUse,
}: LifelinesProps) {
  if (lifelines.length === 0) return null

  return (
    <span
      className={styles.lifelines}
      data-lifelines=""
      data-player={playerId}
      data-mirrored={String(mirrored)}
    >
      {lifelines.map((entry) => {
        const name = labels?.[entry.type] ?? defaultLabels[entry.type]
        /*
         * The name says everything the dot says, in words: which lifeline, and
         * whether it is still there. A screen reader needs nothing else - and
         * neither does a test.
         */
        const accessibleName = `${name}: ${entry.used ? usedText : availableText}`
        const dotClass = `${styles.dot} ${entry.used ? styles.dotUsed : ''}`

        if (!onUse) {
          /*
           * Status only. `role="img"` with a name rather than a `title`: the
           * dot is one indivisible statement, and a title would additionally
           * appear as a tooltip nobody asked for.
           */
          return (
            <span
              key={entry.type}
              className={dotClass}
              data-lifeline={entry.type}
              data-used={String(entry.used)}
              role="img"
              aria-label={accessibleName}
            >
              {iconFor(entry.type, styles.icon)}
            </span>
          )
        }

        const usable = !entry.used && (canUse?.(entry.type) ?? true)
        return (
          <button
            key={entry.type}
            type="button"
            className={styles.hit}
            data-lifeline={entry.type}
            data-used={String(entry.used)}
            disabled={!usable}
            aria-label={accessibleName}
            onClick={() => onUse(entry.type)}
          >
            <span className={dotClass} aria-hidden="true">
              {iconFor(entry.type, styles.icon)}
            </span>
          </button>
        )
      })}
    </span>
  )
}
