/**
 * THE FEDERAL GOVERNMENT'S COLOUR SPECTRUM - the only colours this quiz uses.
 *
 * Source: the Federal Government's style guide, chapter "Basiselemente /
 * Farben" (styleguide.bundesregierung.gov.de). The seventeen tones below are
 * its spectrum, with the HEX values the style guide states for screen use.
 *
 * TWO RULES MAKE EVERY OTHER VALUE. The style guide says it in one sentence:
 * "Jede Farbe kann zusätzlich sowohl prozentual aufgehellt als auch mit
 * Schwarz abgedunkelt werden" - every tone may be lightened proportionally
 * towards white, or darkened with black, in the steps 100, 80, 60, 40 and 20
 * percent. `ci()` is the first rule, `ciDark()` the second; there is no third.
 *
 * WHY THIS FILE EXISTS AT ALL. Until now the stage carried nine values from
 * this spectrum and roughly a hundred of its own - neutral greys, a violet
 * glow, five card surfaces. Written as literals, there was no way to tell the
 * two apart, and no way to state the rule. Now a value either comes out of
 * this file or it is not a colour of this house: `palettes.ts` names tones and
 * steps, and `test/palette.test.ts` checks that nothing else got in.
 *
 * THE CHILDREN'S WORLD IS EXEMPT, by decision. It is a drawn world whose
 * colours come from its illustrations (`boxes.css` in the asset package); a
 * frame painted in one tone and a palette in another would not match. Its
 * values therefore stay literals in `palettes.ts`, and the guard test names
 * that exception rather than hiding it.
 *
 * ACCESSIBILITY IS PART OF THE SPECTRUM: the style guide gives every tone the
 * label colour - white or black - that reaches a contrast ratio of at least
 * 4.5:1 on it, measured per DIN 1450. Whoever exchanges a tone here has to
 * look that up again; the step rules do not preserve contrast.
 */

/** The seventeen tones at 100 percent, by their names in the style guide. */
export const federalTones = {
  violett: '#5F316E',
  dunkelrot: '#780F2D',
  rot: '#C0003C',
  orange: '#CD5038',
  hellorange: '#F7BB3D',
  gelb: '#F9E03A',
  hellgruen: '#C1CA31',
  oliv: '#597C39',
  dunkelgruen: '#005C45',
  gruen: '#00854A',
  tuerkis: '#00818B',
  hellblau: '#80CDEC',
  blau: '#0077B6',
  petrol: '#007194',
  dunkelblau: '#004B76',
  dunkelgrau: '#576164',
  hellgrau: '#BEC5C9',
} as const

export type FederalTone = keyof typeof federalTones

/**
 * The steps the style guide offers. Nothing in between is a colour of the
 * spectrum - that is why this is a list and not a number.
 */
export const federalSteps = [100, 80, 60, 40, 20] as const
export type FederalStep = (typeof federalSteps)[number]

/** White and black, which the style guide uses for labels and as ground. */
export const weiss = '#FFFFFF'
export const schwarz = '#000000'

function channels(value: string): [number, number, number] {
  const hex = value.replace('#', '')
  return [0, 2, 4].map((at) => Number.parseInt(hex.slice(at, at + 2), 16)) as [number, number, number]
}

function hex(parts: number[]): string {
  return `#${parts.map((part) => part.toString(16).padStart(2, '0').toUpperCase()).join('')}`
}

function mix(tone: FederalTone, step: FederalStep, towards: string): string {
  const share = step / 100
  const target = channels(towards)
  return hex(channels(federalTones[tone]).map((part, index) => Math.round(part * share + target[index]! * (1 - share))))
}

/**
 * A tone, lightened to the given step - the style guide's "Abstufung".
 *
 * At 100 percent it is the tone itself, which is why that is the default: most
 * places want the colour, not a tint of it.
 */
export function ci(tone: FederalTone, step: FederalStep = 100): string {
  return mix(tone, step, weiss)
}

/** A tone, darkened with black to the given step. */
export function ciDark(tone: FederalTone, step: FederalStep): string {
  return mix(tone, step, schwarz)
}

/**
 * A colour of the spectrum as a translucent veil.
 *
 * The alpha is not a colour: a surface at nine percent white over a dark
 * ground is still white, and the style guide's rules apply to the tone, not to
 * how much of it is let through. This exists so that a veil does not have to
 * be written as a second literal beside the colour it veils.
 */
export function veil(color: string, alpha: number): string {
  const [red, green, blue] = channels(color)
  return `rgb(${red} ${green} ${blue} / ${alpha})`
}

/** Every value the two rules can produce - what the guard test measures against. */
export function federalValues(): Map<string, string> {
  const all = new Map<string, string>([
    [weiss, 'Weiß'],
    [schwarz, 'Schwarz'],
  ])
  for (const tone of Object.keys(federalTones) as FederalTone[]) {
    for (const step of federalSteps) {
      all.set(ci(tone, step), `${tone} ${step} %`)
      if (step !== 100) all.set(ciDark(tone, step), `${tone} ${step} % abgedunkelt`)
    }
  }
  return all
}
