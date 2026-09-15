/**
 * THE COLOURS. All of them. In one place.
 *
 * Every colour value of the quiz system lives in this file - the two
 * design worlds, the light variant of the adult stage, the few colours
 * that belong to no world, and the operator's control frame. No colour
 * value lives anywhere else; `test/palette.test.ts` enforces that.
 *
 * The token vocabulary (`designColorTokens`) is defined by the core - here
 * are the VALUES. That keeps the quiz package free of presentation, while
 * still leaving exactly one source per colour.
 */
import type { DesignColors, DesignColorToken, ThemeSkin } from '@hfroemmel/quiz-core'

/**
 * Cool, slightly bluish system for the adult stage.
 *
 * The surface colours are semi-transparent: behind the scene sits the blurred
 * question image, and tiles, letters and answer bars are meant to let it
 * shine through like frosted glass rather than cover it. They are neutral
 * and come from the stage design; the meaning colours, on the other hand,
 * come from the federal colour spectrum (the Federal Government's style
 * guide, the same colour world as bundestag.de).
 *
 * Colour world of the kids quiz: paper, ink and the illustration's signal
 * colours. Their values come from `boxes.css` in the boxes asset package -
 * the drawn frames carry the same tones, so they must not be chosen freely.
 */
export const stagePalettes: Record<ThemeSkin, DesignColors> = {
  default: {
    pageTop: '#12161A',
    pageBottom: '#171C21',
    stageTop: '#171C21',
    stageBottom: '#293139',
    controls: '#12161A',
    tile: 'rgba(255, 255, 255, 0.09)',
    tileDisabled: 'rgba(255, 255, 255, 0.05)',
    tileQuiet: 'rgba(255, 255, 255, 0.06)',
    option: 'rgba(255, 255, 255, 0.05)',
    /*
     * Meaning colours from the federal colour spectrum.
     *
     * For each token, the tone with the smallest distance (CIELAB) to the
     * previously set colour was chosen - the stage keeps its picture but
     * carries official values. The percentage is the style guide's step;
     * it results from proportional lightening with white or darkening with
     * black, and is itself part of the specification.
     *
     * Against a dark background the lightened tones are used: the pure tone
     * would drown in the background. The light variant takes the same
     * colours at 100 percent.
     */
    accent: '#3392C5', // Blau 80 %
    accentQuiet: '#005A76', // Petrol, 80 % abgedunkelt
    primary: '#339D6E', // Gruen 80 %
    solution: '#339D6E', // Gruen 80 %
    /*
     * Same tone as the bar: the letter and the answer are ONE surface, split
     * only by a seam. Two greens side by side read like two separate
     * statements - the darker chip looked like a second state.
     */
    solutionChip: '#339D6E', // Gruen 80 %
    correct: '#339AA2', // Tuerkis 80 %
    incorrect: '#9A0030', // Rot, 80 % abgedunkelt
    text: '#FFFFFF',
    textMuted: 'rgba(255, 255, 255, 0.6)',
  },
  kids: {
    pageTop: '#A9D5EF',
    pageBottom: '#D9D7F2',
    stageTop: '#A9D5EF',
    stageBottom: '#D9D7F2',
    controls: '#F4EBD8',
    tile: '#F4EBD8',
    tileDisabled: '#EADDC2',
    tileQuiet: '#EADDC2',
    option: '#F4EBD8',
    accent: '#D61E1E',
    accentQuiet: '#D98B93',
    primary: '#D61E1E',
    solution: '#6FBE6B',
    solutionChip: '#F9CD36',
    correct: '#6FBE6B',
    incorrect: '#D98B93',
    text: '#0E090C',
    textMuted: 'rgba(14, 9, 12, 0.6)',
  },
}

/**
 * Light variant of the adult stage - the toggle in the stage's header.
 *
 * The layout mirrors the dark variant: where white veils sit on dark there,
 * dark veils sit on paper here.
 *
 * It also names the meaning colours, using the same CI colours as above,
 * just at full saturation: a lightened tone that glows against dark
 * disappears on paper. That is also a deliberate decision - a mode with its
 * own accent no longer shows it in the light variant. Both modes of the
 * stage currently use the same theme; should a mode ever get its own colour
 * world, its light variant belongs in that theme.
 */
export const brightPalette: Partial<DesignColors> = {
  pageTop: '#fff',
  pageBottom: '#f6f6f6',
  stageTop: '#fff',
  stageBottom: '#ebebeb',
  controls: '#eeeeee',
  /* Not a meaning but a withdrawal: the locked-out player on paper. */
  accentQuiet: '#dcdcdc',
  /* Frosted glass stays frosted glass - just made of ink instead of light. */
  tile: 'rgba(25, 25, 25, 0.06)',
  tileDisabled: 'rgba(25, 25, 25, 0.04)',
  tileQuiet: 'rgba(25, 25, 25, 0.05)',
  option: 'rgba(25, 25, 25, 0.05)',
  accent: '#0077B6', // Blau 100 %
  primary: '#00854A', // Gruen 100 %
  solution: '#00854A', // Gruen 100 %
  solutionChip: '#00854A', // Gruen 100 %, siehe oben
  correct: '#00818B', // Tuerkis 100 %
  incorrect: '#780F2D', // Dunkelrot 100 %
  text: 'rgb(25, 25, 25)',
  textMuted: 'rgba(25, 25, 25, 0.6)',
}

/**
 * Stage colours that belong to no theme.
 *
 * They don't describe a theme but a physical situation: text sitting on a
 * strong-coloured surface, and an edge separating an image from the
 * background. They stay the same in every mode and therefore are not part
 * of the quiz package's token set.
 */
export const stageExtras = {
  /** Text on accent, solution or player colour - always light there. */
  inkOnStrong: '#ffffff',
  /** Hairline edge on the portrait, so it stands out from the background. */
  edge: 'rgb(255 255 255 / 0.22)',
  /**
   * Outline around light text sitting on a busy background.
   *
   * In the kids world, the score and countdown sit over an illustration with
   * light and dark areas. Text without an outline would disappear in places
   * there - first of all in the hall, seen from twenty metres away.
   */
  inkOutline: '#000000',
  /*
   * NO PLAYER COLOURS HERE ANYMORE.
   *
   * The two corners of the touch device carry the accent of the world, and
   * they read it where it applies (`Game.module.css` in
   * `@hfroemmel/quiz-kiosk`). A token in this file could not do that: its
   * `var(--color-accent)` is substituted at the document root, so it would
   * freeze the default world's tone and keep it in the light one and in the
   * kids' one.
   */
} as const

/* ------------------------------------------------------------------ *
 * Control frame of operator and moderator
 * ------------------------------------------------------------------ */

/**
 * DELIBERATELY SEPARATED from the stage's colour system. The eighteen theme
 * tokens belong to the quiz mode: when the mode changes, the hall's colour
 * changes. The control UI does NOT do that - it stays the same dark surface
 * in every mode, so the operator can find their buttons blindly and the
 * stage preview stands out as the only bright field.
 */
/* ------------------------------------------------------------------ *
 * Quiz selection before the stage show
 * ------------------------------------------------------------------ */

/**
 * The colours of the quiz selection at the console - a set of its own, and
 * deliberately so.
 *
 * WHY NOT THE CONTROL FRAME: It is dark and wants nothing. This view is the
 * first thing on screen before an evening; it is bright, calm, and carries
 * five cards that must be told apart.
 *
 * WHY NOT THE STAGE: That belongs to the chosen quiz - and the selection sits
 * right before it. It cannot carry a colour that isn't decided until later.
 *
 * WHY NOT `startPalette`: That is the DEVICE's start screen, dark and from a
 * different design. Two screens, two designs, two sets.
 *
 * EVERY CARD HAS ITS OWN SURFACE, because it stands for its quiz: the blue of
 * the Union, the red of the Bremen coat of arms, the paper of Unity. That's
 * why these are named surfaces and not shades of one base colour.
 *
 * NO FOCUS RING AND NO RAISED SHADOW: The overview lives on the STAGE and is
 * a poster - it has no states, because it cannot be operated. A tone for a
 * state that doesn't exist would be an invitation to add one anyway.
 */
export const quizSelectPalette = {
  page: '#fbfbfa',
  ink: '#07152d',
  'ink-quiet': '#284d73',
  /* The five card surfaces. Gradients, because a flat surface looks empty here. */
  'card-bundestag': 'linear-gradient(135deg, #eef2f6 0%, #d5dee8 100%)',
  'card-kids': 'linear-gradient(180deg, #aed5f0 0%, #c1d6f1 50%, #d5d7f1 100%)',
  'card-europe': '#003399',
  'card-unity': 'linear-gradient(135deg, #f7f7f5 0%, #ececea 100%)',
  'card-bremen': 'linear-gradient(135deg, #fbe5e2 0%, #efbfc2 100%)',
  /* On the Union blue, only white works. */
  'ink-on-europe': '#ffffff',
  /* The shadow is a hint - the cards rest, they don't float. */
  shadow: 'rgb(7 21 45 / 0.055)',
} as const

export const uiPalette = {
  page: '#0d0f13',
  /* Cards and bars: control bar, private area, popups, start panel. */
  surface: '#171b21',
  /* Header and footer - a shade below the cards, so they recede. */
  'surface-quiet': '#12151a',
  /* Lightened surface INSIDE a card - such as the notes column. */
  'surface-raised': 'rgba(255, 255, 255, 0.06)',
  control: '#242a33',
  'control-disabled': '#1a1e24',
  input: 'rgb(0 0 0 / 0.35)',
  border: 'rgb(255 255 255 / 0.1)',
  /* Divider line inside a card - fainter than the outer edge. */
  'border-quiet': 'rgb(255 255 255 / 0.12)',
  /* Edge of a field that should stand out - the stage preview. */
  'border-strong': 'rgba(255, 255, 255, 0.24)',
  /* Surface behind a popup and background of the preview tile. */
  scrim: 'rgb(0 0 0 / 0.55)',
  'scrim-quiet': 'rgb(0 0 0 / 0.3)',
  text: '#ffffff',
  'text-muted': 'rgb(255 255 255 / 0.5)',
  accent: '#36b35e',
  correct: '#36b35e',
  incorrect: '#a62749',
  /* Highlighted messages: just a hint of colour, the text carries the message. */
  'warning-soft': 'rgba(255, 195, 43, 0.16)',
  'error-soft': 'rgba(255, 92, 92, 0.16)',
} as const

/* ------------------------------------------------------------------ *
 * Device start screen
 * ------------------------------------------------------------------ */

/**
 * The colour world of the start selection - its own, and deliberately so.
 *
 * WHY NOT THE CONTROL FRAME above it: That is a tool. It sits at the
 * operator's console, gets looked at for hours, and is meant to want
 * nothing. The start screen is the opposite - it's the first thing someone
 * sees in the foyer, and it must invite them in. It comes from its own
 * design (`Quiz_Standalone_Startmenu_SVG_Assets`), so its values live here
 * as a set of their own, instead of recolouring the control tokens.
 *
 * WHY NOT THE STAGE: That belongs to the quiz mode and changes with it - the
 * kids world is paper, the adult world is cool blue. The start screen sits
 * BEFORE that choice and cannot carry a colour that isn't decided until
 * later.
 *
 * THE THREE SIGNAL COLOURS - green, lime, violet - grade the difficulty.
 * They are order, not meaning: no "right", no "wrong".
 */
export const startPalette = {
  /*
   * Background: a gradient across the diagonal, plus two coloured lights.
   *
   * The lights are named after their PLACE, not their colour: one on the
   * left, the other on the right. In the dark variant they are green and
   * violet, in the light variant pink and lavender - a name that states the
   * colour would be wrong in the other variant.
   */
  'bg-top': '#111b25',
  'bg-mid': '#0a1118',
  'bg-bottom': '#070c11',
  'ambient-left': '#2bbe65',
  'ambient-right': '#726bea',

  /* Cards and edges of the right-hand column. */
  surface: '#17212d',
  'surface-quiet': '#111a24',
  /* A selected card: the same box, just tinted green. */
  'surface-selected': '#1a2b29',
  line: '#263442',
  'line-strong': '#2b3948',

  /*
   * THE SELECTION CARDS AND THE SECONDARY BUTTON HAVE THEIR OWN NAME.
   *
   * They used to look like `surface` and were named that too - together with
   * the settings window, the gear icon and the confirmation prompt. In the
   * light variant, though, they go separate ways: there the cards become
   * calm grey surfaces like an unselected answer in the game, while the
   * window keeps its frosted glass. Here the same values as before are kept,
   * so nothing changes in the dark variant.
   */
  option: '#17212d',
  /* A shade lighter under the pointer - the card lifts instead of flashing. */
  'option-hover': '#1b2735',
  /* The round surface under the icon of an unselected card. */
  'option-icon': 'rgba(255, 255, 255, 0.045)',

  text: '#f5f7f9',
  'text-muted': '#98a7b7',
  /* The footnote under the start button - quieter than everything else. */
  'text-quiet': '#6f7f8e',

  /*
   * SELECTION IS NOT THE ACTION.
   *
   * Both used to be the same green here, and in the dark variant that isn't
   * noticeable. In the light variant it is: there, the selection carries the
   * blue of the marked answer, and green belongs solely to the one button
   * that starts the game. A set of names for the selection makes that
   * separable - and here the same values as before are kept, so nothing
   * changes in the dark variant.
   */
  selected: '#42d176',
  /* Edge, icon and keyboard mark of a selected card. */
  'selected-bright': '#63df8e',
  /* Text ON a selected card - and the quieter line below it. */
  'ink-on-selected': '#f5f7f9',
  'meta-on-selected': '#98a7b7',

  green: '#42d176',
  'green-bright': '#63df8e',
  'green-light': '#46d77a',
  'green-deep': '#28b962',
  /* Edge on the start button, so its gradient doesn't fray. */
  'green-edge': '#9cf0b8',
  /*
   * The label ON the green. It is light: the bar is the surface's only full
   * colour, and everything on it belongs to the text next to it.
   */
  'ink-on-green': '#f5f7f9',
  /*
   * The icon on the filled selection marker. It is small and carries the
   * selection colour at full strength - the opposite rule applies here than
   * on the bar.
   */
  'ink-on-badge': '#06140c',
  lime: '#d9e93e',
  violet: '#8d86ff',

  /* The brand panel on the left: a warmer green than the control column on the right. */
  'brand-top': '#1d2b27',
  'brand-mid': '#173828',
  'brand-bottom': '#205d34',
  'brand-line': '#34483e',
  'brand-text': '#bed0c7',
  /* Shadow and chip background INSIDE the panel - darker than its gradient. */
  'brand-shade': '#07100d',

  /* Icon of an unselected card and of the corner buttons. */
  icon: '#a9b6c4',
  /* Lightening as frosted glass - the tone all veils are mixed from. */
  glass: '#ffffff',
  /* Darkening - shadow under the panels. */
  shade: '#000000',
} as const

/**
 * The light variant of the start screen.
 *
 * IT NAMES NO COLOUR VALUE OF ITS OWN WHERE ONE ALREADY EXISTS: whatever the
 * light stage carries, the selection before it carries too - paper, ink, the
 * blue of the marked answer, the green of the button that reveals the
 * solution. That's why references to `brightPalette` are used here instead
 * of copies of it: whoever changes a colour there changes it here too.
 *
 * Only what the stage doesn't know has its own values - the two soft lights
 * in the background and the cards' hairlines. And only what DIFFERS is
 * listed here: the rest still comes from `startPalette`.
 */
/**
 * Which token of the start menu MIRRORS which token of the stage - in the light
 * variant.
 *
 * The values below already say it: `'surface-selected': brightPalette.accent!`
 * is a reference, not a copy. But it is a reference taken once, when this
 * module is read - so a host that gives its stage a different accent would keep
 * the built-in one in its menu. The table states the relationship as DATA, so
 * `resolveTheme` can apply it AFTER the host's overrides, and a test compares
 * both against each other: whoever changes one of the two notices it.
 */
export const brightStartMirrors = {
  'bg-top': 'pageTop',
  'bg-mid': 'pageTop',
  'bg-bottom': 'pageTop',
  option: 'option',
  'option-hover': 'controls',
  'surface-selected': 'accent',
  selected: 'accent',
  'selected-bright': 'accent',
  text: 'text',
  'text-muted': 'textMuted',
  green: 'primary',
  'green-bright': 'primary',
  'green-light': 'primary',
  'green-deep': 'primary',
  'green-edge': 'primary',
  'brand-top': 'pageTop',
  'brand-mid': 'pageTop',
  'brand-bottom': 'pageTop',
  'brand-text': 'text',
  icon: 'textMuted',
  glass: 'text',
} as const satisfies Record<string, DesignColorToken>

/**
 * And these carry the light ink that goes on a strong area - the same value the
 * stage uses for text on the accent (`stageExtras.inkOnStrong`).
 */
export const brightStartInkOnStrong = ['option-icon', 'ink-on-selected', 'ink-on-green', 'ink-on-badge'] as const

export const brightStartPalette = {
  /*
   * WHITE, AND FULLY SO.
   *
   * The dark variant's background is a gradient with two coloured lights -
   * that gives an almost black surface depth. On paper this isn't needed:
   * the cards stand out through their edge, not through the background.
   * Both lights are therefore switched off here, instead of extending the
   * stylesheet rule with a second variant.
   */
  'bg-top': brightPalette.pageTop!,
  'bg-mid': brightPalette.pageTop!,
  'bg-bottom': brightPalette.pageTop!,
  'ambient-left': 'transparent',
  'ambient-right': 'transparent',

  /*
   * Frosted glass made of light, not of ink: on white, a veil of ink is just
   * a grey box. That applies to the settings window and the confirmation
   * prompt above it - the cards next to it go their own way, see `option`.
   */
  surface: 'rgba(255, 255, 255, 0.62)',
  'surface-quiet': 'rgba(255, 255, 255, 0.45)',
  line: 'rgba(25, 25, 25, 0.1)',
  'line-strong': 'rgba(25, 25, 25, 0.16)',

  /*
   * THE SELECTION CARD IS A SURFACE - THE SAME AS AN ANSWER IN THE GAME.
   *
   * It used to be almost as white as the background, with only a thin edge
   * marking it off. On paper that's not enough: seen from two metres away
   * and at an angle - the way someone stands at a device in the foyer - a
   * one-pixel line disappears, and so does the card. That's why it uses the
   * same calm grey that an untapped answer carries in the game, and the
   * same value (`brightPalette.option`) instead of a second number beside it.
   */
  option: brightPalette.option!,
  'option-hover': brightPalette.controls!,
  /* On the grey, the icon stands out via white, not via ink. */
  'option-icon': stageExtras.inkOnStrong,
  /*
   * AND THE SELECTED CARD IS FULLY FILLED WITH IT - not tinted blue, but the
   * same blue that a tapped answer carries in the game. It is the same value
   * as `selected` below; that two names point to one colour here is exactly
   * the point: in the dark variant they are two different colours.
   */
  'surface-selected': brightPalette.accent!,

  text: brightPalette.text!,
  'text-muted': brightPalette.textMuted!,
  'text-quiet': 'rgba(25, 25, 25, 0.45)',

  /* The selection carries the blue of the marked answer. */
  selected: brightPalette.accent!,
  'selected-bright': brightPalette.accent!,
  /*
   * On the full blue surface, only white works - title, line below it, icon
   * and checkmark. Previously the ink of the other cards was used here; that
   * was correct as long as the selected card was only tinted blue.
   */
  'ink-on-selected': stageExtras.inkOnStrong,
  'meta-on-selected': 'rgba(255, 255, 255, 0.78)',

  /*
   * The start button is the same button as "Submit answer and reveal": one
   * surface, one green, white text. The dark variant's gradient therefore
   * runs here between two identical tones - it disappears without the
   * stylesheet rule needing to know about it.
   */
  green: brightPalette.primary!,
  'green-bright': brightPalette.primary!,
  'green-light': brightPalette.primary!,
  'green-deep': brightPalette.primary!,
  'green-edge': brightPalette.primary!,
  'ink-on-green': stageExtras.inkOnStrong,
  'ink-on-badge': stageExtras.inkOnStrong,

  /* The brand panel sits on the same paper as everything else. */
  'brand-top': brightPalette.pageTop!,
  'brand-mid': brightPalette.pageTop!,
  'brand-bottom': brightPalette.pageTop!,
  'brand-line': 'rgba(25, 25, 25, 0.1)',
  'brand-text': brightPalette.text!,
  'brand-shade': 'rgba(25, 25, 25, 0.08)',

  icon: brightPalette.textMuted!,
  /* The veils are mixed from ink, not from light. */
  glass: brightPalette.text!,
} as const

/**
 * Complete the colours of a theme.
 *
 * A host theme only names what differs from its design world; the complete
 * set for the stage is only assembled here.
 */
export function resolveThemeColors(theme: {
  skin?: ThemeSkin | undefined
  colors?: Record<string, string> | undefined
}): DesignColors {
  return { ...stagePalettes[theme.skin ?? 'default'], ...theme.colors }
}
