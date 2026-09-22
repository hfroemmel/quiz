/**
 * The icons of the start selection.
 *
 * WHY DRAWN AND NOT TYPED: a device in a kiosk only has the fonts the
 * application brings along. A symbol glyph from a font that is missing there
 * would be an empty box in the middle of the start screen - and nobody is
 * standing in front of it to report it.
 *
 * WHY IN SOURCE CODE AND NOT AS A FILE: each icon is four to six lines. As a
 * separate file, each would come with a network request and a bundler entry,
 * and `currentColor` would be lost - which is exactly what they live on: an
 * icon on a selected card is green, on an unselected one grey, and the
 * stylesheet decides both.
 *
 * The paths come from the start menu's design file
 * (`Quiz_Standalone_Startmenu_SVG_Assets`, icon group of the master file) and
 * are carried over unchanged.
 */
import type { SVGProps } from 'react'

type IconProps = Omit<SVGProps<SVGSVGElement>, 'viewBox' | 'children'>

/** Shared frame: 24-unit grid, no fill, colour from the parent. */
function Icon({ children, ...props }: IconProps & { children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" {...props}>
      {children}
    </svg>
  )
}

export function PersonIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="8" r="3.2" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M5.5 20c.6-4.1 2.8-6.2 6.5-6.2s5.9 2.1 6.5 6.2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </Icon>
  )
}

export function PeopleIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="8.3" cy="8.2" r="2.7" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="16.2" cy="8.2" r="2.7" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="M3.3 19c.4-3.5 2-5.3 5-5.3 1.6 0 2.8.5 3.6 1.4M12.1 15.1c.8-.9 2.1-1.4 3.8-1.4 2.9 0 4.5 1.8 4.9 5.3"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </Icon>
  )
}

export function CheckIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path
        d="M6.3 12.4l3.5 3.5 7.9-8.1"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Icon>
  )
}

export function ArrowIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path
        d="M5 12h13M13.5 6.5L19 12l-5.5 5.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Icon>
  )
}

/**
 * The cross that ends a round.
 *
 * Two strokes, and deliberately not a "back" arrow: this does not go one step
 * back, it closes what is running.
 */
export function CloseIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path
        d="M6.5 6.5 17.5 17.5M17.5 6.5 6.5 17.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </Icon>
  )
}

export function SlidersIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path
        d="M4 7h10M18 7h2M4 17h2M10 17h10"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <circle cx="16" cy="7" r="2.3" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="8" cy="17" r="2.3" fill="none" stroke="currentColor" strokeWidth="1.8" />
    </Icon>
  )
}
