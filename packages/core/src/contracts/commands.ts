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
import { flowProfiles, playerCounts, playerIds, type PlayerCount, type PlayerId } from './state'
import { patchableQuestionFieldsSchema } from './content'

/**
 * `player` ist die Rolle der Spieler am Touchgeraet. Sie darf genau zwei Dinge:
 * ein Selbstbedienungsspiel beginnen oder beenden und eine Antwort antippen.
 * Kein Aufloesen fremder Versuche, keine Punktekorrektur, keine Inhalte.
 *
 * `moderator` fuehrt durch den Abend: freigeben, den Zuschlag setzen, die
 * Antwort einloggen, aufloesen, weiterschalten. Punkte, Spielabbruch, Technik
 * und Inhalte bleiben beim Operator.
 */
export const actorRoles = ['operator', 'moderator', 'system', 'buzzer', 'player'] as const
export type ActorRole = (typeof actorRoles)[number]

const playerIdSchema = z.enum(playerIds as unknown as [PlayerId, ...PlayerId[]])
const playerCountSchema = z.union(
  playerCounts.map((count) => z.literal(count)) as unknown as [z.ZodLiteral<PlayerCount>, z.ZodLiteral<PlayerCount>],
)

/**
 * Alle Befehle als diskriminierte Union. Neue Befehle werden hier ergaenzt; der
 * Compiler erzwingt dann die Behandlung in der Engine und die Rollenzuordnung.
 */
export const commandSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('START_GAME'),
    /** Zielgruppe des Spiels (frueher `quizModeId`). */
    audience: z.string().min(1),
    /**
     * Fragenpools, aus denen gezogen wird. Ohne Angabe wird nicht nach Pool
     * gefiltert - alle Pools der Zielgruppe spielen mit.
     */
    poolIds: z.array(z.string().min(1)).min(1).optional(),
    presetId: z.string().min(1),
    /**
     * Ohne Angabe wird ein Duell gestartet. Der Buehnenbetrieb laesst das Feld
     * deshalb weg; das Einzelspiel gibt es ausdruecklich an.
     */
    playerCount: playerCountSchema.optional(),
    /** Beschriftungen in Spielerreihenfolge. Fehlende Eintraege werden ergaenzt. */
    playerLabels: z.array(z.string().min(1)).min(1).max(playerCounts.length).optional(),
    /** Ohne Angabe wird ein vom Operator gesteuertes Spiel gestartet. */
    flowProfile: z.enum(flowProfiles).optional(),
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

  z.object({ type: z.literal('START_IMAGE_REVEAL') }),
  z.object({ type: z.literal('PAUSE_IMAGE_REVEAL') }),
  z.object({ type: z.literal('RESUME_IMAGE_REVEAL') }),
  z.object({ type: z.literal('REVEAL_IMAGE_COMPLETELY') }),
  /** Technische Korrektur: Enthuellung zurueck auf Sekunde 10. Nicht mit RESET_BUZZER mischen. */
  z.object({ type: z.literal('RESET_IMAGE_REVEAL') }),

  /*
   * Das Video dieser Frage von vorn abspielen lassen.
   *
   * DIE FRAGE STEHT IM BEFEHL, weil er sonst nicht zu pruefen waere: Ein Klick,
   * der auf dem Weg war, als der Operator die Frage uebersprungen hat, wuerde
   * sonst das Video der naechsten Frage starten. Mit der Kennung weist der
   * Server ihn ab.
   *
   * Ein zweiter Klick ist kein Sonderfall - er erzeugt einfach einen neuen
   * Auftrag, und die Buehne spielt wieder von vorn. Es gibt deshalb weder
   * "pausieren" noch "neu starten".
   */
  z.object({ type: z.literal('START_VIDEO'), questionId: z.string().min(1) }),
  /** Nach der Videophase die eigentliche Frage einblenden. Gleiche Frage, zweite Phase. */
  z.object({ type: z.literal('SHOW_QUESTION_AFTER_VIDEO') }),
  /**
   * Sprache des Quiz umstellen.
   *
   * Wie der Ton gehoert sie dem GERAET und nicht dem Spiel: Am Kioskgeraet
   * steht der Umschalter im Startbildschirm, wo noch kein Spiel laeuft. Ein
   * laufendes Spiel wechselt trotzdem mit - die Fragen sind dieselben, nur die
   * Sprache ist eine andere.
   */
  z.object({ type: z.literal('SET_LOCALE'), locale: z.string().min(2) }),

  /*
   * ---- The joker (see `joker.ts`) ----
   *
   * `DRAW_JOKER` CARRIES NOTHING. Not the variant, because the server flips the
   * coin - a client that could name it could pick it. And not the player
   * either: the only one who may draw is the one who holds the buzz, and the
   * server knows who that is. A payload naming a player would be a payload to
   * validate, and the validation would be "is it the active player anyway".
   *
   * `CONTINUE_JOKER` names the draw it means. A late click - the operator's
   * view repainted, the connection dropped and came back - then arrives with
   * the id of a draw that is already over, and is refused instead of skipping a
   * step of the current one.
   */
  z.object({ type: z.literal('DRAW_JOKER') }),
  z.object({ type: z.literal('CONTINUE_JOKER'), sequenceId: z.string().min(1) }),

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
  /** Setzt die Zaehlung des Spielprotokolls zurueck. Spiele werden nicht geloescht. */
  z.object({ type: z.literal('RESET_GAME_STATISTICS') }),
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
  START_GAME: ['operator', 'player'],
  OPEN_BUZZER: ['operator', 'moderator'],
  /*
   * `player` ist die Selbstbedienung: Dort ersetzt der Bildschirm-Buzzer die
   * Hardware, und der Zuschlag faellt serverseitig - nicht im Client. Fuer die
   * drei Folgeschritte gilt dasselbe: Der Spieler markiert seine Antwort
   * (LOG_OPTION_ANSWER), bestaetigt sie (RESOLVE_ATTEMPT), und erst dann wird
   * gewertet. Es ist dieselbe Befehlssequenz wie beim Operator - absichtlich:
   * eine zweite Antwortmechanik hiesse zwei Fairnessregeln.
   * Ob ein Spiel Spielerbefehle annimmt, entscheidet das Ablaufprofil im
   * Server (`QuizService`), nicht diese Tabelle.
   */
  BUZZ: ['operator', 'buzzer', 'player'],
  /*
   * Den Zuschlag von Hand setzen und die Antwort einloggen darf auch der
   * Moderator. Am Buehnenabend steht er neben den Spielern und sieht als
   * Erster, wer sich gemeldet hat - der Operator sitzt am Pult. Gewertet wird
   * weiterhin gemeinsam: RESOLVE_ATTEMPT stand dem Moderator schon offen.
   */
  SELECT_PLAYER_MANUALLY: ['operator', 'moderator'],
  LOG_OPTION_ANSWER: ['operator', 'moderator', 'player'],
  MARK_MANUAL_ANSWER: ['operator'],
  RESOLVE_ATTEMPT: ['operator', 'moderator', 'player'],
  RESOLVE_WITHOUT_ANSWER: ['operator', 'moderator'],
  PASS_SECOND_CHANCE: ['operator', 'moderator'],
  RESET_BUZZER: ['operator'],
  START_IMAGE_REVEAL: ['operator', 'moderator'],
  PAUSE_IMAGE_REVEAL: ['operator', 'moderator'],
  RESUME_IMAGE_REVEAL: ['operator', 'moderator'],
  REVEAL_IMAGE_COMPLETELY: ['operator'],
  RESET_IMAGE_REVEAL: ['operator'],
  START_VIDEO: ['operator'],
  /*
   * Auch der Spieler - denn am Touchgeraet gibt es keinen Operator, der
   * einblenden koennte. Dort ist das Geraet sein eigenes Pult: Es zeigt das
   * Video, es sieht dessen Ende, und es blendet danach die Frage ein. Im Saal
   * aendert das nichts; dort kommt der Befehl weiterhin vom Pult.
   */
  SHOW_QUESTION_AFTER_VIDEO: ['operator', 'moderator', 'player'],
  /*
   * Die Sprache darf jeder umstellen, der vor dem Quiz steht - am Geraet ist das
   * der Spieler selbst, am Buehnenabend der Operator. Sie aendert keine Wertung
   * und keinen Punktestand.
   */
  SET_LOCALE: ['operator', 'moderator', 'player'],
  /*
   * THE JOKER IS THE OPERATOR'S BUTTON, in both steps.
   *
   * A player asks out loud - "I'll take my joker" - and the operator draws it.
   * Nobody else: not the moderator, who stands next to the players, and not a
   * player client, which is why the joker exists only where an operator does.
   * Continuing is the same desk deciding when the room has seen enough of the
   * card.
   */
  DRAW_JOKER: ['operator'],
  CONTINUE_JOKER: ['operator'],
  ADJUST_SCORE: ['operator'],
  /*
   * `player` ist die Selbstbedienung: Dort haelt die Loesung an, bis jemand
   * `Weiter` tippt. Ohne diese Rolle bliebe das Geraet nach jeder Frage stehen.
   */
  CONTINUE: ['operator', 'moderator', 'player'],
  ABORT_GAME: ['operator', 'player'],
  SKIP_QUESTION: ['operator'],
  SET_SOUND_ENABLED: ['operator', 'player'],
  ADVANCE_TIMED_PHASE: ['system', 'operator'],
  RESUME_GAME: ['operator'],
  DISCARD_RESUMABLE_GAME: ['operator'],
  START_NEW_EVENT_DAY: ['operator'],
  APPLY_QUESTION_PATCH: ['operator'],
  RESET_GAME_STATISTICS: ['operator'],
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
  /*
   * Das Einloggen folgt am Touchgeraet unmittelbar auf den eigenen Buzz, bevor
   * dessen neue Revision den Client erreicht hat. Es ist ausserdem keine
   * endgueltige Entscheidung: Die Markierung bleibt bis zum Aufloesen
   * umentscheidbar, und der bindende Schritt RESOLVE_ATTEMPT behaelt die
   * Revisionspruefung. Phase, offener Versuch und verbrauchte Optionen werden
   * beim Einloggen ohnehin frisch geprueft.
   */
  'LOG_OPTION_ANSWER',
  // Serverinterner Timer; gegen Doppelausloesung schuetzt die `transitionId`.
  'ADVANCE_TIMED_PHASE',
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
  'wrong-flow-profile',
  'no-pending-attempt',
  'attempt-already-resolved',
  'answer-not-logged',
  /** Diese Option wurde in einem frueheren Versuch schon als falsch bewertet. */
  'option-already-answered',
  /* ---- The joker: one reason per way a draw can be refused ---- */
  /** This player has already spent their joker in this game. */
  'joker-already-used',
  /**
   * The current question is unsuitable for a 50:50 - and because the draw can
   * come out either way, that is enough to refuse the draw itself.
   */
  'joker-not-applicable',
  /** A draw is already running; there is one screen, so there is one draw. */
  'joker-sequence-active',
  /** Nothing is running that could be continued. */
  'joker-no-sequence',
  /** A late command naming a draw that is over or not the one running. */
  'joker-sequence-stale',
  /** Nobody holds the buzz, so there is no player whose joker this would be. */
  'joker-no-answering-player',
  /** No such player in this game. */
  'unknown-player',
  /* ---- Die Videofrage ---- */
  /** Der Befehl nennt eine andere Frage als die, die gerade laeuft. */
  'video-question-mismatch',
  /** Zu dieser Frage ist kein Video hinterlegt - es gibt nichts abzuspielen. */
  'video-source-missing',
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
