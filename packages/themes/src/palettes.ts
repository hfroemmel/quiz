/**
 * THE COLOURS. All of them. In one place.
 *
 * Every colour of the quiz system is assigned here - the two design worlds,
 * the light and the red variant of the adults' stage, the few colours that
 * belong to no world, the start menu and the operator's control frame. No
 * colour is assigned anywhere else; `test/palette.test.ts` enforces that.
 *
 * AND NONE OF THEM IS A VALUE OF OUR OWN ANY MORE. Every colour outside the
 * children's world is a tone of the Federal Government's colour spectrum at
 * one of its steps (`federalSpectrum.ts`): `ci('blau', 80)` is the style
 * guide's "Blau, Abstufung 80 %", `ciDark('rot', 80)` its "Rot, mit Schwarz
 * abgedunkelt". Nothing is mixed freely, and a literal in this file would be
 * a colour the house does not have - which is what the guard test reports.
 *
 * WHERE A TONE WAS CHOSEN, it is the nearest step to the value it replaces,
 * so this is a conformance change and not a redesign. Only where a role names
 * a colour does the role win over the distance: the three signals, the grades
 * of the start menu, and the surface of a card that stands for its quiz.
 *
 * THE CHILDREN'S WORLD IS THE ONE EXCEPTION, and it is deliberate: its
 * colours come from its own illustrations, and a drawn frame does not follow a
 * spectrum. Its values stay literals below, and the guard test names them.
 *
 * The token vocabulary (`designColorTokens`) is defined by the core - here
 * are the VALUES. That keeps the quiz package free of presentation, while
 * still leaving exactly one source per colour.
 */
import type { DesignColors, DesignColorToken, ThemeSkin } from '@hfroemmel/quiz-core'
import { ci, ciDark, schwarz, veil, weiss } from './federalSpectrum'

/**
 * The ground of the red variant - the one value that variant is.
 *
 * It stands here as a constant because three palettes read it: the stage, the
 * start menu in front of it, and the offer overview of the room. A copy in
 * each of the three is how the three would drift apart.
 */
const redGround = ci('rot', 80)

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
    /*
     * The ground: one tone, three steps of it. Grey is the spectrum's
     * `Dunkelgrau`, darkened with black - the deepest step for the page, a
     * lighter one under the stage, so the board still lifts off the page.
     */
    pageTop: ciDark('dunkelgrau', 20),
    pageBottom: ciDark('dunkelgrau', 40),
    stageTop: ciDark('dunkelgrau', 40),
    stageBottom: ciDark('dunkelgrau', 60),
    controls: ciDark('dunkelgrau', 20),
    tile: veil(weiss, 0.09),
    tileDisabled: veil(weiss, 0.05),
    tileQuiet: veil(weiss, 0.06),
    option: veil(weiss, 0.05),
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
    accent: ci('blau', 80),
    accentQuiet: ciDark('petrol', 80),
    primary: ci('gruen', 80),
    solution: ci('gruen', 80),
    /*
     * Same tone as the bar: the letter and the answer are ONE surface, split
     * only by a seam. Two greens side by side read like two separate
     * statements - the darker chip looked like a second state.
     */
    solutionChip: ci('gruen', 80),
    correct: ci('tuerkis', 80),
    incorrect: ciDark('rot', 80),
    text: weiss,
    textMuted: veil(weiss, 0.6),
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
 * THE INK OF THE LIGHT VARIANT - a near black, and a tone of the spectrum.
 *
 * The style guide labels its colours in white or black; on paper that is
 * black. A page of running text in pure black is harder to read than one in a
 * soft black, so `Dunkelgrau` at its deepest step stands here instead - it is
 * the spectrum's own near black, and every veil of the light variant is mixed
 * from it.
 */
const brightInk = ciDark('dunkelgrau', 20)

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
  pageTop: weiss,
  /*
   * Paper, and two steps of `Hellgrau` on it. The spectrum's grey ladder is
   * what the light variant's near-whites were reaching for; at 20 and 40
   * percent it holds the same three levels the design had.
   */
  pageBottom: ci('hellgrau', 20),
  stageTop: weiss,
  stageBottom: ci('hellgrau', 40),
  controls: ci('hellgrau', 40),
  /* Not a meaning but a withdrawal: the locked-out player on paper. */
  accentQuiet: ci('hellgrau', 60),
  /* Frosted glass stays frosted glass - just made of ink instead of light. */
  tile: veil(brightInk, 0.06),
  tileDisabled: veil(brightInk, 0.04),
  tileQuiet: veil(brightInk, 0.05),
  option: veil(brightInk, 0.05),
  accent: ci('blau'),
  primary: ci('gruen'),
  solution: ci('gruen'),
  solutionChip: ci('gruen'), // siehe oben
  correct: ci('tuerkis'),
  incorrect: ci('dunkelrot'),
  text: brightInk,
  textMuted: veil(brightInk, 0.6),
}

/**
 * THE RED VARIANT OF THE ADULTS' STAGE - a third choice next to dark and light.
 *
 * It is the DARK stage with one thing exchanged: the dark grey of the ground
 * becomes `#ca2f56`. Nothing else is named here, so everything else is the
 * dark variant's, by the same mechanism the light variant uses - a partial
 * set on top of `stagePalettes.default`.
 *
 * WHY NAMING ONLY THE GROUND IS ENOUGH. The surfaces of this stage are veils,
 * not paint: tile, option and their quiet forms are white at five to nine
 * percent. Over the red they become lighter red by themselves, and the depth
 * between ground, board and answer row survives the exchange without a single
 * new value. That is also why no gradient is invented: all four ground tokens
 * carry the same tone, and what still separates the areas are the veils.
 *
 * THE MEANING COLOURS STAY, and that is a decision, not an omission: blue
 * marks the selection and the player whose turn it is, green the right answer,
 * red the wrong one. A red ground makes the wrong-answer red harder to tell
 * apart than it is on grey - it is the one place where this variant is weaker
 * than the two others, and moving the token would break the agreement that
 * the three signals mean the same thing in every variant.
 *
 * THE GROUND IS `Rot` AT 80 PERCENT. The value this variant was specified with
 * (`#ca2f56`) is not a step of the spectrum; the nearest one is fourteen units
 * away, which is a tone nobody can tell apart at two metres - and it is a
 * colour the house actually has.
 */
export const redPalette: Partial<DesignColors> = {
  pageTop: redGround,
  pageBottom: redGround,
  stageTop: redGround,
  stageBottom: redGround,
  controls: redGround,
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
  inkOnStrong: weiss,
  /**
   * Shadow under a card lying ON the stage - the background step after a
   * solution.
   *
   * A card that lies on something says so by the edge it darkens, and it says
   * it in the same way in the dark world and in the bright one: the shadow is
   * the distance to the ground, not a colour of the mode.
   */
  cardShadow: veil(schwarz, 0.2),
  /** Hairline edge on the portrait, so it stands out from the background. */
  edge: veil(weiss, 0.22),
  /**
   * Outline around light text sitting on a busy background.
   *
   * In the kids world, the score and countdown sit over an illustration with
   * light and dark areas. Text without an outline would disappear in places
   * there - first of all in the hall, seen from twenty metres away.
   */
  inkOutline: schwarz,
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
/*
 * The ink of the poster: `Dunkelblau`, at its deepest step for the heading and
 * whole for the line under it. The two used to be a near-black navy and a mid
 * navy mixed by hand; the spectrum has that family, and the step rule gives
 * the two levels the design asks for.
 */
const selectInk = ciDark('dunkelblau', 40)
const selectInkQuiet = ci('dunkelblau')

export const quizSelectPalette = {
  page: weiss,
  ink: selectInk,
  'ink-quiet': selectInkQuiet,
  /*
   * INK ON A CARD IS NOT INK ON THE PAGE.
   *
   * Here the two are the same value, which is why the second pair looks
   * redundant - in the dark and the red variant they part ways. There the
   * GROUND turns and the cards do not: they carry the colours of their
   * quizzes and stay the light surfaces they are in every variant, so the
   * text on them stays dark while the heading above them goes light. Without
   * the second pair, the variant would have to choose between an unreadable
   * heading and unreadable cards.
   */
  'ink-on-card': selectInk,
  'meta-on-card': selectInkQuiet,
  /*
   * THE FIVE CARD SURFACES. Gradients, because a flat surface looks empty here.
   *
   * Each card is a step of the tone its quiz is recognised by, and that is
   * where the role beats the distance: two of the five were near-whites told
   * apart only by their warmth, which no spectrum can reproduce. The house
   * grey carries the Bundestag, the light blue the children's quiz, the deep
   * blue Europe, gold the German Unity banner and red the Bremen coat of arms.
   * The motifs on top keep their own colours - a flag is content, not a token.
   */
  'card-bundestag': `linear-gradient(135deg, ${ci('hellgrau', 20)} 0%, ${ci('hellgrau', 60)} 100%)`,
  'card-kids': `linear-gradient(180deg, ${ci('hellblau', 60)} 0%, ${ci('hellblau', 40)} 50%, ${ci('blau', 20)} 100%)`,
  'card-europe': ci('dunkelblau'),
  'card-unity': `linear-gradient(135deg, ${ci('gelb', 20)} 0%, ${ci('hellorange', 20)} 100%)`,
  'card-bremen': `linear-gradient(135deg, ${ci('rot', 20)} 0%, ${ci('rot', 40)} 100%)`,
  /* On the deep blue, only white works - the style guide says so too. */
  'ink-on-europe': weiss,
  /* The shadow is a hint - the cards rest, they don't float. */
  shadow: veil(schwarz, 0.055),
} as const

/**
 * THE OVERVIEW IN THE DARK AND THE RED VARIANT.
 *
 * The room shows the offer for as long as no game is running, so it is part of
 * the evening's picture and not a screen of its own: whoever puts the stage on
 * the dark or the red ground must not get a white poster in front of it. Both
 * variants therefore exist for the same reason the stage's do - and they are
 * partial sets on top of the light one, like `brightPalette` on the dark stage.
 *
 * WHAT TURNS IS THE GROUND AND THE INK ON IT. The five card surfaces stay
 * exactly as they are: they stand for the quizzes - the blue of the Union, the
 * paper of Unity, the red of the Bremen coat of arms - and a card that changed
 * colour with the variant would be saying something about the variant instead
 * of about its quiz. That is what `ink-on-card` is for: the cards stay light,
 * so their text stays dark.
 *
 * THE SHADOW BECOMES THE STAGE'S. On paper a barely visible blue-black hint is
 * enough to let the cards rest; on a dark or a strong ground it would be
 * invisible. `stageExtras.cardShadow` is the value the stage already uses for a
 * card lying on it - the same situation, and therefore not a new number.
 */
export const darkQuizSelectPalette = {
  page: stagePalettes.default.pageTop,
  ink: stagePalettes.default.text,
  'ink-quiet': stagePalettes.default.textMuted,
  shadow: stageExtras.cardShadow,
} as const

/** And the red variant is that one with the ground exchanged - nothing else. */
export const redQuizSelectPalette = {
  ...darkQuizSelectPalette,
  page: redGround,
} as const

export const uiPalette = {
  /*
   * FOUR LEVELS OF ONE TONE. The desk was a ladder of hand-mixed greys; it is
   * the spectrum's `Dunkelgrau`, darkened, at four of its steps - the same
   * order of light and dark as before, so the operator finds their buttons
   * where they were.
   */
  page: ciDark('dunkelgrau', 20),
  /* Cards and bars: control bar, private area, popups, start panel. */
  surface: ciDark('dunkelgrau', 40),
  /* Header and footer - a shade below the cards, so they recede. */
  'surface-quiet': ciDark('dunkelgrau', 20),
  /* Lightened surface INSIDE a card - such as the notes column. */
  'surface-raised': veil(weiss, 0.06),
  control: ciDark('dunkelgrau', 60),
  'control-disabled': ciDark('dunkelgrau', 40),
  input: veil(schwarz, 0.35),
  border: veil(weiss, 0.1),
  /* Divider line inside a card - fainter than the outer edge. */
  'border-quiet': veil(weiss, 0.12),
  /* Edge of a field that should stand out - the stage preview. */
  'border-strong': veil(weiss, 0.24),
  /* Surface behind a popup and background of the preview tile. */
  scrim: veil(schwarz, 0.55),
  'scrim-quiet': veil(schwarz, 0.3),
  text: weiss,
  'text-muted': veil(weiss, 0.5),
  /*
   * And the desk speaks the stage's signals: the same green for what worked,
   * the same red for what did not. They used to be two tones of their own,
   * which meant the room and the desk disagreed about the colour of a correct
   * answer.
   */
  accent: ci('gruen', 80),
  correct: ci('gruen', 80),
  incorrect: ciDark('rot', 80),
  /* Highlighted messages: just a hint of colour, the text carries the message. */
  'warning-soft': veil(ci('hellorange'), 0.16),
  'error-soft': veil(ci('rot'), 0.16),
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
  'bg-top': ciDark('blau', 20),
  'bg-mid': ciDark('dunkelblau', 20),
  'bg-bottom': schwarz,
  'ambient-left': ci('gruen', 80),
  'ambient-right': ci('violett', 60),

  /* Cards and edges of the right-hand column. */
  surface: ciDark('hellblau', 20),
  'surface-quiet': ciDark('blau', 20),
  /* A selected card: the same box, just tinted green. */
  'surface-selected': ciDark('dunkelgruen', 40),
  line: ciDark('dunkelgrau', 60),
  'line-strong': ciDark('dunkelgrau', 80),

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
  option: ciDark('hellblau', 20),
  /* A shade lighter under the pointer - the card lifts instead of flashing. */
  'option-hover': ciDark('dunkelgrau', 60),
  /* The round surface under the icon of an unselected card. */
  'option-icon': veil(weiss, 0.045),

  text: weiss,
  'text-muted': ci('dunkelgrau', 60),
  /* The footnote under the start button - quieter than everything else. */
  'text-quiet': ci('dunkelgrau', 80),

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
  selected: ci('gruen', 80),
  /* Edge, icon and keyboard mark of a selected card. */
  'selected-bright': ci('gruen', 60),
  /* Text ON a selected card - and the quieter line below it. */
  'ink-on-selected': weiss,
  'meta-on-selected': ci('dunkelgrau', 60),

  /*
   * The green of the action, in four steps of ONE tone. There used to be four
   * hand-mixed greens here whose only relation was that they looked alike; the
   * spectrum's `Grün` gives the bar its gradient (80 to 100 percent), the
   * lighter step its edge and the brighter one its mark.
   */
  green: ci('gruen', 80),
  'green-bright': ci('gruen', 60),
  'green-light': ci('gruen', 80),
  'green-deep': ci('gruen'),
  /* Edge on the start button, so its gradient doesn't fray. */
  'green-edge': ci('gruen', 40),
  /*
   * The label ON the green. It is light: the bar is the surface's only full
   * colour, and everything on it belongs to the text next to it.
   */
  'ink-on-green': weiss,
  /*
   * The icon on the filled selection marker. It is small and carries the
   * selection colour at full strength - the opposite rule applies here than
   * on the bar.
   */
  'ink-on-badge': schwarz,
  /*
   * The two other grades. They are order, not meaning - and the spectrum has
   * the order: `Hellgrün` sits next to `Grün`, `Violett` at the far end of it.
   * Violet appears at 60 percent, because the pure tone is a dark plum that
   * would read as a shadow on this ground rather than as a light.
   */
  lime: ci('hellgruen'),
  violet: ci('violett', 60),

  /* The brand panel on the left: a warmer green than the control column on the right. */
  'brand-top': ciDark('dunkelgruen', 40),
  'brand-mid': ciDark('dunkelgruen', 60),
  'brand-bottom': ci('dunkelgruen'),
  'brand-line': ciDark('dunkelgruen', 80),
  'brand-text': ci('hellgrau'),
  /* Shadow and chip background INSIDE the panel - darker than its gradient. */
  'brand-shade': schwarz,

  /* Icon of an unselected card and of the corner buttons. */
  icon: ci('hellgrau'),
  /* Lightening as frosted glass - the tone all veils are mixed from. */
  glass: weiss,
  /* Darkening - shadow under the panels. */
  shade: schwarz,
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
  surface: veil(weiss, 0.62),
  'surface-quiet': veil(weiss, 0.45),
  line: veil(brightInk, 0.1),
  'line-strong': veil(brightInk, 0.16),

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
  'text-quiet': veil(brightInk, 0.45),

  /* The selection carries the blue of the marked answer. */
  selected: brightPalette.accent!,
  'selected-bright': brightPalette.accent!,
  /*
   * On the full blue surface, only white works - title, line below it, icon
   * and checkmark. Previously the ink of the other cards was used here; that
   * was correct as long as the selected card was only tinted blue.
   */
  'ink-on-selected': stageExtras.inkOnStrong,
  'meta-on-selected': veil(weiss, 0.78),

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
  'brand-line': veil(brightInk, 0.1),
  'brand-text': brightPalette.text!,
  'brand-shade': veil(brightInk, 0.08),

  icon: brightPalette.textMuted!,
  /* The veils are mixed from ink, not from light. */
  glass: brightPalette.text!,
} as const

/**
 * THE RED VARIANT OF THE DEVICE'S START SCREEN.
 *
 * It exists because the choice is made per WINDOW and not per screen: the
 * console's select box writes it to the origin's storage, and the touch device
 * in the room reads it from there (`useStageTheme`). Without this set, a red
 * evening would have a red stage and a dark blue foyer device in front of it.
 *
 * ONLY THE GROUND IS NAMED, and it is the same value the stage's ground carries.
 * The cards, the brand panel and the three difficulty colours stay the dark
 * screen's - this variant is the dark one on a red ground, and the components
 * are meant to stay what they are.
 *
 * THE TWO LIGHTS GO OUT. They exist to give an almost black surface depth;
 * that is what the light variant switches them off for, and the reason holds
 * here too - a red ground has presence of its own, and a green glow on it
 * would be neither of the two colours.
 */
export const redStartPalette = {
  'bg-top': redGround,
  'bg-mid': redGround,
  'bg-bottom': redGround,
  'ambient-left': 'transparent',
  'ambient-right': 'transparent',
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
