/**
 * Public and private view models (specification 19).
 *
 * The complete `GameState` is never distributed unfiltered. The filtering
 * happens on the server in `packages/domain/src/projection.ts`. Hiding by CSS on
 * the stage screen would not be enough, because the solution would already have
 * been transmitted.
 */
import type { QuestionExplanation, QuestionPresentationType, ThemeSkin } from './content'
import type { AttemptOutcome, GamePhase, PlayerId } from './state'
import type { JokerSequence, JokerType } from './joker'
import type { ActorRole, CommandType } from './commands'

/** Scenes of the stage screen. Derived from the phase, never set freely. */
export const publicScenes = [
  'start',
  'pause',
  'question',
  'video',
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
   * IT IS NOT A DISPLAY VALUE but an identity: a client that is to execute a
   * request (today the video playback request) must be able to check whether
   * the request belongs to what it shows. Without it only trust would remain.
   */
  id: string
  prompt: string
  presentationType: QuestionPresentationType
  imageUrl?: string
  videoUrl?: string
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

/**
 * The standing request to play the video - not a playback status.
 *
 * IT ONLY SAYS: "play the video of this question, from the start." How far the
 * stage has got is not in here and never comes back; the flow goes one way. If
 * the field is missing, nothing has been started yet.
 *
 * The stage remembers the last executed `requestId` LOCALLY and starts from
 * second zero on every other one. So the same snapshot may arrive any number of
 * times: the same id means "already done".
 */
export interface PublicVideoRequest {
  questionId: string
  requestId: string
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
   * The quiz offers of the house - id, name, subtitle, nothing else.
   *
   * WHAT FOR: before the first game the stage shows WHAT there is to play here.
   * That is an announcement to the room and not a choice: no command follows
   * from this list, and which quiz runs is decided by the desk alone.
   *
   * Audience, pools, presets and theme are DELIBERATELY not in it. They would be
   * configuration, and the stage must not be able to derive any.
   */
  quizOffers: { id: string; label: string; subtitle?: string }[]
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
  video?: PublicVideoRequest
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
  }[]
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
   * Nur genau ein Client ist Audio-Master, damit Sounds nicht mehrfach zeitversetzt
   * abgespielt werden. Im Standardbetrieb ist das die lokale Desktop-Anwendung;
   * entfernte Praesentationsclients starten stumm.
   */
  | { type: 'client-info'; audioMaster: boolean }
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
   * Dieses Fenster darf hoerbar Ton ausgeben.
   *
   * Browser sperren die Tonausgabe, bis in DEM Fenster einmal geklickt oder
   * getippt wurde. Ohne diese Meldung koennte der Server die Tonhoheit einem
   * Fenster geben, das gar nicht klingen darf - dann bleibt die ganze
   * Veranstaltung still, ohne dass jemand einen Fehler sieht.
   */
  | { type: 'audio-ready' }

export const PROTOCOL_VERSION = 1
