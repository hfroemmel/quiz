/**
 * One icon family for the lifelines.
 *
 * Both icons share a 24x24 box, a stroke width of 2, round caps and
 * `currentColor` - nothing else. At the size they are actually shown, two small
 * dots in the scoreboard, anything more detailed turns to mush: no emoji, no
 * drawn people, no fills that would make one icon heavier than the other.
 *
 * `aria-hidden` on both: they never carry the meaning on their own. What a dot
 * means is said by the accessible name of the element around it (see
 * `Lifelines.tsx`), which a screen reader reads and an icon cannot.
 */

/** Shared attributes - the reason both icons weigh the same. */
const frame = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
} as const

/**
 * The 50:50 - a circle cut in half.
 *
 * The plainest possible "half of it is gone": no numbers to read, no bars to
 * count, and it stays legible when the whole icon is twelve pixels wide.
 */
export function FiftyFiftyIcon({ className }: { className?: string }) {
  return (
    <svg {...frame} {...(className ? { className } : {})}>
      <circle cx="12" cy="12" r="8.5" />
      <line x1="12" y1="3.5" x2="12" y2="20.5" />
    </svg>
  )
}

/**
 * The audience lifeline - three heads, no bodies.
 *
 * A raised hand or a person would need lines this icon does not have room for.
 * Three circles in a row read as "the room" at any size, and they carry the
 * same stroke as the circle next to them.
 */
export function AudienceIcon({ className }: { className?: string }) {
  return (
    <svg {...frame} {...(className ? { className } : {})}>
      <circle cx="6" cy="9" r="3" />
      <circle cx="18" cy="9" r="3" />
      <circle cx="12" cy="15.5" r="3.5" />
    </svg>
  )
}
