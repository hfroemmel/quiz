import { z } from 'zod'

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
   * Duration of the correct-answer feedback before the solution appears.
   *
   * IT IS THE BEAT, NOT THE DRAWING. The value once followed a delivered clip,
   * whose check mark was fully drawn after about 1.4 seconds; the mark is drawn
   * in code now and stands complete after 0.6. The two seconds stay because the
   * room needs a moment to read it and the score counts up underneath it
   * meanwhile - a phase as short as the animation would be a flicker.
   */
  correctFeedbackMs: 2_000,
  /** Duration of the wrong-answer feedback - the same beat, a touch shorter. */
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
   * It announces the question number and the category, and it is the one screen
   * of a round on which nothing happens - so its length is the pace of the
   * evening: five questions carry four of these screens.
   *
   * IT WAS THREE SECONDS AND IS NOW HALF OF THAT. The note that stood here said
   * one and a half seconds had been too short to read the category in - the
   * fade is part of that time. It is the number that was asked for
   * nonetheless, and it applies everywhere at once: no host and no mode
   * overrides this value, they all read it from here (`rules.timing` could,
   * and none does). Whoever finds the category unreadable again should raise
   * this value rather than add a second one somewhere else.
   *
   * Nothing else moves with it: the screen, its fade and the transition to the
   * question are unchanged - the server simply schedules that transition
   * earlier (`pause-to-question`).
   */
  pauseScreenMs: 1_500,
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

/*
 * The constants above are literal types (`as const`) so that reading them is
 * exact. What the engine ACCEPTS has to be wider: a package may configure other
 * numbers (see `rulesConfigSchema`). Hence one widened type per group - same
 * keys, plain numbers.
 */
export type ScoringRules = { [K in keyof typeof scoringRules]: number }
export type GameTiming = { [K in keyof typeof gameTiming]: number }
export type SelfServiceTiming = { [K in keyof typeof selfServiceTiming]: number }

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

/* ------------------------------------------------------------------ *
 * Rules in the package configuration
 * ------------------------------------------------------------------ */

/**
 * The rules a content package may set, with the constants above as defaults.
 *
 * ONLY RULES THE ENGINE ALREADY HAS. Nothing here adds a behaviour; every value
 * replaces a constant the engine reads today. A package without `rules`
 * therefore plays exactly as before - that is what the defaults are for, and
 * what the tests pin down.
 *
 * WHY BOUNDS AND NOT FREE NUMBERS: a feedback animation of ten milliseconds or
 * a reveal of an hour would not be a setting but a broken evening. The bounds
 * are wide enough for a house to have a say and narrow enough that the result
 * is still the game this engine plays.
 */
export const rulesConfigSchema = z
  .object({
    scoring: z
      .object({
        firstAnswerPoints: z.number().int().min(0).max(1_000).optional(),
        secondChancePoints: z.number().int().min(0).max(1_000).optional(),
        manualAdjustmentStep: z.number().int().min(1).max(500).optional(),
        minimumScore: z.number().int().min(-1_000).max(0).optional(),
      })
      .optional(),
    timing: z
      .object({
        correctFeedbackMs: z.number().int().min(500).max(10_000).optional(),
        incorrectFeedbackMs: z.number().int().min(500).max(10_000).optional(),
        solutionDelayMs: z.number().int().min(0).max(5_000).optional(),
        imageRevealDurationMs: z.number().int().min(3_000).max(60_000).optional(),
        pauseScreenMs: z.number().int().min(0).max(10_000).optional(),
        /** Only the question stands this long before the answers appear (self-service). */
        questionLeadInMs: z.number().int().min(0).max(15_000).optional(),
      })
      .optional(),
    /**
     * Jokers in an operated game. `false` starts games without a joker supply,
     * and then no view offers one.
     *
     * A self-service game never has jokers - there is nobody at the desk to
     * draw one, and that is a property of the flow profile, not of the content.
     */
    jokers: z.object({ enabled: z.boolean() }).optional(),
    /**
     * After this idle time the device returns to the start screen. Up to an
     * hour; `0` switches the watch off for an attended installation.
     */
    idleTimeoutMs: z.number().int().min(0).max(3_600_000).optional(),
    /**
     * Show the detail text of the explanation after the solution.
     *
     * The text is in the content (`explanation.details`); whether it gets its
     * own step is a decision of the installation.
     */
    showDetailsAfterSolution: z.boolean().optional(),
  })
  .strict()
export type RulesConfig = z.infer<typeof rulesConfigSchema>

/** Every rule value resolved - what the engine and the hosts read. */
export interface ResolvedRules {
  scoring: ScoringRules
  timing: GameTiming
  selfServiceTiming: SelfServiceTiming
  jokersEnabled: boolean
  idleTimeoutMs?: number
  showDetailsAfterSolution: boolean
}

/**
 * Configuration over constants, constant where the configuration says nothing.
 *
 * One place does this resolution, so that service, runtime and kiosk cannot
 * drift apart on what "not configured" means.
 */
export function resolveRules(rules: RulesConfig | undefined): ResolvedRules {
  const timing = stripUndefined(rules?.timing)
  return {
    scoring: { ...scoringRules, ...stripUndefined(rules?.scoring) },
    timing: { ...gameTiming, ...pick(timing, Object.keys(gameTiming)) },
    selfServiceTiming: { ...selfServiceTiming, ...pick(timing, Object.keys(selfServiceTiming)) },
    jokersEnabled: rules?.jokers?.enabled ?? true,
    ...(rules?.idleTimeoutMs === undefined ? {} : { idleTimeoutMs: rules.idleTimeoutMs }),
    showDetailsAfterSolution: rules?.showDetailsAfterSolution ?? false,
  }
}

/*
 * `exactOptionalPropertyTypes` is off in this repository, so an explicit
 * `undefined` in the configuration would overwrite a default with `undefined`
 * in the spread above. Dropping those keys keeps "absent" and "set to
 * undefined" the same thing.
 */
function stripUndefined<T extends object>(source: T | undefined): Partial<T> {
  if (!source) return {}
  return Object.fromEntries(Object.entries(source).filter(([, value]) => value !== undefined)) as Partial<T>
}

/*
 * `timing` in the configuration is one block, while the engine reads two
 * (the timings of every game and those of self-service). Splitting it by the
 * keys of the two defaults keeps the configuration readable and the engine's
 * two groups apart.
 */
function pick<T extends object>(source: T, keys: string[]): Partial<T> {
  return Object.fromEntries(Object.entries(source).filter(([key]) => keys.includes(key))) as Partial<T>
}
