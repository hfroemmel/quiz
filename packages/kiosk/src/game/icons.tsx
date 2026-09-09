/**
 * Die Zeichen der Startauswahl.
 *
 * WARUM GEZEICHNET UND NICHT GESCHRIEBEN: Ein Geraet im Kiosk hat nur die
 * Schriften, die die Anwendung mitbringt. Ein Symbolzeichen aus einer Schrift,
 * die dort fehlt, waere ein leeres Kaestchen mitten im Startbildschirm - und
 * niemand steht davor, der es melden koennte.
 *
 * WARUM IM QUELLTEXT UND NICHT ALS DATEI: Es sind vier bis sechs Linien je
 * Zeichen. Als eigene Datei kaeme zu jeder ein Netzabruf und ein Bundlereintrag,
 * und `currentColor` ginge verloren - genau davon leben sie aber: Ein Zeichen
 * auf einer gewaehlten Karte ist gruen, auf einer nicht gewaehlten grau, und
 * beides entscheidet das Stylesheet.
 *
 * Die Pfade stammen aus der Entwurfsdatei des Startmenues
 * (`Quiz_Standalone_Startmenu_SVG_Assets`, Symbolgruppe der Masterdatei) und
 * sind unveraendert uebernommen.
 */
import type { SVGProps } from 'react'

type IconProps = Omit<SVGProps<SVGSVGElement>, 'viewBox' | 'children'>

/** Gemeinsamer Rahmen: 24er Raster, keine Fuellung, Farbe vom Elternteil. */
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
