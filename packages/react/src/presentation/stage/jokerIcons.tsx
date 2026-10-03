/**
 * The two joker faces - one shape per variant, in one place.
 *
 * They are drawn as a MASK over a colour area, the same way the header draws
 * the word mark: the file carries the shape, the colour comes from the context
 * (`currentColor`). An `<img>` would ignore the colour of the stage and keep
 * the ink it was drawn with, which on a dark background is barely there - the
 * 50:50 sign is lettered in near-black, so on the default stage it would be a
 * smudge. That is why the mask is the default and the artwork is asked for.
 *
 * Both shapes have ONE job: they are the faces of the drawn card, in the hand
 * that turns it and on the screen that shows it. The audience shape once also
 * stood on a score card in place of the player number while that joker was in
 * effect; the card says whose points these are and now says it without
 * interruption, so the sign is only ever a card face.
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

/*
 * The proportions of the two drawings, straight from their `viewBox`.
 *
 * NEITHER SIGN IS SQUARE, and they are not shaped alike. Kept in a square box
 * they would sit in it at 62% resp. 78% of its height - beside one another at
 * the same font size one sign would look shrunk. So the box takes its width
 * from the file and its height from the outside; both signs then stand equally
 * tall wherever they appear together.
 *
 * The number is only the DEFAULT shape of the box. `contain` below still does
 * the fitting, so a caller that sets its own width and height gets a sign that
 * is smaller than the box rather than a stretched one.
 */
const ratios: Record<JokerType, number> = {
  fiftyFifty: 704 / 553,
  audience: 640 / 398,
}

/**
 * How the sign is coloured.
 *
 * - `text` (default) - a mask over `currentColor`: the sign carries the colour
 *   of whatever it stands in, on a dark and on a light stage alike. That is
 *   what a stage theming its own colours needs.
 * - `art` - the drawing with its own colours. For a card face whose ground is
 *   known to be light; on the dark default stage the 50:50 lettering
 *   disappears into it.
 */
export type JokerIconTone = 'text' | 'art'

/**
 * The face of one joker variant.
 *
 * Purely decorative: whoever shows it says in words what it means - the
 * operator's desk in its status line, the stage in the label under the card.
 */
export function JokerTypeIcon({
  type,
  tone = 'text',
  className,
}: {
  type: JokerType
  tone?: JokerIconTone
  className?: string
}) {
  return (
    <span
      className={[styles.icon, className].filter(Boolean).join(' ')}
      data-joker-icon={type}
      data-joker-tone={tone}
      style={
        {
          '--joker-icon': cssUrl(icons[type]),
          '--joker-icon-ratio': String(ratios[type]),
        } as CSSProperties
      }
      aria-hidden="true"
    />
  )
}

/** The asset URLs, for a host that needs the file rather than the component. */
export const jokerIconUrls = icons

/** Their proportions, for a host that shapes its own box around the file. */
export const jokerIconRatios = ratios
