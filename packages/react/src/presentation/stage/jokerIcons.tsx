/**
 * The two joker faces - one shape per variant, in one place.
 *
 * They are drawn as a MASK over a colour area, the same way the header draws
 * the word mark: the file carries the shape, the colour comes from the context
 * (`currentColor`). An `<img>` would ignore the colour of the stage and keep
 * the ink it was drawn with, which on a dark background is barely there.
 *
 * The audience shape does double duty: it is the back of a drawn audience
 * joker, and it is the group marker that replaces the player number while that
 * joker is in effect. One file, one look - a second drawing of "the audience"
 * would drift away from the first.
 */
import type { CSSProperties } from 'react'
import type { JokerType } from '@hfroemmel/quiz-core'
import { cssUrl } from '../cssUrl'
import audienceIcon from '../../assets/joker-audience-icon.svg'
import fiftyFiftyIcon from '../../assets/joker-fifty-fifty-icon.svg'
import styles from './jokerIcons.module.css'

const icons: Record<JokerType, string> = {
  fiftyFifty: fiftyFiftyIcon,
  audience: audienceIcon,
}

/**
 * The face of one joker variant.
 *
 * Purely decorative: whoever shows it says in words what it means - the
 * operator's desk in its status line, the stage in the label under the card.
 */
export function JokerTypeIcon({ type, className }: { type: JokerType; className?: string }) {
  return (
    <span
      className={[styles.icon, className].filter(Boolean).join(' ')}
      data-joker-icon={type}
      style={{ '--joker-icon': cssUrl(icons[type]) } as CSSProperties}
      aria-hidden="true"
    />
  )
}

/** The asset URLs, for a host that needs the file rather than the component. */
export const jokerIconUrls = icons
