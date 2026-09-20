/**
 * Public and private view models (specification 19).
 *
 * The complete `GameState` is never distributed unfiltered. The filtering
 * happens on the server in `packages/domain/src/projection.ts`. Hiding by CSS on
 * the stage screen would not be enough, because the solution would already have
 * been transmitted.
 */
import type { QuestionExplanation, QuestionPresentationType, ThemeSkin } from './content'
import type { AttemptOutcome, GamePhase, PlayerCount, PlayerId } from './state'
import type { JokerSequence, JokerType } from './joker'
import type { ActorRole, CommandType } from './commands'

/** Scenes of the stage screen. Derived from the phase, never set freely. */
export const publicScenes = [
  'start',
  'pause',
  'question',
  'reveal',
  'feedback',
  'solution',
  'result',
] as const
export type PublicScene = (typeof publicScenes)[number]

/**
 * Content-driven presentation hints of the active quiz mode.
 *
 * DELIBERATELY WITHOUT COLOURS AND FONTS: presentation is the host's concern.
 * The view model names only what comes from the content - the design world as a
 * recommendation and the branding assets. Colours and fonts come from the theme
 * layer of the interface (`@hfroemmel/quiz-themes`).
 */
export interface PublicTheme {
  id: string
  /** Design world of the stage. If missing, the dark stage applies. */
  skin?: ThemeSkin
  logoUrl?: string
  startVisualUrl?: string
  /**
   * Title on the start visual. Dropped when the start graphic already contains
   * the title - as in the kids quiz.
   */
  startTitle?: string
  /** Description below the title of the start board. Like the title: may be missing. */
  startDescription?: string
  presentationAnimationSetId?: string
}

export interface PublicOption {
  id: string
  text: string
  /** Set only in the solution view; never transmitted before. */
  /**
   * `chosen` marks the logged answer while nothing is resolved yet - the room
   * sees what the player committed to, but not whether it is right. `correct`
   * and `chosen-incorrect` only arrive in the solution scene.
   */
  state?: 'chosen' | 'correct' | 'chosen-incorrect'
  /**
   * Taken out of play by a 50:50.
   *
   * A flag of its own, not a fourth `state`: an option can be eliminated AND be
   * the correct one, which is exactly what the solution scene shows. It also
   * keeps the option in the list - the clients strike it out in place instead of
   * relaying out the answers under the players' eyes.
   */
  eliminated?: boolean
}

export interface PublicQuestion {
  /**
   * Id of the question currently on screen.
   *
   * IT IS NOT A DISPLAY VALUE but an identity: a client that has to tell what
   * it is showing apart from what a message is about - the picture it has
   * decoded, a patch that arrives - compares this, not the text.
   */
  id: string
  prompt: string
  presentationType: QuestionPresentationType
  imageUrl?: string
  /**
   * The picture's licence line, as an editor wrote it.
   *
   * IT TRAVELS WITH THE PICTURE and not beside it: wherever a photo is shown,
   * the line that names its origin belongs on the screen, and a client that
   * had to look it up somewhere else would sooner or later show one without
   * the other. Absent means the content names no origin - then nothing is
   * shown; the gap is reported where the content is built
   * (`uncreditedImages`), not on the stage.
   */
  imageCredit?: string
  /**
   * Category line above the prompt: the label of the FIRST category of the
   * question (design addition). Pure display value - the client derives nothing
   * from it.
   */
  categoryLabel?: string
}

/** Deliberately contains only what may be publicly visible. */
export interface PublicSolution {
  /** Text of the correct answer. */
  answerText: string
  imageUrl?: string
  /** The licence line of THIS picture - see `PublicQuestion.imageCredit`. */
  imageCredit?: string
  /**
   * Background of the question, where the installation asks to show it.
   *
   * Present only with `rules.showDetailsAfterSolution`, and then only
   * `explanation.details` - a device has nobody to tell the background, so the
   * players read it themselves. In a hall the field stays absent: there the
   * moderator tells it, and a screen writing it out would compete with them.
   */
  details?: string
}

/**
 * The joker of one player, as far as anybody watching may know.
 *
 * DELIBERATELY WITHOUT THE TYPE. The stage shows one neutral card, and it shows
 * it while the joker is there; which variant it was spent as is a matter for the
 * operator's desk, where it stays readable. Putting the type here would invite a
 * screen that announces "50:50 used" - and that is a piece of information the
 * room is told out loud, not shown as an icon.
 */
export interface PublicJokerStatus {
  used: boolean
}

export interface PublicScore {
  playerId: PlayerId
  label: string
  score: number
  /** Is it this player's turn? */
  active: boolean
  /** Locked for this question (the second chance lies with the other player). */
  locked: boolean
  /**
   * The joker of this player - ONLY in a game that has jokers.
   *
   * It sits on the score and not next to it because that is where it is shown:
   * the card leans against this player's own scoreboard. Missing means "this
   * game has no jokers" - a kiosk or touch game - and a client that finds
   * nothing here renders exactly what it rendered before the feature existed.
   */
  joker?: PublicJokerStatus
}

/** Everything the stage screen needs to render the reveal in sync. */
export interface PublicRevealState {
  status: 'idle' | 'running' | 'paused' | 'completed'
  durationMs: number
  /**
   * Time already elapsed at `serverTimeMs` of the snapshot.
   * While `running` the client continues with its local clock and takes the
   * server value again with every snapshot (drift correction).
   */
  elapsedMs: number
}

export interface PublicFeedback {
  outcome: AttemptOutcome
  playerId: PlayerId | null
  awardedPoints: number
}

export interface PublicResult {
  /**
   * In a solo game there is neither a winner nor a draw, only the player's own
   * result. The result scene decides on this what it shows - it does not derive
   * it from the number of scores.
   */
  mode: 'duel' | 'solo'
  /** `null` means a draw - and always in a solo game. */
  winnerPlayerId: PlayerId | null
  /** Always `false` in a solo game. */
  isDraw: boolean
  scores: PublicScore[]
  /** Solo game only: how many questions were answered correctly. */
  solo?: { correctAnswers: number; questionCount: number }
}

export interface PublicQuizViewModel {
  scene: PublicScene
  phase: GamePhase
  theme: PublicTheme
  /**
   * The quiz type of the running game, as the server confirmed it.
   *
   * Missing while none runs - and for games that begin without a quiz choice.
   * The stage READS it and derives nothing from it: theme and question pool
   * already stand resolved in the rest of this view.
   */
  quizId?: string
  /**
   * The quiz offers of the house - what there is to play, as it is announced.
   *
   * WHAT FOR: before the first game the stage shows WHAT there is to play here.
   * That is an announcement to the room and not a choice: no command follows
   * from this list, and which quiz runs is decided by the desk alone.
   *
   * THE MOTIF BELONGS IN IT. A card is recognised in the hall by its picture
   * before its name is read, and the picture is content
   * (`quizzes[].artworkAssetId`) like the name - the stage used to keep a table
   * of five images in its own code, and a sixth quiz stood there without one.
   * `emphasis` says which card takes the whole row, for the same reason.
   *
   * Audience, pools, presets and theme are DELIBERATELY not in it. They would be
   * configuration, and the stage must not be able to derive any.
   */
  quizOffers: {
    id: string
    label: string
    subtitle?: string
    artworkUrl?: string
    emphasis: 'wide' | 'regular'
  }[]
  /**
   * The offer the desk has chosen but not yet started.
   *
   * IT IS STILL NOT A CHOICE THE ROOM MAKES - it is what the room is told is
   * coming. The console used to keep this in its own window, so the card was
   * marked on the operator's screen and nowhere else; the id travels with the
   * state now, and the announcement marks the same card as the desk.
   *
   * Absent means nothing has been chosen yet, and then no card is marked.
   * Nothing else about the choice is public: the level and the audience are
   * configuration, which the stage must not be able to derive.
   */
  selectedQuizId?: string
  question?: PublicQuestion
  /**
   * Category of the NEXT question - exclusively for the interstitial screen.
   *
   * The pause screen stays free of question content. The category is a heading,
   * not information about the answer; it announces what is coming up. Prompt,
   * options and media are still not transmitted.
   */
  upcomingCategoryLabel?: string
  visibleOptions?: PublicOption[]
  /**
   * The joker draw running on the current question, if any.
   *
   * It says WHOSE draw it is and HOW FAR it has got; which answers a 50:50
   * removed is on the options themselves. `type` is absent while the card is
   * still turning - see `projection.ts`.
   *
   * No question id: that is moderator-only information everywhere else, and it
   * stays that way.
   */
  jokerDraw?: PublicJokerDraw
  visibleSolution?: PublicSolution
  feedback?: PublicFeedback
  playerScores: PublicScore[]
  currentPlayer?: PlayerId
  progress: { current: number; total: number }
  reveal?: PublicRevealState
  result?: PublicResult
  soundEnabled: boolean
  /** Locale this view is in. */
  locale: string
  /**
   * Interface labels, as far as the content brings any.
   *
   * The client keeps its German versions itself and only looks up here: this
   * way a quiz runs without a single entry, and a new language needs no new
   * program version.
   */
  texts?: Record<string, string>
  /** Running presentation transition, so that scenes animate in sync. */
  transition?: { id: string; startedAtServerMs: number; durationMs: number }
  /** Server time of the snapshot. Basis of every client-side interpolation. */
  serverTimeMs: number
  revision: number
}

/**
 * View of the players at the touch device.
 *
 * It is the public view - so here too the solution is only transmitted in the
 * solution scene - plus the list of the commands currently possible. That way
 * the touch client, too, derives its controls from the server and does not
 * rebuild the rules.
 */
export interface PlayerQuizViewModel extends PublicQuizViewModel {
  allowedCommands: CommandType[]
  /**
   * Only for the start view at the device: what can be chosen there. As for the
   * operator, the list comes from validated configuration.
   */
  catalog: CatalogViewModel
}

/** Only for operator and moderator. Never to stage clients. */
export interface PrivateSolution {
  answerText: string
  correctOptionId?: string
  acceptedAnswerText?: string[]
}

export interface AuditEntry {
  id: number
  atMs: number
  actorRole: ActorRole
  /** Preformatted plain text, e.g. "21:14:08 - Spieler 2 - +100 - richtige Antwort". */
  message: string
  category: 'game' | 'buzzer' | 'answer' | 'score' | 'phase' | 'content' | 'system'
}

export interface OperatorDiagnostics {
  contentVersion: string
  eventDayId: string
  /** Selection rationale of the current question. */
  selectionRationale?: string
  connectedClients: { role: ActorRole; clientId: string }[]
  /** Session code for the moderator and further presentation clients in the LAN. */
  sessionCode?: string
  lanUrls?: string[]
  /** Errors that concern the operator, in plain language. */
  warnings: string[]
}

export interface AnsweringContext {
  /** Does the server now expect a logged option or a manual verdict? */
  evaluationMode: 'option-comparison' | 'manual-correct-incorrect'
  loggedOptionId?: string
  loggedManualVerdict?: 'correct' | 'incorrect'
  attemptNumber: number
  /** How many points would this attempt earn if correct? */
  pointsIfCorrect: number
}

export interface ModeratorQuizViewModel extends PublicQuizViewModel {
  /** Id of the running question - for directing notes and local hotfixes. Never public. */
  questionId?: string
  privateSolution?: PrivateSolution
  explanation?: QuestionExplanation
  allowedCommands: CommandType[]
  /** What happens next - helps the moderator with the lead-in. */
  nextStepHint: string
  answering?: AnsweringContext
}

/**
 * A joker draw as the stage and the room may see it.
 *
 * `startedAtServerMs` is the same clock as `serverTimeMs`, so a client that
 * joins mid-flight can compute where the card should be instead of starting the
 * animation over. `revealAtMs` is how long the flight takes, handed down rather
 * than duplicated in a stylesheet.
 */
export interface PublicJokerDraw {
  phase: Exclude<JokerSequence['phase'], 'idle'>
  sequenceId: string
  playerId: PlayerId
  startedAtServerMs: number
  /** When the card reaches the middle - the turn starts from there. */
  revealAtMs: number
  /** What came out - present from `revealed` on, never before. */
  type?: JokerType
}

/**
 * The joker area of ONE player in the operator's view, ready to render.
 *
 * One entry per player, not per variant: there is one joker, and the two
 * buttons on it are two ways of spending the same thing. `canUseFiftyFifty`,
 * `canUseAudience` and the reasons come from the SAME rule function the engine
 * uses (`evaluateJokerUse`), so a button that looks available is one the server
 * will accept, and a disabled one carries the sentence explaining why. The
 * operator client must not re-derive any of this.
 */
export interface OperatorJokerControl {
  /** May the draw be triggered right now? */
  canDraw: boolean
  /** Plain text for the operator - why not. Absent when it can. */
  blockedReason?: string
  /**
   * The only variant this question can produce, where there is only one.
   *
   * Absent whenever both are possible - which is the normal case, and then the
   * desk must not suggest that anything is known in advance.
   */
  onlyType?: JokerType
  /** Whose joker the draw would spend, as far as that is decided. */
  playerId?: PlayerId
  playerLabel?: string
  /** Has that player's joker already been drawn in this game? */
  used: boolean
  /**
   * The draw as it runs. Absent while none runs - and the phase is what the
   * desk renders: `drawing` a status line, `revealed` the result and the
   * "Weiter" button, `applied` nothing of its own.
   */
  sequence?: {
    phase: Exclude<JokerSequence['phase'], 'idle'>
    sequenceId: string
    type?: JokerType
  }
}

export interface OperatorQuizViewModel extends ModeratorQuizViewModel {
  /**
   * The running question in editable form - basis of the live correction.
   * It is available regardless of whether the answers are shown yet: the
   * operator sees the complete question anyway.
   */
  editableQuestion?: {
    prompt: string
    options: { id: string; text: string }[]
    correctOptionId?: string
    /**
     * Expected wordings of the free answer. For questions without a choice -
     * such as the image reveal - this is the only place where the correct answer
     * stands; without it nothing could be corrected right there.
     */
    acceptedAnswerText: string[]
  }
  /**
   * The joker button and its state. Absent in a game without jokers - the
   * operator then sees no joker section at all.
   */
  joker?: OperatorJokerControl
  auditSummary: AuditEntry[]
  diagnostics: OperatorDiagnostics
  /** Resumable game after a restart, relevant on the start view only. */
  resumable?: { gameId: string; audience: string; presetId: string; progress: string }
  /** Available audiences, pools and presets from validated configuration. */
  catalog: CatalogViewModel
  /** Games played per audience. Lives in the database, not in the browser. */
  statistics: GameStatisticsViewModel
  /**
   * What is set up at the desk but not yet started - quiz and level.
   *
   * THE CONSOLE READS ITS OWN CHOICE HERE, and not from a state of its own:
   * the room's announcement marks the same card (`selectedQuizId`), and a
   * window that reloads mid-evening finds the choice again instead of standing
   * empty next to a marked poster. The level is only in this view - the room is
   * not told how hard it will be.
   */
  quizSelection?: { quizId: string; presetId?: string }
}

/**
 * Game log: how many games per audience have run already.
 *
 * Counted across event days - the log answers "what have we played with this
 * setup so far", not "what ran today".
 */
export interface GameStatisticsViewModel {
  /**
   * Point in time from which counting starts. If missing, the count runs since
   * the first commissioning.
   */
  countingSinceIso?: string
  audiences: {
    audience: string
    label: string
    /** All games begun, including aborted and running ones. */
    total: number
    /** Played through to the result. */
    completed: number
    aborted: number
    lastPlayedIso?: string
  }[]
}

export interface CatalogViewModel {
  questionsPerGame: number
  audiences: {
    id: string
    label: string
    themeId: string
    /**
     * Design world of this audience - the same recommendation `theme.skin`
     * carries later.
     *
     * IT IS HERE BECAUSE THE CHOICE COMES BEFORE THE GAME: `theme` belongs to
     * the running game and reports the base world before that. A device that
     * offers the kids choice should show the kids choice already, and not
     * switch worlds only with the first question.
     */
    skin?: ThemeSkin
    startVisualUrl?: string
    allowedPresetIds: string[]
  }[]
  /**
   * The quiz types offered at the desk - fully resolved.
   *
   * `supportsDifficulty` is decided HERE already (`quizSupportsDifficulty`), so
   * that no client rebuilds the rule. A form shows the difficulty choice exactly
   * when `true` stands here.
   */
  quizzes: {
    id: string
    label: string
    subtitle?: string
    audienceId: string
    themeId: string
    poolIds?: string[]
    /** Selectable difficulty levels in the order of the offer. */
    presetIds: string[]
    supportsDifficulty: boolean
    defaultPresetId: string
    /** Player counts this quiz offers, in the order of the offer. */
    playerCounts: PlayerCount[]
    /** Weight of the card in the menu; `wide` takes two columns. */
    emphasis: 'wide' | 'regular'
    /** Artwork of the offer card, already resolved into a URL. */
    artworkUrl?: string
    /**
     * Can this quiz be started right now?
     *
     * The menu says so BEFORE the attempt. `false` without a reason does not
     * happen: whoever reports a quiz as unavailable also says why.
     */
    available: boolean
    unavailableReason?: QuizUnavailableReason
  }[]
  /**
   * The rules of this package that a client needs.
   *
   * Only these three: the idle watch runs in the device, whether the detail
   * text gets its own step after the solution is a question of the interface,
   * and the correction step is a NUMBER THE DESK HAS TO SAY OUT LOUD - its
   * buttons are announced as "plus 10", and a desk that read the step from the
   * engine's constant instead of from this package announced a figure the
   * package does not use. Everything else the engine decides, and no client
   * asks about it.
   */
  rules: { idleTimeoutMs?: number; showDetailsAfterSolution: boolean; manualAdjustmentStep: number }
  /** Selectable question pools - "Saarbruecken" is exactly one of them. */
  pools: { id: string; label: string }[]
  presets: { id: string; label: string; slotCount: number }[]
  /**
   * Selectable locales. Empty or a single entry means: there is nothing to
   * choose, and the switch does not appear.
   *
   * THE LABELS IN THE CATALOG ARE ALREADY TRANSLATED - the client receives
   * finished texts and no word lists. It should not have to decide which version
   * applies.
   */
  locales: { id: string; label: string }[]
}

export type RoleViewModel = {
  stage: PublicQuizViewModel
  moderator: ModeratorQuizViewModel
  operator: OperatorQuizViewModel
}

export type ViewModelForRole<R extends ActorRole> = R extends 'operator'
  ? OperatorQuizViewModel
  : R extends 'moderator'
    ? ModeratorQuizViewModel
    : PublicQuizViewModel

/* ------------------------------------------------------------------ *
 * WebSocket protocol
 * ------------------------------------------------------------------ */

export type ClientRole = 'operator' | 'moderator' | 'stage' | 'player'

/** Messages server -> client. */
export type ServerMessage =
  | { type: 'hello'; clientId: string; role: ClientRole; serverTimeMs: number; protocolVersion: number }
  /**
   * Exactly one client is the audio master so that sounds are not played
   * several times with an offset. In standard operation that is the local
   * desktop application; remote presentation clients start muted.
   */
  | {
      type: 'client-info'
      audioMaster: boolean
    }
  | {
      type: 'snapshot'
      role: ClientRole
      view: PublicQuizViewModel | PlayerQuizViewModel | ModeratorQuizViewModel | OperatorQuizViewModel
    }
  | { type: 'command-accepted'; commandId: string; revision: number }
  | { type: 'command-rejected'; commandId: string; reason: string; message: string; currentRevision: number }
  | { type: 'error'; message: string }

/** Messages client -> server. */
export type ClientMessage =
  | { type: 'command'; envelope: unknown }
  | { type: 'ping'; sentAtMs: number }
  /**
   * This window may play audible sound.
   *
   * Browsers block audio output until THAT window has been clicked or tapped
   * once. Without this message the server could hand audio authority to a
   * window that is not allowed to sound at all - then the whole event stays
   * silent without anybody seeing an error.
   */
  | { type: 'audio-ready' }

export const PROTOCOL_VERSION = 1

/* ------------------------------------------------------------------ *
 * Start menu
 * ------------------------------------------------------------------ */

/** Why a quiz cannot be started - the menu never stays silent about it. */
export type QuizUnavailableReason = 'no-questions' | 'missing-pool'

/**
 * One offer of the start menu, resolved for one locale.
 *
 * It carries no configuration: whoever renders the menu must not be able to
 * derive audiences, pools or presets from it. What is needed to start is the
 * quiz id, a player count and - where there is a choice - a preset id.
 */
export interface StartMenuOffer {
  /**
   * The quiz this card starts - where the package configures quiz types.
   *
   * EXACTLY ONE OF THE TWO IDS IS SET. A package with `quizzes` offers its quiz
   * types; a pure kiosk package without them offers its audiences, and the host
   * then starts with audience and preset, exactly as it does today.
   */
  quizId?: string
  /** The audience this card starts - where the package has no quiz types. */
  audienceId?: string
  label: string
  subtitle?: string
  artworkUrl?: string
  emphasis: 'wide' | 'regular'
  playerCounts: PlayerCount[]
  /**
   * The levels of this offer - with the length of the round they play.
   *
   * `slotCount` is what the card says besides the name: the rounds of a setup
   * differ in length just as often as in difficulty, and "5 questions" is the
   * only thing about a level that is true before the game.
   */
  difficulties?: { presetId: string; label: string; isDefault: boolean; slotCount?: number }[]
  available: boolean
  unavailableReason?: QuizUnavailableReason
}

/**
 * The whole start menu as data - one model for every host.
 *
 * The kiosk renders it as cards, the operator desk as a form, the stage as an
 * overview. All three read the same thing, so a new quiz is a configuration
 * entry and not a change in three interfaces.
 */
export interface StartMenuModel {
  locale: string
  /** More than one means: the language switch appears. */
  locales: { id: string; label: string }[]
  offers: StartMenuOffer[]
  /**
   * The player counts across all offers.
   *
   * `textKey` names the interface text of the mode; `label` stands there only
   * where the package configures its own wording. That way the German default
   * stays in one place (`@hfroemmel/quiz-react`) instead of being copied here.
   */
  playModes: { playerCount: PlayerCount; textKey: string; label?: string }[]
  /**
   * What is already settled because there is nothing to choose: a single quiz,
   * a single player count. A menu that offers one option is a hurdle, not a
   * choice.
   */
  preselect?: { quizId?: string; audienceId?: string; playerCount?: PlayerCount }
}

/**
 * What narrows a menu down to one installation.
 *
 * A device belongs to one audience, and its menu shows only that one's offers.
 * The desk passes nothing and sees the whole package.
 */
export interface StartMenuOptions {
  audienceId?: string
}
