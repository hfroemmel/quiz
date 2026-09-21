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
 * TWO EXCEPTIONS ARE DELIBERATE, and both are named. The children's world
 * takes its colours from its own illustrations, and a drawn frame does not
 * follow a spectrum. The ground of the red variant is the tone that variant
 * was commissioned with (`redGround`). Both stay literals below, and the guard
 * test states them rather than allowing literals in general.
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
 *
 * AND IT IS THE ONE COMMISSIONED VALUE OF THE ADULTS' WORLD. The variant was
 * ordered with this tone, and the client confirmed it after seeing the
 * spectrum's nearest step in its place: `ci('rot', 80)` is `#CD3363`, fourteen
 * units away and a tone nobody separates at two metres - but the order names
 * this one, and an order outranks a rule the house set for itself. The guard
 * test states it as an exception rather than tolerating it, exactly as it does
 * for the children's illustrations.
 */
const redGround = '#CA2F56'
/*
 * The tile on that ground - the commissioned tone, carried a few steps into
 * the dark. It is written out and not computed: the red is a commissioned
 * colour rather than a step of the spectrum, so nothing here derives a second
 * one from it (see `redPalette`).
 */
const redTile = '#a22644'

/*
 * THE HOUSE TONES - the colours this system was set to, and they are not
 * steps of the spectrum.
 *
 * The signals, the grades of the start menu, the ink on a chip and the card
 * of the Europe quiz name values of their own: a cyan the light start menu
 * marks its selection with, one green in four grades where `Gruen` stood, and
 * the European blue on its card. They are written out because there is
 * nothing to derive them from - no step lies close enough to call this a
 * rounding.
 *
 * THEY STAND HERE AND NOWHERE ELSE. Six of them are read by more than one
 * palette (the stage, its light variant, the start menu), and a copy in one
 * of them is how two surfaces drift apart. The guard in `palette.test.ts`
 * lists them by name, so a value that is neither a step nor one of these
 * still fails there.
 */
const houseCyan = '#00acd3'
const houseGreen = '#8cd000'
const houseGreenBright = '#a8e063'
const houseGreenLight = '#b7f0a1'
const houseGreenDeep = '#5a9e2b'
const houseRed = '#ca2f56'
const europeBlue = '#003399'
const brightInkMuted = '#999999'
/*
 * THE GROUND OF THE DARK STAGE, in three plain greys, and the tones that sit
 * on it. The spectrum's `Dunkelgrau` carries a blue cast at every step; these
 * are the neutral greys the design asks for, written out because no step of
 * the spectrum is neutral. `houseWhite` and `houseBlack` are the short forms
 * the design uses - they are values of their own to the guard, so they stand
 * here rather than being spelled out twice.
 */
const houseInk = '#111'
const houseInkSoft = '#232323'
const houseInkLift = '#343434'
const houseChip = '#f2f2f2'
const houseWhite = '#fff'
const houseBlack = '#000'
/*
 * The withdrawn steps: a near-white on the dark stage, a mid grey on paper.
 * They stand beside the accent they belong to - what marks the player on turn
 * is a brightness here, not a hue, so the quiet step is the same colour with
 * the light taken out.
 */
const houseInkFaint = '#eee'
const houseInkMid = '#666'
/*
 * Two more plain steps: the line on the dark start menu, and the lower stop of
 * the grey card gradient in the offer overview. Like the greys above they are
 * written out, because no step of the spectrum is neutral.
 */
const houseInkLine = '#333'
const houseChipEdge = '#ddd'

/**
 * Cool, slightly bluish system for the adult stage.
 *
 * The surface colours are semi-transparent: tiles, letters and answer bars
 * are veils over the stage's own ground rather than opaque boxes on it, so
 * the order of surfaces stays readable. They used to let a blurred question
 * image shine through as well - that layer is gone. They are neutral
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
    pageTop: houseInk,
    pageBottom: houseInkSoft,
    stageTop: houseInkSoft,
    stageBottom: houseInkLift,
    controls: houseInk,
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
    accent: houseWhite,
    accentQuiet: houseInkFaint,
    primary: houseWhite,
    /* The primary is near-white here, so what stands on it is the dark ink. */
    primaryInk: houseBlack,
    solution: houseGreen,
    /* The green is a bright one - what stands on it is the dark ink. */
    solutionInk: houseBlack,
    /*
     * Same tone as the bar: the letter and the answer are ONE surface, split
     * only by a seam. Two greens side by side read like two separate
     * statements - the darker chip looked like a second state.
     */
    solutionChip: houseGreen,
    solutionChipInk: houseBlack,
    correct: houseGreen,
    incorrect: houseRed,
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
    /* A strong red ground - the drawn world writes on it in white. */
    primaryInk: '#FFFFFF',
    solution: '#6FBE6B',
    /* Drawn signal colours - the world writes on both of them in its own ink. */
    solutionInk: '#0E090C',
    solutionChip: '#F9CD36',
    solutionChipInk: '#0E090C',
    correct: '#6FBE6B',
    incorrect: '#D98B93',
    text: '#0E090C',
    textMuted: 'rgba(14, 9, 12, 0.6)',
  },
}

/*
 * THE INK OF THE LIGHT VARIANT IS PLAIN BLACK.
 *
 * It used to be `Dunkelgrau` at its deepest step - the spectrum's own near
 * black, on the grounds that a page of running text reads better in a soft
 * black than in a pure one. This variant names black itself now, and every
 * veil on its paper is mixed from that (`veil(schwarz, …)`), so the greys of
 * its lines, veils and quiet type all come from one value.
 */

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
  /*
   * ONE PAPER, NOT THREE STEPS OF IT. The light variant used to grade its
   * ground from white down to a light grey; it stands on one tone now, and
   * what separates the areas are the veils above it.
   */
  pageTop: houseInkFaint,
  pageBottom: houseInkFaint,
  stageTop: houseInkFaint,
  stageBottom: houseInkFaint,
  controls: houseInkFaint,
  /* Not a meaning but a withdrawal: the locked-out player on paper. */
  accentQuiet: houseInkMid,
  /* A veil stays a veil - just made of ink instead of light. */
  tile: veil(schwarz, 0.06),
  tileDisabled: veil(schwarz, 0.04),
  tileQuiet: veil(schwarz, 0.05),
  option: veil(schwarz, 0.05),
  accent: schwarz,
  /*
   * ON PAPER THE PRIMARY IS THE INK, not the green: the green of this system
   * carries the light stage, and on white it is a signal without a ground to
   * sit on. What names the rank here is the text colour itself.
   */
  primary: schwarz,
  /*
   * AND THE INK ON IT IS THE ONE EXCEPTION. The primary of this variant is
   * black where the dark stage has it near-white, so the two cannot share the
   * ink: white here, dark there. That is the whole reason `primaryInk` is a
   * token of its own.
   */
  primaryInk: houseWhite,
  /*
   * THE SIGNALS ARE NOT NAMED AGAIN HERE. Solution, right, wrong and the inks
   * that go on them are the same values in both variants, so this one lets
   * them through from the fallback layer instead of repeating them - a second
   * copy is how the two would drift apart.
   */
  text: schwarz,
  textMuted: brightInkMuted,
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
 * AND THERE IS NOTHING BEHIND THEM - HERE OR ANYWHERE. This variant was the
 * first without a picture behind the scene: the other two repeated the
 * question image there and let it through the veils, and under a commissioned
 * ground that pulled the room's tone somewhere else with every photo. The
 * layer is gone from every variant now, so the veils composite over one flat
 * surface - which is what makes five values enough for a whole variant.
 *
 * THE MEANING COLOURS STAY, and that is a decision, not an omission: blue
 * marks the selection and the player whose turn it is, green the right answer,
 * red the wrong one. A red ground makes the wrong-answer red harder to tell
 * apart than it is on grey - it is the one place where this variant is weaker
 * than the two others, and moving the token would break the agreement that
 * the three signals mean the same thing in every variant.
 *
 * THE GROUND IS THE COMMISSIONED `#CA2F56`, and it is not a step of the
 * spectrum. It and the tile tone carried out of it (`redTile`) are the two
 * values of this world that are not - and the guard in `palette.test.ts`
 * names exactly these two, so a third one still fails there. It
 * stood at `Rot` 80 percent for one release, because that step is fourteen
 * units away and the house had just put every colour on the spectrum; the
 * client asked for their tone back, and a commissioned colour is not something
 * a conformance rule overrules.
 */
export const redPalette: Partial<DesignColors> = {
  pageTop: redGround,
  pageBottom: redGround,
  stageTop: redGround,
  stageBottom: redGround,
  controls: redGround,

  /*
   * THE TILES CARRY THEIR OWN TONE HERE. In the dark world they are white
   * veils over an almost black ground; over this red the same veils turn
   * milky, and a tile reads as a pale patch instead of a surface. All four
   * therefore take the darker tone - a tile that is switched off or held back
   * is still a tile, and on this ground the surface is what says so.
   */
  tile: redTile,
  tileDisabled: redTile,
  tileQuiet: redTile,
  option: redTile,
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
  /**
   * Text on accent or player colour - DARK on the dark stage.
   *
   * Its strong areas are the near-white primary and the white accent, and what
   * stands on those has to be dark. The light and the red variant carry strong
   * areas of their own and say so themselves (`brightStageExtras`,
   * `redStageExtras`), because this token belongs to the stage and not to a
   * colour set: it cannot be inherited away by a variant that names only
   * `--color-` values.
   */
  inkOnStrong: houseBlack,
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
   * LIGHT INK FOR TYPE THAT LIES ON A PICTURE OR ON A MEANING COLOUR.
   *
   * Two places need it, and both for the same reason: the mark on the
   * right/wrong disc, and the licence line in the lower left of a photo in the
   * children's world. What is under them is not a surface of the theme - it is
   * a strong green, a strong red, or somebody's photograph - so the ink cannot
   * follow the variant the way `inkOnStrong` does: that one turns with the
   * SURFACE, and on the bright stage it made the checkmark black.
   *
   * White in every world, therefore, and only ever over something that carries
   * it - never on the stage's own ground.
   */
  inkOnMotif: houseWhite,
  /**
   * Outline around light text sitting on a busy background.
   *
   * In the kids world, the score and countdown sit over an illustration with
   * light and dark areas. Text without an outline would disappear in places
   * there - first of all in the hall, seen from twenty metres away.
   */
  inkOutline: schwarz,
  /**
   * THE CHIP THAT ENDS A ROUND - a light surface with dark blue on it.
   *
   * It is the one control that sits ON the running game, and it looks the same
   * in every world for exactly that reason: a player who wants out of a round
   * should not have to find a different button on the dark stage than on paper
   * or over the children's drawing. Following the theme would give it four
   * appearances and, on the dark ground, the least visible one.
   *
   * `Hellgrau` at 20 percent carries `Dunkelblau` whole at a contrast of about
   * seven to one - the style guide's own pairing, and readable on all four
   * grounds because the surface is opaque.
   */
  chip: houseChip,
  inkOnChip: houseBlack,
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
 * THE PAGE AND THE CARD NOW NAME THE SAME INK.
 *
 * The poster used to write on a card in `Dunkelblau` at its deepest step,
 * because a light card is not the page. Both carry the house black now, and
 * the card keeps its own NAME for it (`ink-on-card`) - a variant that darkens
 * the page still leaves the cards alone, which is what the two names are for.
 */

export const quizSelectPalette = {
  page: houseWhite,
  ink: '#000',
  'ink-quiet': houseInkMid,
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
  'ink-on-card': houseBlack,
  'meta-on-card': houseInkMid,
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
  'card-bundestag': `linear-gradient(135deg, ${houseChip} 0%, ${houseChipEdge} 100%)`,
  'card-kids': `linear-gradient(180deg, ${ci('hellblau', 60)} 0%, ${ci('hellblau', 40)} 50%, #cbc9f1 100%)`,
  'card-europe': europeBlue,
  /* The same grey paper as the Bundestag card - one value, written twice. */
  'card-unity': `linear-gradient(135deg, ${houseChip} 0%, ${houseChipEdge} 100%)`,
  /* The same grey paper as the Bundestag card - one value, written once. */
  'card-bremen': `linear-gradient(135deg, ${houseChip} 0%, ${houseChipEdge} 100%)`,
  /* On the deep blue, only white works - the style guide says so too. */
  'ink-on-europe': houseWhite,
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
  /*
   * The poster keeps the ground it was drawn on. The stage's own page is a
   * plainer grey now (`houseInk`); this surface is not the stage, and the
   * spectrum's deepest `Dunkelgrau` is what its cards were measured against.
   */
  page: houseBlack,
  ink: houseWhite,
  'ink-quiet': stagePalettes.default.textMuted,
  shadow: stageExtras.cardShadow,
} as const

/** And the red variant is that one with the ground exchanged - nothing else. */
export const redQuizSelectPalette = {
  ...darkQuizSelectPalette,
  page: redGround,
  /* On the commissioned ground the type is white in full - not the short form. */
  ink: weiss,
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
  control: houseInkLift,
  'control-disabled': houseInkSoft,
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
   * NO GROUND AND NO LIGHTS ANY MORE. This menu used to carry a diagonal
   * gradient with a green and a violet light on it; it stands on the plain
   * dark ground now, and the two variants that do name a ground state it
   * themselves (`brightStartPalette`, `redStartPalette`).
   */

  /* Cards and edges of the right-hand column. */
  surface: ciDark('hellblau', 20),
  'surface-quiet': houseBlack,
  /* A selected card: the same box, just darker. */
  'surface-selected': houseBlack,
  line: houseInkLine,
  'line-strong': houseInkLine,

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
  option: houseInk,
  /* A shade lighter under the pointer - the card lifts instead of flashing. */
  'option-hover': houseInkLine,
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
  /* Edge, icon and keyboard mark of a selected card - the same green as above. */
  'selected-bright': ci('gruen', 80),
  /* Text ON a selected card - and the quieter line below it. */
  'ink-on-selected': weiss,
  'meta-on-selected': ci('dunkelgrau', 60),

  /*
   * The green of the action, in four steps of ONE tone. There used to be four
   * hand-mixed greens here whose only relation was that they looked alike; the
   * spectrum's `Grün` gives the bar its gradient (80 to 100 percent), the
   * lighter step its edge and the brighter one its mark.
   */
  green: houseGreen,
  'green-bright': houseGreenBright,
  'green-light': houseGreenLight,
  'green-deep': houseGreenDeep,
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
   * THE BRAND PANEL IS BLACK - ground, line, type and shade alike.
   *
   * It used to be a green gradient with a lighter line and grey type on it,
   * warmer than the control column beside it. The panel carries the drawing
   * now, and a colour of its own would compete with it; what is left is the
   * dark it stands on. The two grades `lime` and `violet` went with it: they
   * ordered a difficulty this menu no longer shows.
   */
  'brand-top': houseBlack,
  'brand-mid': houseBlack,
  'brand-bottom': houseBlack,
  'brand-line': houseBlack,
  'brand-text': houseBlack,
  'brand-shade': houseBlack,

  /* Icon of an unselected card and of the corner buttons. */
  icon: '#bbb',
  /* Lightening as frosted glass - the tone all veils are mixed from. */
  glass: houseWhite,
  /* Darkening - shadow under the panels. */
  shade: houseBlack,
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
   * THE RANK AND THE INK ON IT, for the screen in front of the stage. The
   * start bar reads these two, so a menu whose action is a black surface
   * carries light type on it without the rule having to know the variant.
   */
  primary: schwarz,
  primaryInk: houseWhite,
  /*
   * WHITE, AND FULLY SO.
   *
   * The dark variant's background is a gradient with two coloured lights -
   * that gives an almost black surface depth. On paper this isn't needed:
   * the cards stand out through their edge, not through the background.
   * Both lights are therefore switched off here, instead of extending the
   * stylesheet rule with a second variant.
   */
  /*
   * The paper of this screen is white in full - it states the value rather
   * than following the stage's, which writes the short form.
   */
  'bg-top': weiss,
  'bg-mid': weiss,
  'bg-bottom': weiss,
  'ambient-left': 'transparent',
  'ambient-right': 'transparent',

  /*
   * Frosted glass made of light, not of ink: on white, a veil of ink is just
   * a grey box. That applies to the settings window and the confirmation
   * prompt above it - the cards next to it go their own way, see `option`.
   */
  surface: veil(weiss, 0.75),
  'surface-quiet': veil(weiss, 0.45),
  line: veil(schwarz, 0.1),
  'line-strong': veil(schwarz, 0.16),

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
  /*
   * THE LIGHT INK OF THIS SCREEN IS ITS OWN. The stage writes dark on its
   * strong areas now (`stageExtras.inkOnStrong`); here a filled card, the
   * start bar and the badge are deep colours, and only white holds up on
   * them. The four names below therefore state the value instead of
   * following the stage's.
   */
  'option-icon': weiss,
  /*
   * AND THE SELECTED CARD IS FULLY FILLED WITH IT - not tinted blue, but the
   * same blue that a tapped answer carries in the game. It is the same value
   * as `selected` below; that two names point to one colour here is exactly
   * the point: in the dark variant they are two different colours.
   */
  /*
   * AND IT NAMES ITS OWN BLUE. The stage carries the house cyan now; the
   * light start selection keeps the spectrum's blue it was built with, so
   * this screen is not dragged along by a change made for the stage. The
   * four names below hold the same value for the same reason.
   */
  'surface-selected': houseCyan,

  text: houseBlack,
  'text-muted': veil(schwarz, 0.6),
  'text-quiet': veil(schwarz, 0.45),

  /* The selection carries the blue of the marked answer. */
  selected: houseCyan,
  'selected-bright': houseCyan,
  /*
   * On the full blue surface, only white works - title, line below it, icon
   * and checkmark. Previously the ink of the other cards was used here; that
   * was correct as long as the selected card was only tinted blue.
   */
  'ink-on-selected': houseWhite,
  'meta-on-selected': houseWhite,

  /*
   * The start button is the same button as "Submit answer and reveal": one
   * surface, one green, white text. The dark variant's gradient therefore
   * runs here between two identical tones - it disappears without the
   * stylesheet rule needing to know about it.
   */
  green: houseGreen,
  'green-bright': houseGreen,
  'green-light': houseGreen,
  'green-deep': houseGreen,
  'green-edge': houseGreen,
  /* The green is a bright one - what stands on it is the dark ink. */
  'ink-on-green': houseBlack,
  'ink-on-badge': weiss,

  /* The brand panel sits on the same paper as everything else. */
  'brand-top': weiss,
  'brand-mid': weiss,
  'brand-bottom': weiss,
  'brand-line': veil(schwarz, 0.1),
  'brand-text': houseBlack,
  'brand-shade': veil(schwarz, 0.08),

  icon: veil(schwarz, 0.6),
  /* The veils are mixed from ink, not from light. */
  glass: houseBlack,
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
 * The children's world names its own light ink - twice, and both times for a
 * screen that stands OUTSIDE the stage.
 *
 * The stage's `inkOnStrong` is the dark one (the adults' world writes dark on
 * its near-white primary). On the drawn paper the strong areas are the world's
 * own reds and blues, and what stands on them is white. The stage itself gets
 * that value from the running quiz's theme; these two screens have no theme
 * yet, so they state it here.
 *
 * NOTE THE PREFIXES - they are deliberate and do not follow the selector. The
 * start screen sets a STAGE token, because the components it shows read
 * `--stage-inkOnStrong`; the offer overview sets a START token, for the card
 * it marks as chosen. Each names the token its own content actually reads.
 */
export const kidsStartStage = { inkOnStrong: houseWhite } as const

/**
 * The stage tokens the light and the red variant name for themselves.
 *
 * `inkOnStrong` lives in `stageExtras` and is emitted once, into the fallback
 * layer, from where it is handed down to the stage. A variant that wants
 * another value has to state it in its own rule, which is what these two are
 * for: those rules sit on the stage element itself, and what an element says
 * itself beats every inherited value.
 *
 * ON PAPER the strong areas are the black primary and the black accent, so
 * what stands on them is light.
 *
 * AND IN THE RED VARIANT IT IS THE DARK INK - the same as on the dark stage,
 * because the strong areas here ARE the dark stage's: this variant names the
 * ground and the tile on it, and nothing else (`redPalette`). What a score
 * card of the player on turn and a tapped answer carry is therefore the white
 * accent of the dark world, and on white the light ink is nothing at all -
 * that was a white card with white writing on it in the room, and a white
 * answer bar with no letter and no answer on it.
 *
 * It is written out nonetheless rather than left to the fallback layer: the
 * value would then be whatever the document around the stage says, and the
 * variant would have no way of saying otherwise.
 */
export const brightStageExtras = { inkOnStrong: houseWhite } as const
export const redStageExtras = { inkOnStrong: houseBlack } as const
export const kidsOverviewStart = { 'ink-on-selected': houseWhite } as const

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
