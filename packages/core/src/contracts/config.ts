/**
 * Central, typed configuration of game rules and the timings that matter to the rules.
 *
 * "Matter to the rules" means: the server needs these values to decide
 * deterministically and testably when a phase ends. Purely visual values (easing,
 * scene fade, confetti duration) live in the presentation layer
 * (`packages/react/src/presentation/animationPresets.ts`) and import from here, so
 * that there is no second source of truth.
 */

/** Scoring rules (specification 14.1). */
export const scoringRules = {
  /** First correct answer. */
  firstAnswerPoints: 100,
  /** Correct second chance, or a correct image answer after at least one failed attempt. */
  secondChancePoints: 50,
  /** Wrong answer, passing, and resolving without an answer. There is no deduction. */
  noPoints: 0,
  /** Step size of a manual correction. */
  manualAdjustmentStep: 50,
  /** By default the score does not drop below zero. */
  minimumScore: 0,
} as const

/**
 * Timings that drive the state transitions of the rules.
 *
 * The server sets a fallback timer for every timed phase. The presentation may
 * report completion, but the transition never depends on a browser delivering an
 * `animationend` event reliably (specification 22.1).
 */
export const gameTiming = {
  /**
   * Duration of the correct-answer animation before the solution appears.
   *
   * The value follows the delivered motion graphic `correct.webm`: the check mark
   * is fully drawn after about 1.4 seconds, the confetti has run out after that.
   * A shorter phase would cut into the middle of the statement.
   */
  correctFeedbackMs: 2_000,
  /** Duration of the wrong-answer animation (the cross is complete after about 1.4 seconds). */
  incorrectFeedbackMs: 1_800,
  /** Short, defined pause between feedback and the solution view. */
  solutionDelayMs: 250,
  /**
   * Confirmed reveal duration of the image-reveal question: exactly ten seconds.
   * This is the only timing value the specification makes binding.
   */
  imageRevealDurationMs: 10_000,
  /**
   * Duration of the pause/logo screen between two questions.
   *
   * It announces the question number and the category. One and a half seconds
   * were not enough: the category fades in, and the room should be able to read
   * it before the question stands.
   */
  pauseScreenMs: 3_000,
} as const

/**
 * The grid of the image reveal.
 *
 * The image lies under a cover of tiles that disappear one after another during
 * the reveal. Everything that determines this resolution is here - grid size,
 * order and tile motion. Whoever wants the image uncovered differently changes
 * nothing but these numbers.
 *
 * Why this is a rule and not purely visual: the order decides WHAT a player sees
 * WHEN. It therefore belongs to fairness and is derived from the progress, not
 * from an animation running alongside.
 */
export const revealGrid = {
  columns: 6,
  rows: 4,
  /**
   * Share of randomness in the order.
   *
   * 0 reveals strictly from the outside in - visible as a wandering ring, and
   * therefore dull. 1 would reveal purely at random and might give the motif away
   * at once. In between the picture of the design appears: scattered tiles whose
   * centre closes last.
   */
  jitter: 0.55,
  /**
   * Where the motif is assumed to be, as fractions of the image width and height.
   *
   * Without image analysis this is an assumption, but a sound one: photos put
   * their motif in the middle, and the sky is at the top. The point therefore sits
   * a little below the centre - where buildings, faces and landmarks stand, while
   * the edge tiles show early surroundings.
   */
  focus: { x: 0.5, y: 0.58 },
  /** Time in which a single tile disappears. */
  tileFadeMs: 320,
} as const

/**
 * Timings that exist only in the self-service profile.
 *
 * They replace exactly the moments where a human would otherwise advance the
 * game. They therefore matter to the rules and live here - not in the
 * presentation.
 */
export const selfServiceTiming = {
  /**
   * How long only the question stands before the answers appear.
   *
   * Nobody reads the question aloud at the device. This pause replaces that: it
   * gives both players time to read the question at all before the faster thumb
   * decides over the answers. Meanwhile the buzzers are closed - the server does
   * not even send the options yet.
   *
   * Changing it changes the fairness of the game, not its pace.
   */
  questionLeadInMs: 2_500,
  /** Short lead-in before a video starts by itself. */
  videoLeadInMs: 500,
} as const

/** Parameters of the selection algorithm (specification 17.2). */
export const selectionTuning = {
  /** Minimum size of the candidate window among the questions unused for the longest time. */
  minWindowSize: 3,
  /** Share of the available candidates that additionally falls into the window. */
  windowFraction: 0.2,
  /**
   * Weighting inside the window. 0 = uniform, 1 = linear in favour of the oldest
   * question. Deliberately light, so the selection does not feel rigid.
   */
  olderBias: 0.5,
} as const

/** Warning thresholds of the content validation (specification 17.5 and 24.4). */
export const contentThresholds = {
  /** Below this number of candidates per slot a warning is raised. */
  smallPoolWarning: 8,
  /** Below this many repetition-free games per preset a warning is raised. */
  minGamesWithoutRepetition: 3,
  /** From this length on a prompt counts as very long. */
  longPromptChars: 220,
  /** From this length on an answer text counts as very long. */
  longOptionChars: 90,
  /**
   * Permitted number of answer options of a choice question.
   *
   * Below two options there is nothing to choose - a single "choice" would be the
   * solution itself. Such questions belong in `acceptedAnswerText` as a free
   * answer. The design bounds the top: four rows with the letters A to D.
   */
  minChoiceOptionCount: 2,
  maxChoiceOptionCount: 4,
} as const

export type ScoringRules = typeof scoringRules
export type GameTiming = typeof gameTiming
export type SelfServiceTiming = typeof selfServiceTiming

/**
 * A grid that may differ from the default.
 *
 * The domain functions take this type and not the constant: that way the reveal
 * can be tested with a tiny grid without touching the default.
 */
export interface RevealGrid {
  columns: number
  rows: number
  jitter: number
  focus: { x: number; y: number }
  tileFadeMs: number
}
