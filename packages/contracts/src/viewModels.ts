/**
 * Oeffentliche und private View-Modelle (Spezifikation 19).
 *
 * Der vollstaendige `GameState` wird niemals ungefiltert verteilt. Die Filterung
 * geschieht serverseitig in `packages/domain/src/projection.ts`. Ein Ausblenden per
 * CSS auf dem Buehnenscreen waere nicht ausreichend, weil die Loesung dann bereits
 * uebertragen waere.
 */
import type { QuestionExplanation, QuestionPresentationType, ThemeSkin } from './content.ts'
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
  /** Gestaltungswelt der Buehne. Fehlt sie, gilt die dunkle Buehne. */
  skin?: ThemeSkin
  colors: Record<string, string>
  logoUrl?: string
  startVisualUrl?: string
  /**
   * Titel auf dem Startbild. Faellt weg, wenn die Startgrafik den Titel bereits
   * enthaelt - so wie beim Kinderquiz.
   */
  startTitle?: string
  headingFont?: string
  bodyFont?: string
  presentationAnimationSetId?: string
}

export interface PublicOption {
  id: string
  text: string
  /** Nur in der Loesungsansicht gesetzt; vorher niemals uebertragen. */
  /**
   * `chosen` markiert die eingeloggte Antwort, solange noch nicht aufgeloest ist -
   * der Saal sieht, worauf sich der Spieler festgelegt hat, aber nicht, ob es
   * stimmt. `correct` und `chosen-incorrect` kommen erst in der Loesungsszene.
   */
  state?: 'chosen' | 'correct' | 'chosen-incorrect'
}

export interface PublicQuestion {
  prompt: string
  presentationType: QuestionPresentationType
  imageUrl?: string
  videoUrl?: string
  /**
   * Rubrik ueber dem Fragetext: das Label der ERSTEN Kategorie der Frage
   * (Designergaenzung). Reiner Anzeigewert - der Client leitet daraus nichts ab.
   */
  categoryLabel?: string
}

/** Enthaelt bewusst nur das, was oeffentlich sichtbar sein darf. */
export interface PublicSolution {
  /** Text der richtigen Antwort. */
  answerText: string
  imageUrl?: string
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
  /**
   * Laufzeit des Mediums, sobald der Buehnenclient sie gemeldet hat.
   *
   * Sie steht hier, weil der Operator ohne sie NICHT VORWAERTS SPRINGEN kann:
   * Sein Regler braucht eine obere Grenze, und die kannte bisher nur der
   * Buehnenclient. Vor der ersten Meldung bleibt sie offen.
   */
  durationMs?: number
  hasError: boolean
}

export interface PublicFeedback {
  outcome: AttemptOutcome
  playerId: PlayerId | null
  awardedPoints: number
}

export interface PublicResult {
  /**
   * Im Einzelspiel gibt es weder Gewinner noch Unentschieden, sondern nur das
   * eigene Ergebnis. Die Ergebnisszene entscheidet daran, was sie zeigt - sie
   * leitet es nicht aus der Anzahl der Punktestaende ab.
   */
  mode: 'duel' | 'solo'
  /** `null` bedeutet Unentschieden - und im Einzelspiel immer. */
  winnerPlayerId: PlayerId | null
  /** Im Einzelspiel immer `false`. */
  isDraw: boolean
  scores: PublicScore[]
  /** Nur im Einzelspiel: wie viele Fragen richtig beantwortet wurden. */
  solo?: { correctAnswers: number; questionCount: number }
}

export interface PublicQuizViewModel {
  scene: PublicScene
  phase: GamePhase
  theme: PublicTheme
  question?: PublicQuestion
  /**
   * Rubrik der NAECHSTEN Frage - ausschliesslich fuer den Zwischenscreen.
   *
   * Der Pausenscreen bleibt frei von Frageninhalten. Die Rubrik ist eine
   * Ueberschrift, keine Information zur Antwort; sie kuendigt an, worum es gleich
   * geht. Fragetext, Optionen und Medien werden weiterhin nicht uebertragen.
   */
  upcomingCategoryLabel?: string
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

/**
 * Ansicht der Spieler am Touchgeraet.
 *
 * Sie ist die oeffentliche Ansicht - die Loesung wird also auch hier erst in der
 * Loesungsszene uebertragen - plus der Liste der gerade moeglichen Befehle. Damit
 * leitet auch der Touchclient seine Bedienbarkeit aus dem Server ab und baut die
 * Regeln nicht nach.
 */
export interface PlayerQuizViewModel extends PublicQuizViewModel {
  allowedCommands: CommandType[]
  /**
   * Nur fuer die Startansicht am Geraet: was dort gewaehlt werden kann. Wie beim
   * Operator kommt die Liste aus validierter Konfiguration.
   */
  catalog: CatalogViewModel
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
  /**
   * Die laufende Frage in bearbeitbarer Form - Grundlage der Live-Korrektur.
   * Sie steht unabhaengig davon zur Verfuegung, ob die Antworten schon
   * eingeblendet sind: Der Operator sieht ohnehin die vollstaendige Frage.
   */
  editableQuestion?: {
    prompt: string
    options: { id: string; text: string }[]
    correctOptionId?: string
    /**
     * Erwartete Formulierungen der freien Antwort. Bei Fragen ohne Auswahl - etwa
     * beim Bilderkennen - ist das die einzige Stelle, an der die richtige Antwort
     * steht; ohne sie liesse sich genau dort nichts korrigieren.
     */
    acceptedAnswerText: string[]
  }
  auditSummary: AuditEntry[]
  diagnostics: OperatorDiagnostics
  /** Wiederherstellbares Spiel nach Neustart, nur auf der Startansicht relevant. */
  resumable?: { gameId: string; quizModeId: string; presetId: string; progress: string }
  /** Verfuegbare Modi und Presets aus validierter Konfiguration, nicht aus UI-Konstanten. */
  catalog: CatalogViewModel
  /** Gespielte Spiele je Quizmodus. Liegt in der Datenbank, nicht im Browser. */
  statistics: GameStatisticsViewModel
}

/**
 * Spielprotokoll: wie viele Spiele in welchem Modus bereits gelaufen sind.
 *
 * Gezaehlt wird ueber Veranstaltungstage hinweg - das Protokoll beantwortet
 * "was haben wir mit diesem Aufbau schon gespielt", nicht "was lief heute".
 */
export interface GameStatisticsViewModel {
  /**
   * Zeitpunkt, ab dem gezaehlt wird. Fehlt er, laeuft die Zaehlung seit der
   * ersten Inbetriebnahme.
   */
  countingSinceIso?: string
  modes: {
    quizModeId: string
    label: string
    /** Alle begonnenen Spiele, einschliesslich abgebrochener und laufender. */
    total: number
    /** Bis zum Ergebnis gespielt. */
    completed: number
    aborted: number
    lastPlayedIso?: string
  }[]
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

export type ClientRole = 'operator' | 'moderator' | 'stage' | 'player'

/** Nachrichten Server -> Client. */
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

/** Nachrichten Client -> Server. */
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
