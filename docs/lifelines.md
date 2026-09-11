# Lifelines (50:50 and audience)

Every player gets one 50:50 and one audience lifeline per game. Each is spent
once and comes back only with a new game - not with a new question, not with a
new round, not with a reload.

The word in the code is **lifeline**, everywhere. "Joker" appears only in text a
person reads.

## How an integration switches them on

Lifelines are **off** unless a host asks for them. A host that says nothing gets
exactly the game it had before: no dots, no commands, not one element more in
the DOM.

```ts
interface LifelineConfig {
  enabled: boolean
  types: { fiftyFifty: boolean; audience: boolean }
  activationMode: 'operator' | 'player'
}
```

The configuration belongs to the **installation**, not to the game state. A
partial object is enough - `normalizeLifelineConfig` fills the rest, and
`enabled: true` without a single type is normalized back to off.

| Integration | Where it is passed | Value |
| --- | --- | --- |
| Live quiz | `createQuizRuntime` / `startServer` in `quiz-live` | `liveLifelines`: both types, `activationMode: 'operator'` |
| Kiosk, standalone, app collection | `new LocalQuizRuntime({ lifelines })` | left out today, so off |
| Test rig (`/play`) | `?lifelines=1` | both types, `activationMode: 'player'` |

`activationMode` is the only thing that differs between the two worlds: on stage
a player asks out loud and the operator triggers it; at a kiosk the player taps
their own dot. It is **not** a second set of rules - the engine validates
identically either way, the mode only decides whose command is accepted
(`QuizService.dispatch`).

## Commands

| Command | Roles | Effect |
| --- | --- | --- |
| `USE_LIFELINE { playerId, lifelineType }` | `operator`, `player` | Marks the lifeline spent; for `fiftyFifty` also stores the hidden answers |
| `RESTORE_LIFELINE { playerId, lifelineType }` | `operator` | Hands the lifeline back; if its effect is still on screen, the answers reappear |

A `player` command is additionally checked against the flow profile (self-service
only) and against `activationMode`. Restoring is administrative and stays with
the operator in every integration.

Refusals carry a structured reason, so the operator's desk can show a sentence
rather than a shrug: `lifelines-disabled`, `lifeline-type-disabled`,
`lifeline-already-used`, `lifeline-not-used`, `lifeline-not-applicable`,
`lifeline-effect-active`, `unknown-player`, plus the general `invalid-phase`,
`attempt-already-resolved` and `answer-not-logged`.

## Events

`deriveQuizEvents(prev, next)` reports `lifelineUsed` and `lifelineRestored`,
each with `playerId` and `lifelineType`. Like every event there, they are derived
from two snapshots - a host learns about them without listening to the transport,
and a client that reconnects mid-game does not replay them.

## State

Three things, deliberately apart, because they have three lifetimes:

- `LifelineConfig` - what the installation offers. On the host.
- `PlayerState.lifelines` - what a player has spent in **this** game. Per player
  id, keyed by type. Optional, so a game saved before the feature existed
  resumes; always read it through `lifelinesOf(player)`.
- `GameState.activeFiftyFifty` - what the 50:50 does to the question **on
  screen**: `{ playerId, questionId, hiddenOptionIds }`. Cleared at the one place
  a new question arrives.

The third is why the first two cannot be merged: a single flag would either bring
the hidden answers back on the next question or keep the lifeline spendable for
ever.

In the snapshot: `PublicScore.lifelines` (absent where none are offered),
`PublicOption.hidden`, `PublicQuizViewModel.activeFiftyFifty` and
`OperatorQuizViewModel.lifelines` - the last one being ready-to-render buttons
with `canUse`, `canRestore` and `blockedReason`.

## The 50:50

Allowed only while a question is on screen and still open, the player still has
the lifeline, no answer is logged or scored, no other 50:50 is in effect on the
question, the question has exactly one correct answer and at least **three**
options. Below three it is refused and **not** spent - removing one of two would
not be a hint but the solution.

On activation the correct answer stays, exactly one wrong answer stays, and
everything else is hidden - whether the question has three, four or seven
options. The surviving wrong answer is drawn **once, on the server**, from an
injected source of chance (`EngineContext.random`), and the ids travel in the
snapshot, so every client hides the same pair instead of reproducing a seeded
draw. No answer is selected on the player's behalf.

On screen the hidden answers keep their place, their height and their letter and
are only dimmed - re-flowing four rows into two would move the target out from
under a thumb on its way. They are taken out of reach in the component
(`disabled`, `aria-hidden`), never by the look alone.

## The audience lifeline

No digital vote. The player asks out loud, the operator triggers the lifeline,
the server records that it is spent, and the stage shows the dot as used. The
questioning of the room happens in the room. No invented percentages, no random
answer, no timer is paused - the operator's existing functions stay responsible
for that.

### Adding a real vote later

The shape is already there; a vote is a fourth piece of state, not a rebuild:

1. Extend `LifelineUsage` for the audience type with a result -
   `{ votes: Record<string, number>, closedAtMs }` - or add
   `GameState.activeAudienceVote` next to `activeFiftyFifty` if the vote should
   have its own lifetime (open, closing, closed).
2. Add the commands that drive it (`OPEN_AUDIENCE_VOTE`, `CAST_AUDIENCE_VOTE`,
   `CLOSE_AUDIENCE_VOTE`) and give the voting role its entry in `commandRoles`.
   `USE_LIFELINE` stays what it is: the moment the lifeline is spent.
3. Project the result into `PublicQuizViewModel` and render it wherever the
   stage wants it. The dots need no change - "spent" already means what it
   means.

Nothing in the list above touches the availability model, the reset lifecycle or
the operator's buttons.

## The display

`Lifelines` (exported from `@hfroemmel/quiz-react`) renders the dots for one
player: filled in the accent of the stage while a lifeline is there, muted,
dimmed and **crossed out** once it is spent. The diagonal line is what carries
the state without colour.

Mirrored for player 2, so the 50:50 sits next to the player number on both sides
of the stage. On the tile of the player whose turn it is - accent coloured in the
hall - the dot trades its two tokens around, because an accent dot on an accent
tile is no dot at all.

Without `onUse` the dots are pure status and catch nothing: that is the live
stage. With it, every dot becomes a button with a hit area of at least
44 x 44 px around the small visible dot.

## Files

**`hfroemmel/quiz`**

| File | What changed |
| --- | --- |
| `packages/core/src/contracts/lifelines.ts` | new: types, config, rules, helpers |
| `packages/core/src/contracts/state.ts` | `PlayerState.lifelines`, `GameState.activeFiftyFifty` |
| `packages/core/src/contracts/commands.ts` | the two commands, roles, rejection reasons |
| `packages/core/src/contracts/viewModels.ts` | `PublicLifelineStatus`, `PublicScore.lifelines`, `PublicOption.hidden`, `activeFiftyFifty`, `OperatorLifelineControl` |
| `packages/core/src/engine/lifelines.ts` | new: the decision functions and the draw |
| `packages/core/src/engine/engine.ts` | the two handlers, init at `START_GAME`, effect cleared on a question change |
| `packages/core/src/engine/allowedCommands.ts` | the commands appear only while some button is live |
| `packages/core/src/engine/projection.ts` | status, hidden options, operator buttons |
| `packages/core/src/engine/events.ts` | `lifelineUsed`, `lifelineRestored` |
| `packages/core/src/runtime/quizService.ts` | config, source of chance, the `activationMode` guard |
| `packages/core/src/runtime/localRuntime.ts` | `lifelines` option |
| `packages/react/src/presentation/stage/Lifelines.tsx`, `.module.css`, `lifelineIcons.tsx` | new: the dots and the icon family |
| `packages/react/src/presentation/stage/Score.tsx`, `Score.module.css` | the dots next to the player number |
| `packages/react/src/presentation/stage/AnswerList.tsx`, `.module.css`, `answerState.ts` | hidden answers |
| `packages/react/src/presentation/stage/StageHeader.tsx`, `texts.ts` | passing them through, and the wording |
| `packages/kiosk/src/game/PlayerFoot.tsx`, `QuizGame.tsx` | the kiosk path, off by default |
| `harness/src/*` | `?lifelines=1`, and the preview switch |

**`hfroemmel/quiz-live`**

| File | What changed |
| --- | --- |
| `packages/server/src/createRuntime.ts` | `liveLifelines` and the option |
| `packages/server/src/startServer.ts` | passing it through |
| `apps/web/src/apps/operator/LifelinePanel.tsx`, `.module.css` | new: the desk |
| `apps/web/src/apps/operator/OperatorApp.tsx` | the panel in the side column |

## Tests

| Suite | Count | What |
| --- | --- | --- |
| `packages/core/test/lifelines.test.ts` | 27 | availability, independence, the once-only rule, the reset lifecycle, all 50:50 rules, two simultaneous activations, restoring, the operator's buttons |
| `packages/server/test/lifelines.test.ts` | 9 | the server owns the state, one snapshot for every role, a restart, an idempotent repeat, who may spend one, an installation without lifelines |
| `test/e2e/lifelines.spec.ts` (quiz) | 10 | both themes, both dot states, the mirroring measured, reduced motion, hidden answers out of the reading order, single player, and a game with lifelines off |
| `test/e2e/lifelines.spec.ts` (quiz-live) | 5 | the desk, the confirmation, the same answers on stage and desk, the reason for a refusal, restoring, and a reload of both views |

Run with `pnpm test` and `pnpm test:e2e` in each repository.
