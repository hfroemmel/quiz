/**
 * Autoritatives Laufzeitmodell (Spezifikation 18).
 *
 * Dieser Zustand lebt ausschliesslich im lokalen Server. Clients senden Befehle
 * und rendern gefilterte View-Modelle; sie veraendern diesen Zustand niemals selbst.
 */
import type { Question, QuestionPresentationType } from './content'
import type { JokerSequence, PlayerJokerStates } from './joker'

/**
 * Phasen des Spielablaufs.
 *
 * Unmoegliche Kombinationen werden strukturell verhindert: Die Buzzer-Freigabe
 * haengt allein an der Phase (siehe `packages/domain/src/buzzer.ts`), deshalb kann
 * z. B. `video-playing` keine offenen Buzzer besitzen.
 */
export const gamePhases = [
  /** Kein Spiel aktiv. */
  'idle',
  /** Neutraler Pausen-/Logoscreen zwischen zwei Fragen (zeitgesteuert). */
  'pause-screen',
  /**
   * Frage sichtbar, Antwortmoeglichkeiten noch verborgen, Buzzer gesperrt.
   * Der Moderator liest die Frage vor, bevor der Operator freigibt.
   */
  'question-presented',
  /** Videofrage vorbereitet, Video steht, Buzzer gesperrt. */
  'video-ready',
  /** Video laeuft, Buzzer gesperrt. */
  'video-playing',
  /** Buzzer offen (normale Frage). */
  'buzzer-open',
  /** Ein Spieler hat den Zuschlag, Operator loggt die Antwort ein. */
  'answer-locked',
  /** Richtig-/Falsch-Animation laeuft (zeitgesteuert). */
  'attempt-feedback',
  /** Zweite Chance des anderen Spielers bei normaler Frage, kein Buzzern noetig. */
  'second-chance',
  /**
   * Bilderkennen: Bild steht unscharf, die Enthuellung ist noch nicht gestartet.
   * Der Moderator liest die Frage vor; Buzzern ist noch gesperrt.
   */
  'reveal-ready',
  /** Bilderkennen: Enthuellung laeuft, Buzzer offen. */
  'reveal-running',
  /** Bilderkennen: Enthuellung eingefroren, Buzzer weiterhin offen. */
  'reveal-paused',
  /** Loesung sichtbar, Frage abgeschlossen. */
  'solution',
  /** Ergebnisansicht nach der letzten Frage. */
  'result',
  /** Spiel wurde abgebrochen. Es gibt bewusst keine Gewinneransicht. */
  'aborted',
] as const
export type GamePhase = (typeof gamePhases)[number]

export type PlayerId = 'player-1' | 'player-2'
export const playerIds: readonly PlayerId[] = ['player-1', 'player-2']

/**
 * Erlaubte Spielerzahlen.
 *
 * Ein Spiel hat entweder zwei Spieler (Duell, der Buehnenbetrieb) oder einen
 * (Einzelspiel auf dem Touchgeraet). Beides ist derselbe Ablauf; die Spielerzahl
 * entscheidet nur, ob es eine zweite Chance und einen Gewinner gibt.
 */
export const playerCounts = [1, 2] as const
export type PlayerCount = (typeof playerCounts)[number]

/**
 * Wer den Ablauf vorantreibt.
 *
 * `operated`      Ein Mensch steuert: Der Operator gibt den Buzzer frei, loggt die
 *                 Antwort ein, loest auf und schaltet weiter. So laeuft die Buehne.
 * `self-service`  Niemand steuert: Die Spieler tippen ihre Antwort selbst an, die
 *                 Auswertung folgt sofort, und die Uebergaenge laufen ueber die
 *                 zeitgesteuerten Phasen des Servers. So laeuft das Touchgeraet.
 *
 * Das Profil ist KEINE zweite Zustandsmaschine. Die Phasen sind in beiden Faellen
 * dieselben; das Profil entscheidet nur, wer einen Uebergang ausloest und welche
 * Uebergaenge automatisch eingeplant werden.
 */
export const flowProfiles = ['operated', 'self-service'] as const
export type FlowProfile = (typeof flowProfiles)[number]

export interface PlayerState {
  id: PlayerId
  label: string
  score: number
  /**
   * Bei normalen Fragen ist ein Spieler nach einer falschen ersten Antwort fuer
   * genau diese Frage gesperrt. Beim Bilderkennen wird nie gesperrt.
   */
  lockedForCurrentQuestion: boolean
}

export interface BuzzerState {
  /** Nimmt der Server aktuell Buzzer-Ereignisse an? */
  open: boolean
  /** Spieler, dessen Buzzer als erster gueltig angenommen wurde. */
  acceptedPlayerId?: PlayerId
  /** Serverzeit der Annahme; dient der Nachvollziehbarkeit der Reihenfolge. */
  acceptedAtMs?: number
  /** Wie der aktive Spieler bestimmt wurde. */
  acceptedVia?: 'hardware' | 'manual'
}

export type AttemptOutcome = 'correct' | 'incorrect' | 'passed' | 'no-answer'

export interface AnswerAttempt {
  id: string
  questionId: string
  slotIndex: number
  /** `null` bei Aufloesen ohne Spielerantwort. */
  playerId: PlayerId | null
  /** 1 = erster Versuch dieser Frage, 2 = zweiter usw. Beim Bilderkennen unbegrenzt. */
  attemptNumber: number
  /** Vom Operator eingeloggte Option (nur bei `option-comparison`). */
  loggedOptionId?: string
  /** Vom Operator eingeloggte manuelle Bewertung (nur bei `manual-correct-incorrect`). */
  loggedManualVerdict?: 'correct' | 'incorrect'
  outcome?: AttemptOutcome
  awardedPoints: number
  createdAtMs: number
  resolvedAtMs?: number
}

/**
 * Enthuellungsuhr des Bilderkennens (Spezifikation 10.2).
 *
 * Jede Anzeige der Enthuellung wird aus derselben Fortschrittsvariable berechnet.
 * Der Server haelt nur Startzeit, bereits verstrichene Zeit und Pausezustand;
 * Clients leiten daraus `progress` ab und rendern fluessig, ohne den Zustand zu aendern.
 */
export interface RevealClockState {
  status: 'idle' | 'running' | 'paused' | 'completed'
  durationMs: number
  /** Serverzeit, zu der der aktuelle Laufabschnitt begann. */
  startedAtServerMs?: number
  /** Vor dem aktuellen Laufabschnitt bereits verstrichene Zeit. */
  elapsedBeforeStartMs: number
}

export interface VideoRuntimeState {
  status: 'idle' | 'playing' | 'paused' | 'ended'
  /** Position in Millisekunden zu Beginn des aktuellen Laufabschnitts. */
  positionMs: number
  startedAtServerMs?: number
  /** Vom Client gemeldete Laufzeit, sobald bekannt. Rein informativ. */
  durationMs?: number
  /** Verstaendliche Fehlermeldung, falls das Medium nicht geladen werden konnte. */
  error?: string
}

/** Eine im Spiel eingesetzte Frage inklusive spielspezifischer Praesentationsdaten. */
export interface RuntimeQuestion {
  question: Question
  /** Fragenplatz, aus dem sie gezogen wurde. */
  slotId: string
  slotIndex: number
  /**
   * Sichtbare Reihenfolge der Optionen fuer dieses Spiel. Das Mischen veraendert
   * die Auswertung nicht, weil immer gegen `correctOptionId` verglichen wird.
   */
  optionOrder: string[]
}

/** Zeitgesteuerter Phasenwechsel mit definierter Fallbackzeit. */
export interface PendingTimedTransition {
  /** Phase, in die nach Ablauf gewechselt wird. */
  nextPhase: GamePhase
  /** Serverzeit, zu der spaetestens gewechselt wird. */
  endsAtMs: number
  /** Kennung fuer die Praesentationsschicht, welcher Uebergang gerade laeuft. */
  transitionId: string
}

/** Was der Buehnenscreen zuletzt fachlich signalisiert bekommen hat. */
export interface PresentationTransitionState {
  transitionId: string
  startedAtServerMs: number
  durationMs: number
}

export interface GameState {
  gameId: string
  eventDayId: string
  status: 'active' | 'completed' | 'aborted'
  phase: GamePhase
  /** Wird bei jeder akzeptierten Zustandsaenderung erhoeht (optimistische Nebenlaeufigkeit). */
  revision: number

  /** Zielgruppe des Spiels (frueher `quizModeId`). */
  audience: string
  /** Gewaehlte Fragenpools. Fehlt das Feld, wird nicht nach Pool gefiltert. */
  poolIds?: string[]
  presetId: string
  /** Steuerprofil des Spiels. Es wird beim Start festgelegt und aendert sich nicht. */
  flowProfile: FlowProfile
  totalQuestions: number
  currentSlotIndex: number
  /** Bereits im Spiel eingesetzte Frage-IDs, inklusive der aktuellen. */
  selectedQuestionIds: string[]
  /** Wiederholungsgruppen der bereits eingesetzten Fragen. */
  selectedRepetitionGroupIds: string[]
  currentQuestion?: RuntimeQuestion

  /**
   * Ein oder zwei Spieler, in fester Reihenfolge (`player-1`, `player-2`).
   * Die Laenge wird beim Spielstart festgelegt und aendert sich danach nicht.
   */
  players: PlayerState[]
  buzzer: BuzzerState
  attempts: AnswerAttempt[]
  reveal?: RevealClockState
  video?: VideoRuntimeState

  /** Globaler Soundstatus; bleibt waehrend des Spiels erhalten. */
  soundEnabled: boolean
  /**
   * Sprache, in der dieses Spiel laeuft.
   *
   * Sie steht im Spielstand und nicht nur am Geraet: Ein wiederaufgenommenes
   * Spiel soll in derselben Sprache weitergehen, in der es begonnen wurde.
   * Fehlt sie (Staende aus aelteren Fassungen), gilt die Grundsprache.
   */
  locale?: string

  /**
   * The joker of every player, keyed by player id (see `joker.ts`).
   *
   * ONE supply per player, spendable as a 50:50 or as an audience joker.
   *
   * ITS ABSENCE IS THE STATEMENT "this game has no jokers": only an operated
   * game gets a supply, and a self-service game at a kiosk or a touch device
   * therefore carries nothing here - as does a game saved before the feature
   * existed. Read it through `jokerOf` and ask `gameHasJokers(state)`; nothing
   * else decides whether this game knows jokers.
   */
  jokerByPlayer?: PlayerJokerStates

  /**
   * The draw currently running - it belongs to the CURRENT QUESTION.
   *
   * It sits on the game and not on the player because there is one shared
   * screen: the card flies across it, and the answers a 50:50 removes are gone
   * for everyone, even though the joker is charged to one player. The sequence
   * is set back to `idle` on every question change, while the spent joker above
   * survives until a new game starts.
   *
   * Optional for the same reason as `jokerByPlayer`: a game without jokers -
   * and a state saved before the feature existed - carries nothing here.
   */
  jokerSequence?: JokerSequence

  pendingTransition?: PendingTimedTransition
  lastTransition?: PresentationTransitionState
  updatedAtMs: number
}

/** Hilfsfunktion: gehoert die Frage zum Bilderkennen mit unbegrenzten Fehlversuchen? */
export function isImageReveal(type: QuestionPresentationType): boolean {
  return type === 'image-reveal'
}
