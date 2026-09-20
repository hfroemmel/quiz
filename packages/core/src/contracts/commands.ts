/**
 * Typed commands (specification 18.3).
 *
 * Every state change goes through exactly one command. Manual player selection
 * and hardware buzzers pass the same server-side path and the same validation.
 *
 * Role permissions live exclusively in `commandRoles` below. Neither the
 * operator nor the moderator client may rebuild that table; visible buttons are
 * derived from `allowedCommands` of the view model.
 */
import { z } from 'zod'
import { flowProfiles, playerCountSchema, playerCounts, playerIds, type PlayerId } from './state'
import { patchableQuestionFieldsSchema } from './content'

/**
 * `player` is the role of the players at the touch device. It may do exactly
 * two things: begin or end a self-service game and tap an answer. No resolving
 * of other attempts, no score correction, no content.
 *
 * `moderator` leads through the evening: opening the buzzer, awarding the buzz,
 * logging the answer, resolving, advancing. Points, aborting the game, technical
 * matters and content stay with the operator.
 */
export const actorRoles = ['operator', 'moderator', 'system', 'buzzer', 'player'] as const
export type ActorRole = (typeof actorRoles)[number]

const playerIdSchema = z.enum(playerIds as unknown as [PlayerId, ...PlayerId[]])

/**
 * All commands as a discriminated union. New commands are added here; the
 * compiler then enforces their handling in the engine and their role mapping.
 */
export const commandSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('START_GAME'),
    /**
     * The chosen QUIZ TYPE (see `quizModeSchema`).
     *
     * EITHER THIS OR `audience` - never both. The quiz type already names
     * audience, pools and theme; if an audience came in beside it, there would
     * be two statements that can contradict each other. The server refuses such
     * a mixture.
     *
     * The desk starts through the quiz type. Devices without a quiz choice -
     * kiosk, touch device, embedded quiz - keep naming audience and preset.
     */
    quizId: z.string().min(1).optional(),
    /** Audience of the game (formerly `quizModeId`). */
    audience: z.string().min(1).optional(),
    /**
     * Question pools to draw from. Without them there is no pool filter - all
     * pools of the audience take part. A quiz type brings the pools of the
     * configuration; here they would be a second source.
     */
    poolIds: z.array(z.string().min(1)).min(1).optional(),
    /**
     * The difficulty as a preset.
     *
     * It belongs to a quiz type only if that type offers a choice
     * (`quizSupportsDifficulty`); otherwise the server refuses it. Without a
     * quiz type it is mandatory.
     */
    presetId: z.string().min(1).optional(),
    /**
     * Without it a duel is started. The stage operation therefore omits the
     * field; a solo game states it explicitly.
     */
    playerCount: playerCountSchema.optional(),
    /** Labels in player order. Missing entries are filled in. */
    playerLabels: z.array(z.string().min(1)).min(1).max(playerCounts.length).optional(),
    /** Without it an operated game is started. */
    flowProfile: z.enum(flowProfiles).optional(),
  }),
  /** Open the buzzer for the current question. */
  z.object({ type: z.literal('OPEN_BUZZER') }),
  /** Hardware buzzer. Key `A` = player 1, key `B` = player 2. */
  z.object({ type: z.literal('BUZZ'), playerId: playerIdSchema }),
  /** Fallback when the hardware fails. Same validation as `BUZZ`. */
  z.object({ type: z.literal('SELECT_PLAYER_MANUALLY'), playerId: playerIdSchema }),
  /** Log the named multiple-choice option (evaluation `option-comparison`). */
  z.object({ type: z.literal('LOG_OPTION_ANSWER'), optionId: z.string().min(1) }),
  /** Evaluate an oral answer by hand (evaluation `manual-correct-incorrect`). */
  z.object({ type: z.literal('MARK_MANUAL_ANSWER'), verdict: z.enum(['correct', 'incorrect']) }),
  /** Evaluate the logged attempt for good and book the points. */
  z.object({ type: z.literal('RESOLVE_ATTEMPT') }),
  /** Resolve without a player answer: no points. */
  z.object({ type: z.literal('RESOLVE_WITHOUT_ANSWER') }),
  /** Let the second chance pass: no points, no deduction. */
  z.object({ type: z.literal('PASS_SECOND_CHANCE') }),
  /** Discard the current player assignment and open the buzzer again. */
  z.object({ type: z.literal('RESET_BUZZER') }),

  z.object({ type: z.literal('START_IMAGE_REVEAL') }),
  z.object({ type: z.literal('PAUSE_IMAGE_REVEAL') }),
  z.object({ type: z.literal('RESUME_IMAGE_REVEAL') }),
  z.object({ type: z.literal('REVEAL_IMAGE_COMPLETELY') }),
  /** Technical correction: reveal back to second 10. Do not mix with RESET_BUZZER. */
  z.object({ type: z.literal('RESET_IMAGE_REVEAL') }),

  /**
   * Switch the language of the quiz.
   *
   * Like the sound it belongs to the DEVICE and not to the game: at the kiosk
   * device the switch sits on the start screen, where no game runs yet. A
   * running game switches along anyway - the questions are the same, only the
   * language differs.
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

  /** Manual score correction in steps of 100. */
  z.object({
    type: z.literal('ADJUST_SCORE'),
    playerId: playerIdSchema,
    direction: z.enum(['increase', 'decrease']),
    reason: z.string().optional(),
  }),
  /** Next question, or after the last question the result view. */
  z.object({ type: z.literal('CONTINUE') }),
  z.object({ type: z.literal('ABORT_GAME') }),
  /**
   * Take the result of a finished game off the screen and put the offer
   * overview back up.
   *
   * IT IS NOT A START AND NOT AN ABORT. The game stays finished - its result,
   * its log and its statistics are untouched; what changes is what the room
   * looks at. Between two rounds an evening needs that step: the operator
   * talks, the audience changes, and the result of strangers should not stand
   * over it until somebody starts the next game.
   */
  z.object({ type: z.literal('SHOW_START_SCREEN') }),
  /**
   * The quiz the console has chosen but not yet started.
   *
   * IT IS A DECISION, NOT A START. The choice used to live in the console's
   * own window, so the room's offer overview knew nothing of it - the card the
   * operator had picked was marked on their screen and nowhere else. It goes
   * through the server now, and every client reads it from the same state.
   *
   * The level travels with it because the two belong together: a level always
   * belongs TO a quiz, and a second field beside it could name the level of a
   * quiz nobody chose.
   */
  z.object({ type: z.literal('SELECT_QUIZ'), quizId: z.string().min(1), presetId: z.string().min(1).optional() }),
  /** Discard the current question and draw a replacement from the same slot. */
  z.object({ type: z.literal('SKIP_QUESTION'), reason: z.string().optional() }),
  /** Global sound status. */
  z.object({ type: z.literal('SET_SOUND_ENABLED'), enabled: z.boolean() }),
  /**
   * System command: ends a timed phase (feedback, pause screen).
   * Triggered by the server timer; the presentation may report it earlier, but
   * the transition of the rules does not depend on that.
   */
  z.object({ type: z.literal('ADVANCE_TIMED_PHASE'), transitionId: z.string().min(1) }),

  /* ---- Recovery and operation: handled by the application layer ---- */

  /** After a restart, resume the incomplete game that was found. */
  z.object({ type: z.literal('RESUME_GAME') }),
  /** Deliberately discard the incomplete game that was found. */
  z.object({ type: z.literal('DISCARD_RESUMABLE_GAME') }),
  /** Begin a new event day (resets the repetition history). */
  z.object({ type: z.literal('START_NEW_EVENT_DAY') }),
  /** Resets the counting of the game log. Games are not deleted. */
  z.object({ type: z.literal('RESET_GAME_STATISTICS') }),
  /** Local live hotfix of a question. The base package stays unchanged. */
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

/** One concrete command type picked from the union. */
export type CommandOf<T extends CommandType> = Extract<Command, { type: T }>

export const commandEnvelopeSchema = z.object({
  /** Unique id of the command. Repetitions are answered idempotently. */
  commandId: z.string().min(1).max(120),
  command: commandSchema,
  actor: z.object({
    clientId: z.string().min(1).max(120),
    role: z.enum(actorRoles),
  }),
  /** Revision on which the client made its decision. */
  expectedRevision: z.number().int().min(0),
  issuedAtClient: z.string().optional(),
})
export type CommandEnvelope = z.infer<typeof commandEnvelopeSchema>

/**
 * Role permissions: the single source of truth.
 *
 * According to specification 5.2 the moderator may, in the initial stage, only
 * resolve, advance, pause/resume the reveal and open the next answer phase.
 * Points, aborting, technical resets and content stay exclusively with the
 * operator.
 */
export const commandRoles: Record<CommandType, readonly ActorRole[]> = {
  START_GAME: ['operator', 'player'],
  OPEN_BUZZER: ['operator', 'moderator'],
  /*
   * `player` is self-service: there the on-screen buzzer replaces the hardware,
   * and the buzz is awarded on the server - not in the client. The same holds
   * for the three following steps: the player marks their answer
   * (LOG_OPTION_ANSWER), confirms it (RESOLVE_ATTEMPT), and only then it is
   * scored. It is the same command sequence as the operator's - on purpose: a
   * second answer mechanism would mean two fairness rules.
   * Whether a game accepts player commands is decided by the flow profile in
   * the server (`QuizService`), not by this table.
   */
  BUZZ: ['operator', 'buzzer', 'player'],
  /*
   * The moderator may also award the buzz by hand and log the answer. On the
   * stage evening they stand next to the players and are the first to see who
   * raised a hand - the operator sits at the desk. Scoring stays shared:
   * RESOLVE_ATTEMPT was open to the moderator already.
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
  /*
   * Anyone standing in front of the quiz may switch the language - at the
   * device the player, on the stage evening the operator. It changes no scoring
   * and no score.
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
   * `player` is self-service: there the solution stays until somebody taps
   * `Weiter`. Without this role the device would stop after every question.
   */
  CONTINUE: ['operator', 'moderator', 'player'],
  ABORT_GAME: ['operator', 'player'],
  /*
   * BOTH BELONG TO THE DESK ALONE. Taking a finished result off the screen and
   * choosing what comes next are decisions about the evening: the moderator
   * stands beside the players and the room's own screens send nothing at all.
   */
  SHOW_START_SCREEN: ['operator'],
  SELECT_QUIZ: ['operator'],
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
 * Commands WITHOUT a revision check - likewise the single source of truth.
 *
 * Background: `expectedRevision` protects against contradictory DECISIONS that
 * two clients make on the same state (specification 18.5). A buzzer, however, is
 * not a decision based on a state that was seen but a physical event: if the
 * operator opens the buzzer and a player presses 50 milliseconds later, the
 * client does not know the new revision yet. A refusal would be unacceptable in
 * live operation and would damage fairness.
 *
 * Fairness is still preserved because the server keeps deciding atomically:
 * phase, buzzer state and player lock are checked afresh on every event (see
 * `evaluateBuzz`), and after the first accepted buzz every further one is
 * refused.
 *
 * For all other commands - in particular resolving, advancing and score
 * corrections - the revision check applies unchanged.
 */
export const revisionExemptCommands: ReadonlySet<CommandType> = new Set<CommandType>([
  // Physical buzzer event or its manual fallback.
  'BUZZ',
  'SELECT_PLAYER_MANUALLY',
  /*
   * At the touch device the logging follows the player's own buzz immediately,
   * before its new revision has reached the client. It is also no final
   * decision: the mark stays changeable until the resolve, and the binding step
   * RESOLVE_ATTEMPT keeps the revision check. Phase, open attempt and used
   * options are checked afresh on logging anyway.
   */
  'LOG_OPTION_ANSWER',
  // Server-internal timer; the `transitionId` guards against double firing.
  'ADVANCE_TIMED_PHASE',
])

export function requiresRevisionCheck(type: CommandType): boolean {
  return !revisionExemptCommands.has(type)
}

/** Reasons for which the server refuses a command. */
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
  /* ---- Starting through a quiz type ---- */
  /** The named quiz type is not in the configuration - or incomplete. */
  'unknown-quiz',
  /**
   * The difficulty does not fit the quiz type: it is missing, does not belong
   * to it, or the type offers no choice at all and still receives one.
   */
  'invalid-difficulty',
  'attempt-already-resolved',
  'answer-not-logged',
  /** This option was already evaluated as wrong in an earlier attempt. */
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
  'no-candidate-question',
  'nothing-to-resume',
  'invalid-patch',
  'persistence-error',
  'unknown-command',
] as const
export type CommandRejectionReason = (typeof commandRejectionReasons)[number]

export interface CommandRejection {
  reason: CommandRejectionReason
  /** Plain text for the operator, including a safe next action. */
  message: string
  currentRevision?: number
}
