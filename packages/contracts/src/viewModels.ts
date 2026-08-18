/**
 * Oeffentliche und private View-Modelle (Spezifikation 19).
 *
 * Der vollstaendige `GameState` wird niemals ungefiltert verteilt. Die Filterung
 * geschieht serverseitig in `packages/domain/src/projection.ts`. Ein Ausblenden per
 * CSS auf dem Buehnenscreen waere nicht ausreichend, weil die Loesung dann bereits
 * uebertragen waere.
 */
import type { QuestionExplanation, QuestionPresentationType } from './content.ts'
import type { AttemptOutcome, GamePhase, PlayerId } from './state.ts'
import type { ActorRole, CommandType } from './commands.ts'

/** Szenen des Buehnenscreens. Sie werden aus der Phase abgeleitet, nicht frei gesetzt. */
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

export interface PublicTheme {
  id: string
  colors: Record<string, string>
  logoUrl?: string
  startVisualUrl?: string
  headingFont?: string
  bodyFont?: string
  presentationAnimationSetId?: string
}

export interface PublicOption {
  id: string
  text: string
  /** Nur in der Loesungsansicht gesetzt; vorher niemals uebertragen. */
  state?: 'correct' | 'chosen-incorrect'
}

export interface PublicQuestion {
  prompt: string
  presentationType: QuestionPresentationType
  imageUrl?: string
  videoUrl?: string
}

/** Enthaelt bewusst nur das, was oeffentlich sichtbar sein darf. */
export interface PublicSolution {
  /** Text der richtigen Antwort. */
  answerText: string
  imageUrl?: string
  /** Optionaler oeffentlicher Kurztext, redaktionell freigegeben. */
  publicNote?: string
}

export interface PublicScore {
  playerId: PlayerId
  label: string
  score: number
  /** Ist dieser Spieler gerade am Zug? */
  active: boolean
  /** Fuer diese Frage gesperrt (zweite Chance liegt beim anderen Spieler). */
  locked: boolean
}

/** Alles, was der Buehnenscreen zum synchronen Rendern der Enthuellung braucht. */
export interface PublicRevealState {
  status: 'idle' | 'running' | 'paused' | 'completed'
  durationMs: number
  /**
   * Bereits verstrichene Zeit zum Zeitpunkt `serverTimeMs` des Snapshots.
   * Der Client rechnet bei `running` mit der lokalen Uhr weiter und uebernimmt
   * bei jedem Snapshot wieder den Serverwert (Driftkorrektur).
   */
  elapsedMs: number
}

export interface PublicVideoState {
  status: 'idle' | 'playing' | 'paused' | 'ended'
  positionMs: number
  hasError: boolean
}

export interface PublicFeedback {
  outcome: AttemptOutcome
  playerId: PlayerId | null
  awardedPoints: number
}

export interface PublicResult {
  /** `null` bedeutet Unentschieden. Es gibt keine manuelle Gewinnerauswahl. */
  winnerPlayerId: PlayerId | null
  isDraw: boolean
  scores: PublicScore[]
}

export interface PublicQuizViewModel {
  scene: PublicScene
  phase: GamePhase
  theme: PublicTheme
  question?: PublicQuestion
  visibleOptions?: PublicOption[]
  visibleSolution?: PublicSolution
  feedback?: PublicFeedback
  playerScores: PublicScore[]
  currentPlayer?: PlayerId
  progress: { current: number; total: number }
  reveal?: PublicRevealState
  video?: PublicVideoState
  result?: PublicResult
  soundEnabled: boolean
  /** Laufender Praesentationsuebergang, damit Szenen synchron animieren. */
  transition?: { id: string; startedAtServerMs: number; durationMs: number }
  /** Serverzeit des Snapshots. Basis jeder clientseitigen Interpolation. */
  serverTimeMs: number
  revision: number
}

/** Nur fuer Operator und Moderator. Niemals an Buehnenclients. */
export interface PrivateSolution {
  answerText: string
  correctOptionId?: string
  acceptedAnswerText?: string[]
}

export interface AuditEntry {
  id: number
  atMs: number
  actorRole: ActorRole
  /** Vorformatierter Klartext, z. B. "21:14:08 - Spieler 2 - +100 - richtige Antwort". */
  message: string
  category: 'game' | 'buzzer' | 'answer' | 'score' | 'phase' | 'content' | 'system'
}

export interface OperatorDiagnostics {
  contentVersion: string
  eventDayId: string
  /** Auswahlbegruendung der aktuellen Frage. */
  selectionRationale?: string
  connectedClients: { role: ActorRole; clientId: string }[]
  /** Session-Code fuer Moderator und weitere Praesentationsclients im LAN. */
  sessionCode?: string
  lanUrls?: string[]
  /** Fehler, die den Operator betreffen, in klarer Sprache. */
  warnings: string[]
}

export interface AnsweringContext {
  /** Erwartet der Server jetzt eine eingeloggte Option oder eine manuelle Bewertung? */
  evaluationMode: 'option-comparison' | 'manual-correct-incorrect'
  loggedOptionId?: string
  loggedManualVerdict?: 'correct' | 'incorrect'
  attemptNumber: number
  /** Wie viele Punkte gaebe es, wenn dieser Versuch richtig ist? */
  pointsIfCorrect: number
}

export interface ModeratorQuizViewModel extends PublicQuizViewModel {
  /** ID der laufenden Frage - fuer Regiehinweise und lokale Hotfixes. Nie oeffentlich. */
  questionId?: string
  privateSolution?: PrivateSolution
  explanation?: QuestionExplanation
  allowedCommands: CommandType[]
  /** Was als naechstes passiert - hilft dem Moderator bei der Anmoderation. */
  nextStepHint: string
  answering?: AnsweringContext
}

export interface OperatorQuizViewModel extends ModeratorQuizViewModel {
  auditSummary: AuditEntry[]
  diagnostics: OperatorDiagnostics
  /** Wiederherstellbares Spiel nach Neustart, nur auf der Startansicht relevant. */
  resumable?: { gameId: string; quizModeId: string; presetId: string; progress: string }
  /** Verfuegbare Modi und Presets aus validierter Konfiguration, nicht aus UI-Konstanten. */
  catalog: CatalogViewModel
}

export interface CatalogViewModel {
  questionsPerGame: number
  modes: {
    id: string
    label: string
    themeId: string
    startVisualUrl?: string
    allowedPresetIds: string[]
  }[]
  presets: { id: string; label: string; slotCount: number }[]
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
 * WebSocket-Protokoll
 * ------------------------------------------------------------------ */

export type ClientRole = 'operator' | 'moderator' | 'stage'

/** Nachrichten Server -> Client. */
export type ServerMessage =
  | { type: 'hello'; clientId: string; role: ClientRole; serverTimeMs: number; protocolVersion: number }
  /**
   * Nur genau ein Client ist Audio-Master, damit Sounds nicht mehrfach zeitversetzt
   * abgespielt werden. Im Standardbetrieb ist das die lokale Desktop-Anwendung;
   * entfernte Praesentationsclients starten stumm.
   */
  | { type: 'client-info'; audioMaster: boolean }
  | { type: 'snapshot'; role: ClientRole; view: PublicQuizViewModel | ModeratorQuizViewModel | OperatorQuizViewModel }
  | { type: 'command-accepted'; commandId: string; revision: number }
  | { type: 'command-rejected'; commandId: string; reason: string; message: string; currentRevision: number }
  | { type: 'error'; message: string }

/** Nachrichten Client -> Server. */
export type ClientMessage =
  | { type: 'command'; envelope: unknown }
  | { type: 'ping'; sentAtMs: number }

export const PROTOCOL_VERSION = 1
