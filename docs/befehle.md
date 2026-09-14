# Commands and role permissions

Every state change goes through exactly one typed command. The table below is
generated from `packages/contracts/src/commands.ts` - that is the single
source of truth (`commandRoles`). Neither the operator nor the moderator
client rebuilds it: both read `allowedCommands` from the view model.

## Envelope

```ts
interface CommandEnvelope {
  commandId: string        // unique; repeats are answered idempotently
  command: Command         // discriminated union
  actor: { clientId: string; role: 'operator' | 'moderator' | 'system' | 'buzzer' | 'player' }
  expectedRevision: number // revision the client decided on
  issuedAtClient?: string
}
```

## Server-side processing

1. validate schema (Zod)
2. answer an already-processed `commandId` idempotently
3. check role (`commandRoles`)
4. check `expectedRevision` (see "Revision check" column)
5. compute the new state via the domain engine
6. save state, score booking, usage, and audit log in ONE transaction
7. increment revision and distribute role-dependent snapshots

## Quiz type or audience

`START_GAME` knows two paths, and exactly one of them per command:

* **With `quizId`**: the podium's path. The quiz type already names the
  audience, pools, and theme (see
  [neue-modi-und-presets.md](neue-modi-und-presets.md)); `presetId` only
  belongs there if the quiz type offers a difficulty choice. The server
  rejects an additional `audience` or `poolIds` - that would be a second
  statement of the same thing.
* **With `audience` and `presetId`**: the path for devices without a quiz
  selection (kiosk, touch device, embedded quiz).

Rejection reasons: `unknown-quiz` for a quiz type that does not exist or whose
pool or theme is missing; `invalid-difficulty` if the difficulty is missing,
does not belong to the quiz type, or is sent even though the quiz type does
not offer one.

## Player count and control profile

`START_GAME` optionally carries `playerCount` (1 or 2), `playerLabels`, and
`flowProfile` (`operated` or `self-service`). Without it, a duel results,
controlled by an operator; the on-stage setup therefore never sends any of
this. The effects are described in
[zustandsmaschine.md](zustandsmaschine.md#player-count).

The `player` role is explicitly only allowed to start self-service games. This
is checked by the application layer (`@quiz/runtime`), not the UI: a game that
waits for an operator that does not exist on the device would otherwise be
startable.

## Table

| Command | allowed roles | Revision check |
|---|---|---|
| `START_GAME` | operator, player | yes |
| `OPEN_BUZZER` | operator, moderator | yes |
| `BUZZ` | operator, buzzer, player | no |
| `SELECT_PLAYER_MANUALLY` | operator | no |
| `LOG_OPTION_ANSWER` | operator, player | no |
| `MARK_MANUAL_ANSWER` | operator | yes |
| `RESOLVE_ATTEMPT` | operator, moderator, player | yes |
| `RESOLVE_WITHOUT_ANSWER` | operator, moderator | yes |
| `PASS_SECOND_CHANCE` | operator, moderator | yes |
| `RESET_BUZZER` | operator | yes |
| `START_IMAGE_REVEAL` | operator, moderator | yes |
| `PAUSE_IMAGE_REVEAL` | operator, moderator | yes |
| `RESUME_IMAGE_REVEAL` | operator, moderator | yes |
| `REVEAL_IMAGE_COMPLETELY` | operator | yes |
| `RESET_IMAGE_REVEAL` | operator | yes |
| `START_VIDEO` | operator | yes |
| `SHOW_QUESTION_AFTER_VIDEO` | operator, moderator, player | yes |
| `ADJUST_SCORE` | operator | yes |
| `CONTINUE` | operator, moderator, player | yes |
| `ABORT_GAME` | operator, player | yes |
| `SKIP_QUESTION` | operator | yes |
| `SET_SOUND_ENABLED` | operator, player | yes |
| `ADVANCE_TIMED_PHASE` | system, operator | no |
| `RESUME_GAME` | operator | yes |
| `DISCARD_RESUMABLE_GAME` | operator | yes |
| `START_NEW_EVENT_DAY` | operator | yes |
| `APPLY_QUESTION_PATCH` | operator | yes |
| `RESET_GAME_STATISTICS` | operator | yes |

## Why some commands run without a revision check

`expectedRevision` protects against conflicting **decisions** that two clients
make based on the same state. A buzz, however, is not a decision based on an
observed state, but a physical event: if the operator opens the buzzer and a
player presses it 50 milliseconds later, their client does not yet know the
new revision. A rejection would be unacceptable in live operation.

Fairness is still maintained because the server keeps deciding atomically:
phase, opening, and player lock are freshly checked on every event, and after
the first accepted buzz, every further one is rejected.

The only exceptions are `BUZZ`, `SELECT_PLAYER_MANUALLY`, `LOG_OPTION_ANSWER`,
and `ADVANCE_TIMED_PHASE` (protected by `transitionId`).

`LOG_OPTION_ANSWER` is on this list because logging in on the touch device
follows immediately after the player's own buzz - in a single-player game even
within the same finger tap - before its new revision has reached the client.
It is also not a final decision: the mark remains changeable until resolution,
and the binding step `RESOLVE_ATTEMPT` retains the revision check. Phase, open
attempt, and used options are checked freshly again anyway when logging in.

## The self-service sequence

On the touch device there is no separate answer command. The `player` role
uses the same command sequence as the operator console: `BUZZ` claims the turn
(the first valid one locks out the other player; the same function judges it
as with the hardware buzzer, `evaluateBuzz`), `LOG_OPTION_ANSWER` marks the
answer publicly and remains changeable until resolution, `RESOLVE_ATTEMPT`
submits it and evaluates it. After the solution, `CONTINUE` advances. A player
may only send these four commands in games with `flowProfile: 'self-service'`;
this is checked by the application layer (`@quiz/runtime`), because the engine
does not know the sender.

## Roles in plain language

**Operator** (only from the event laptop) has full technical control: start
and abort the game, buzzer and player assignment, log and evaluate answers,
resolve, advance, control image reveal and video, correct points, sound and
fullscreen, skip, correct, or disable questions, technical recovery.

**Moderator** (iPad on the LAN, session code required) is allowed to do
exactly four things in the initial stage: resolve, `Weiter` ("Continue"),
pause and resume the image reveal, open the next answer phase. They are
**not** allowed to: change points, abort the game, change technical settings,
edit content, or reset data. Moderator actions appear in the operator log.

**Stage clients** are not allowed to send any control commands at all -
without exception. They also do not report anything back about the video;
whatever loads, plays, or fails there stays in the window (see
`docs/zustandsmaschine.md`).

## Rejection reasons

| Reason | Meaning |
|---|---|
| `invalid-payload` | schema or reference invalid |
| `forbidden-role` | role is not allowed to trigger this command |
| `revision-conflict` | the game state has changed in the meantime |
| `wrong-flow-profile` | the command does not fit the game's control profile |
| `invalid-phase` | this action does not exist in this phase |
| `no-active-game` | no game is running |
| `buzzer-closed` / `buzzer-already-taken` / `player-locked` | buzzer rules |
| `no-pending-attempt` / `attempt-already-resolved` / `answer-not-logged` | answer flow |
| `no-candidate-question` | no candidate for the question slot |
| `nothing-to-resume` | no interrupted game present |
| `invalid-patch` | hotfix does not match the base package |
| `persistence-error` | saving failed - no further irreversible actions |

Every rejection includes a plain-text message with a safe next action.
