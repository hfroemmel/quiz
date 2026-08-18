/**
 * Typisierte Befehle (Spezifikation 18.3).
 *
 * Jede Zustandsaenderung laeuft ueber genau einen Befehl. Manuelle Spielerauswahl und
 * Hardware-Buzzer durchlaufen denselben serverseitigen Pfad und dieselbe Validierung.
 *
 * Rollenrechte stehen ausschliesslich in `commandRoles` weiter unten. Weder Operator-
 * noch Moderatorclient darf diese Tabelle nachbauen; sichtbare Buttons werden aus
 * `allowedCommands` des View-Modells abgeleitet.
 */
import { z } from 'zod'
import { playerIds, type PlayerId } from './state.ts'
import { patchableQuestionFieldsSchema } from './content.ts'

export const actorRoles = ['operator', 'moderator', 'system', 'buzzer'] as const
export type ActorRole = (typeof actorRoles)[number]

const playerIdSchema = z.enum(playerIds as unknown as [PlayerId, ...PlayerId[]])

/**
 * Alle Befehle als diskriminierte Union. Neue Befehle werden hier ergaenzt; der
 * Compiler erzwingt dann die Behandlung in der Engine und die Rollenzuordnung.
 */
export const commandSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('START_GAME'),
    quizModeId: z.string().min(1),
    presetId: z.string().min(1),
    playerLabels: z.tuple([z.string().min(1), z.string().min(1)]).optional(),
  }),
  /** Buzzer fuer die aktuelle Frage freigeben. */
  z.object({ type: z.literal('OPEN_BUZZER') }),
  /** Hardware-Buzzer. Taste `A` = Spieler 1, Taste `B` = Spieler 2. */
  z.object({ type: z.literal('BUZZ'), playerId: playerIdSchema }),
  /** Fallback, wenn die Hardware ausfaellt. Gleiche Validierung wie `BUZZ`. */
  z.object({ type: z.literal('SELECT_PLAYER_MANUALLY'), playerId: playerIdSchema }),
  /** Genannte Multiple-Choice-Option einloggen (Bewertung `option-comparison`). */
  z.object({ type: z.literal('LOG_OPTION_ANSWER'), optionId: z.string().min(1) }),
  /** Muendliche Antwort manuell bewerten (Bewertung `manual-correct-incorrect`). */
  z.object({ type: z.literal('MARK_MANUAL_ANSWER'), verdict: z.enum(['correct', 'incorrect']) }),
  /** Den eingeloggten Versuch verbindlich auswerten und Punkte buchen. */
  z.object({ type: z.literal('RESOLVE_ATTEMPT') }),
  /** Ohne Spielerantwort aufloesen: keine Punkte. */
  z.object({ type: z.literal('RESOLVE_WITHOUT_ANSWER') }),
  /** Zweite Chance verstreichen lassen: keine Punkte, kein Abzug. */
  z.object({ type: z.literal('PASS_SECOND_CHANCE') }),
  /** Aktuelle Spielerzuordnung verwerfen und erneut freigeben. */
  z.object({ type: z.literal('RESET_BUZZER') }),

  z.object({ type: z.literal('PAUSE_IMAGE_REVEAL') }),
  z.object({ type: z.literal('RESUME_IMAGE_REVEAL') }),
  z.object({ type: z.literal('REVEAL_IMAGE_COMPLETELY') }),
  /** Technische Korrektur: Enthuellung zurueck auf Sekunde 10. Nicht mit RESET_BUZZER mischen. */
  z.object({ type: z.literal('RESET_IMAGE_REVEAL') }),

  z.object({ type: z.literal('START_VIDEO') }),
  z.object({ type: z.literal('PAUSE_VIDEO') }),
  z.object({ type: z.literal('SEEK_VIDEO'), positionMs: z.number().min(0) }),
  z.object({ type: z.literal('RESTART_VIDEO') }),
  /** Nach der Videophase die eigentliche Frage einblenden. Gleiche Frage, zweite Phase. */
  z.object({ type: z.literal('SHOW_QUESTION_AFTER_VIDEO') }),
  /** Der Client meldet die Laufzeit bzw. einen Ladefehler des Mediums. */
  z.object({
    type: z.literal('REPORT_VIDEO_STATUS'),
    durationMs: z.number().min(0).optional(),
    error: z.string().min(1).optional(),
  }),

  /** Manuelle Punktkorrektur in 100er-Schritten. */
  z.object({
    type: z.literal('ADJUST_SCORE'),
    playerId: playerIdSchema,
    direction: z.enum(['increase', 'decrease']),
    reason: z.string().optional(),
  }),
  /** Naechste Frage bzw. nach der letzten Frage die Ergebnisansicht. */
  z.object({ type: z.literal('CONTINUE') }),
  z.object({ type: z.literal('ABORT_GAME') }),
  /** Aktuelle Frage verwerfen und einen Ersatz aus demselben Fragenplatz ziehen. */
  z.object({ type: z.literal('SKIP_QUESTION'), reason: z.string().optional() }),
  /** Globaler Soundstatus. */
  z.object({ type: z.literal('SET_SOUND_ENABLED'), enabled: z.boolean() }),
  /**
   * Systembefehl: beendet eine zeitgesteuerte Phase (Feedback, Pausenscreen).
   * Wird vom Server-Timer ausgeloest; die Praesentation darf ihn frueher melden,
   * der fachliche Wechsel haengt aber nicht davon ab.
   */
  z.object({ type: z.literal('ADVANCE_TIMED_PHASE'), transitionId: z.string().min(1) }),

  /* ---- Wiederherstellung und Betrieb: von der Anwendungsschicht behandelt ---- */

  /** Nach einem Neustart das gefundene unvollstaendige Spiel fortsetzen. */
  z.object({ type: z.literal('RESUME_GAME') }),
  /** Das gefundene unvollstaendige Spiel bewusst verwerfen. */
  z.object({ type: z.literal('DISCARD_RESUMABLE_GAME') }),
  /** Neuen Veranstaltungstag beginnen (setzt die Wiederholungshistorie zurueck). */
  z.object({ type: z.literal('START_NEW_EVENT_DAY') }),
  /** Lokaler Live-Hotfix an einer Frage. Das Basispaket bleibt unveraendert. */
  z.object({
    type: z.literal('APPLY_QUESTION_PATCH'),
    questionId: z.string().min(1),
    changes: patchableQuestionFieldsSchema,
    reason: z.string().optional(),
    applyMode: z.enum(['next-use', 'immediate-confirmed']),
  }),
])
export type Command = z.infer<typeof commandSchema>
export type CommandType = Command['type']

/** Ein konkreter Befehlstyp aus der Union herausgegriffen. */
export type CommandOf<T extends CommandType> = Extract<Command, { type: T }>

export const commandEnvelopeSchema = z.object({
  /** Eindeutige ID des Befehls. Wiederholungen werden idempotent beantwortet. */
  commandId: z.string().min(1).max(120),
  command: commandSchema,
  actor: z.object({
    clientId: z.string().min(1).max(120),
    role: z.enum(actorRoles),
  }),
  /** Revision, auf der der Client seine Entscheidung getroffen hat. */
  expectedRevision: z.number().int().min(0),
  issuedAtClient: z.string().optional(),
})
export type CommandEnvelope = z.infer<typeof commandEnvelopeSchema>

/**
 * Rollenrechte: einzige Quelle der Wahrheit.
 *
 * Der Moderator darf laut Spezifikation 5.2 in der initialen Ausbaustufe nur
 * aufloesen, weiterschalten, die Enthuellung pausieren/fortsetzen und die naechste
 * Antwortphase freigeben. Punkte, Abbruch, technische Resets und Inhalte bleiben
 * ausschliesslich beim Operator.
 */
export const commandRoles: Record<CommandType, readonly ActorRole[]> = {
  START_GAME: ['operator'],
  OPEN_BUZZER: ['operator', 'moderator'],
  BUZZ: ['operator', 'buzzer'],
  SELECT_PLAYER_MANUALLY: ['operator'],
  LOG_OPTION_ANSWER: ['operator'],
  MARK_MANUAL_ANSWER: ['operator'],
  RESOLVE_ATTEMPT: ['operator', 'moderator'],
  RESOLVE_WITHOUT_ANSWER: ['operator', 'moderator'],
  PASS_SECOND_CHANCE: ['operator', 'moderator'],
  RESET_BUZZER: ['operator'],
  PAUSE_IMAGE_REVEAL: ['operator', 'moderator'],
  RESUME_IMAGE_REVEAL: ['operator', 'moderator'],
  REVEAL_IMAGE_COMPLETELY: ['operator'],
  RESET_IMAGE_REVEAL: ['operator'],
  START_VIDEO: ['operator'],
  PAUSE_VIDEO: ['operator'],
  SEEK_VIDEO: ['operator'],
  RESTART_VIDEO: ['operator'],
  SHOW_QUESTION_AFTER_VIDEO: ['operator', 'moderator'],
  REPORT_VIDEO_STATUS: ['operator', 'system'],
  ADJUST_SCORE: ['operator'],
  CONTINUE: ['operator', 'moderator'],
  ABORT_GAME: ['operator'],
  SKIP_QUESTION: ['operator'],
  SET_SOUND_ENABLED: ['operator'],
  ADVANCE_TIMED_PHASE: ['system', 'operator'],
  RESUME_GAME: ['operator'],
  DISCARD_RESUMABLE_GAME: ['operator'],
  START_NEW_EVENT_DAY: ['operator'],
  APPLY_QUESTION_PATCH: ['operator'],
}

export function roleMayIssue(role: ActorRole, type: CommandType): boolean {
  return commandRoles[type].includes(role)
}

/**
 * Befehle OHNE Revisionspruefung - ebenfalls einzige Quelle der Wahrheit.
 *
 * Hintergrund: `expectedRevision` schuetzt vor widerspruechlichen ENTSCHEIDUNGEN, die
 * zwei Clients auf demselben Stand treffen (Spezifikation 18.5). Ein Buzzer ist aber
 * keine Entscheidung auf Basis eines gesehenen Zustands, sondern ein physisches
 * Ereignis: Gibt der Operator den Buzzer frei und ein Spieler drueckt 50 Millisekunden
 * spaeter, kennt der Client die neue Revision noch nicht. Eine Ablehnung waere im
 * Live-Betrieb inakzeptabel und wuerde die Fairness beschaedigen.
 *
 * Die Fairness bleibt trotzdem gewahrt, weil der Server weiterhin atomar entscheidet:
 * Phase, Buzzerfreigabe und Spielersperre werden bei jedem Ereignis frisch geprueft
 * (siehe `evaluateBuzz`), und nach dem ersten angenommenen Buzzer wird jeder weitere
 * abgewiesen.
 *
 * Fuer alle anderen Befehle - insbesondere Aufloesen, Weiter und Punktekorrektur -
 * gilt die Revisionspruefung unveraendert.
 */
export const revisionExemptCommands: ReadonlySet<CommandType> = new Set<CommandType>([
  // Physisches Buzzerereignis bzw. dessen manueller Fallback.
  'BUZZ',
  'SELECT_PLAYER_MANUALLY',
  // Serverinterner Timer; gegen Doppelausloesung schuetzt die `transitionId`.
  'ADVANCE_TIMED_PHASE',
  // Reine Statusmeldung des Mediums, keine Spielentscheidung.
  'REPORT_VIDEO_STATUS',
])

export function requiresRevisionCheck(type: CommandType): boolean {
  return !revisionExemptCommands.has(type)
}

/** Gruende, aus denen der Server einen Befehl ablehnt. */
export const commandRejectionReasons = [
  'invalid-payload',
  'forbidden-role',
  'revision-conflict',
  'invalid-phase',
  'no-active-game',
  'buzzer-closed',
  'player-locked',
  'buzzer-already-taken',
  'no-pending-attempt',
  'attempt-already-resolved',
  'answer-not-logged',
  'no-candidate-question',
  'nothing-to-resume',
  'invalid-patch',
  'persistence-error',
  'unknown-command',
] as const
export type CommandRejectionReason = (typeof commandRejectionReasons)[number]

export interface CommandRejection {
  reason: CommandRejectionReason
  /** Klartext fuer den Operator, inklusive sicherer naechster Aktion. */
  message: string
  currentRevision?: number
}
