# One Core, Three Contexts

This document describes how the quiz runs, in addition to stage operation, as a
standalone touch game and as an embedded game inside a multigame application -
without duplicating the game core.

The core is implemented (section 6); the interfaces for it are still pending.
The decisions in section 7 form the basis.

## 1. The Three Contexts

| Context | Operation | Who controls the flow | Window/process |
|---|---|---|---|
| **A - Stage** | Operator, moderator, hardware buzzer | Human (operator/moderator) | Electron with operator and presentation windows, LAN clients |
| **B - Standalone** | Touch, 1 or 2 players | Automatic, players tap themselves | Electron kiosk, one full-screen window |
| **C - Multigame** | Touch, 1 or 2 players | Automatic, players tap themselves | Third-party React shell, the quiz is a component within it |

B and C do **not** differ functionally. They differ only in who owns the
window, who starts and ends the game, and where the database and quiz package
live. That's why there aren't three applications, but **one game module and
three shells**.

## 2. Guiding Decision

The core (`@quiz/contracts`, `@quiz/domain`, `@quiz/content`, application
layer) remains the single source of truth for the game rules. It is
**extended**, not copied.

Two obvious shortcuts are deliberately **not** taken:

1. **No second flow.** No second state machine "for touch" is created. The
   difference between stage and self-service is configuration in the game
   state (`flowProfile`), not a second code path. Otherwise the two flows
   would drift apart within a few months, and every rule change would have to
   be thought through and tested twice.
2. **No operator simulator in the interface.** The touch client does not
   secretly send operator commands (`OPEN_BUZZER`, `LOG_OPTION_ANSWER`,
   `RESOLVE_ATTEMPT`). That would undermine role permissions, falsify the
   audit log ("operator logged in" even though no one was there), and make
   fairness in simultaneous tapping dependent on the network latency of three
   messages. Instead, there is a dedicated `player` role with exactly one
   atomic command.

## 3. Target Architecture

```text
                 apps/web            apps/kiosk          third-party Multigame shell
              (operator, stage,    (Electron full screen,   (React application)
               moderator)           attract screen)
                    |                    |                        |
                    |                    +-----------+------------+
                    |                                |
                    v                                v
        packages/presentation  <---------  packages/game
        (scenes, transitions,              (<QuizGame/>: connection,
         tokens, stage area)                touch input, lifecycle)
                    \                              /
                     \                            /
                      v                          v
                        packages/contracts (contracts)
                        packages/domain    (rules, projection)
                                |
                        packages/runtime   (QuizService, ports, timer)
                        /               \
        packages/server                 in-process start
        (HTTP + WebSocket)              (Electron main process)
                        \               /
                packages/persistence, packages/content
```

### Package Changes

| Package | Change | Rationale |
|---|---|---|
| `packages/presentation` | **new**, from `apps/web/src/presentation`, `ui/`, `theme/`, `styles.css` | `docs/architektur.md` has so far deliberately done without this package because there was only one consumer. From now on there are three. The condition stated there is thereby met. |
| `packages/game` | **new** | The playable quiz as a single React component with a lifecycle API. The only building block the multigame shell knows about. |
| `packages/runtime` | **done**, split out of `packages/server`: `QuizService`, `ContentService`, wiring | The core of the application layer must not depend on HTTP. After this, `packages/server` is only a transport adapter. |
| `packages/server` | shrinks to HTTP, WebSocket, network access, delivery | - |
| `apps/kiosk` | **new** | Electron shell for context B. |
| `apps/web`, `apps/desktop` | import `packages/presentation` instead of local folders | no behavior change |
| `packages/contracts`, `packages/domain` | extended (section 4) | - |
| `packages/persistence`, `packages/content` | unchanged | - |

### Transport: Deliberately the Same Everywhere

`startServer()` already runs today in the Electron main process
(`apps/desktop/src/main.ts`). Kiosk and multigame do the same, just on
`127.0.0.1` with port `0` and without LAN exposure. In all three contexts, the
renderer talks over the same WebSocket contract with the same `QuizService`.

This is the most important simplification of this design: **there is no
second transport, no second persistence, and no second content access.**
SQLite, crash recovery, idempotency, the audit log, and server-side filtering
of the solution apply unchanged in the kiosk.

To keep it that way, `packages/game` still introduces a narrow transport
interface (`send(envelope)`, `onMessage(...)`), today with exactly one
implementation (WebSocket). If the multigame shell later turns out to be a
pure browser application without a Node process, a second implementation is
added without touching a single scene.

## 4. What the Core Additionally Needs to Support

### 4.1 Flow Profile Instead of a Second Flow

New in `GameState` and in `START_GAME`:

```ts
export type FlowProfile = 'operated' | 'self-service'
```

The profile controls exclusively **who** triggers a transition and **which
transitions get scheduled automatically**. The phases themselves stay
identical.

| Point | `operated` (today) | `self-service` (new) |
|---|---|---|
| Question visible | Operator opens the buzzer | the question stands alone for `questionLeadInMs`, then the server opens the answers |
| Answer | Operator logs it in, resolves it | Player taps: one command, immediate evaluation |
| After the solution | Operator presses `Weiter` ("Continue") | a PLAYER presses `Weiter` - the server schedules nothing here |
| Video question | Operator starts it and switches over | runs automatically, then the question - it too stands alone at first |
| Image recognition | Operator can pause | runs through, tapping freezes it just like a buzzer |

Technically, this needs **no new mechanism**: the existing `pendingTransition`
with `ADVANCE_TIMED_PHASE` and a server-side fallback timer covers all
automatic transitions. What gets extended is `engine.ts` (scheduling
transitions when `flowProfile === 'self-service'`) and `allowedCommands.ts`
(not offering operator commands at all in the self-service profile).

The new hold times arrive as `selfServiceTiming` in
`packages/contracts/src/config.ts` - the same source of truth as
`gameTiming`.

### 4.2 One to Two Players

Today, the two-player setup is structurally fixed:
`players: [PlayerState, PlayerState]`.

Change: `players: PlayerState[]` with 1 or 2 entries, set at `START_GAME`
(`playerCount: 1 | 2`). `PlayerId` remains `player-1 | player-2`.

Functional consequences (single player = "like today, just without an
opponent"):

| Rule | Duel | Single player |
|---|---|---|
| Second chance | other player, 50 points | not applicable - straight to `solution` after the failed attempt |
| Lock after failed attempt | as today | has no effect, since there is no second player |
| Image recognition | both may buzz again | one attempt, then the solution |
| Result | winner or draw | no winner: score and hit rate |

For this, `nextPhaseAfterAttempt()` gets exactly one additional condition
("is there another, non-locked player?"). `determineResult()` additionally
returns `mode: 'duel' | 'solo'`, so the result scene doesn't have to guess.

Also affected: `projection.ts` (`playerScores`, `result`),
`StageHeader`/`ScoreTile` (single-column display), and the domain tests.

### 4.3 New Role `player`, Same Command Sequence

The `player` role is additionally added to `actorRoles` and `ClientRole`,
with access only via loopback (`checkAccess`).

There is no dedicated answer command (the original atomic
`ANSWER_BY_PLAYER` was removed again). Instead, `player` uses the operator
sequence itself: `BUZZ` claims the turn and locks out the other player
(engine-authoritative, `evaluateBuzz` just like the hardware buzzer),
`LOG_OPTION_ANSWER` marks the answer publicly and stays changeable until it
is resolved, `RESOLVE_ATTEMPT` submits it and evaluates it - the visible
confirmation step "submit answer and resolve" on the device. `BUZZ` and
`LOG_OPTION_ANSWER` are `revisionExempt`: physical events, or their immediate
consequence, not a decision based on an observed state. The binding step
`RESOLVE_ATTEMPT` keeps the revision check.

In addition, `player` is allowed to send `START_GAME`, but only with
`flowProfile: 'self-service'`. The same policy applies to the game commands:
the server only accepts `BUZZ`, `LOG_OPTION_ANSWER`, `RESOLVE_ATTEMPT`, and
`CONTINUE` from `player` in self-service games. Both are checked by the
application layer, not the interface.

Stage operation remains completely unaffected by this: in an operator-led
game, the server rejects every player command (`wrong-flow-profile`), and
`player` cannot reach any operator command.

### 4.4 Content: Which Questions Are Suitable for Self-Service?

Questions with `evaluationMode: 'manual-correct-incorrect'` (spoken answer,
evaluated by the operator) are **not playable** without an operator. They
must not be drawn in the kiosk.

Solution without special-case code in the engine:
`questionSlotRuleSchema.filters` gets `evaluationModes`. A kiosk preset can
thus filter on `option-comparison`. Content validation (`packages/content`)
additionally checks, per preset, whether enough self-service-suitable
candidates remain - the same warning threshold as today for small pools.

Recommended order: the kiosk starts with `text-choice` and `image-choice`;
`image-reveal` follows in stage 5 (works very well on touch),
`video-then-question` last.

## 5. The Three Shells

### 5.1 Context A - Stage

Unchanged. `apps/web` and `apps/desktop` only get the import from
`packages/presentation` and continue to start games with
`flowProfile: 'operated'`, `playerCount: 2`. The existing E2E tests are the
regression net for all stages.

### 5.2 Context B - Standalone (`apps/kiosk`)

- Electron, one window, `kiosk: true`, no menu, no operator window.
- The main process starts `startServer({ host: '127.0.0.1', port: 0 })`.
- Renderer shows: attract screen -> selection "1 player / 2 players" (and, if
  desired, quiz mode) -> `<QuizGame/>` -> result -> back to the attract
  screen.
- **Idle supervision** (belongs in the shell, not in the game core): if
  nothing happens for longer than `idleTimeoutMs`, the game is aborted and
  the attract screen returns. Without this, a kiosk device would get stuck on
  an open question, because the chosen single-player mode deliberately has no
  time pressure.
- Event day: the existing automatic day change (`ensureEventDay` with
  rollover) is sufficient; repeat avoidance thus works per device and day.

### 5.3 Context C - Multigame

The shell is a React application. It embeds:

```tsx
import { QuizGame, startQuizBackend } from '@quiz/game'   // Renderer
// in the shell's Electron main process:
const backend = await startQuizBackend({ databaseFile, packageDir })

<QuizGame
  endpoint={backend.endpoint}          // ws://127.0.0.1:<port>
  match={{ playerCount: 1 | 2, quizModeId?, presetId? }}
  idleTimeoutMs={120_000}
  onFinished={(result) => shell.showScore(result)}   // points, duration, hit count
  onExit={() => shell.backToMenu()}                  // exit by the players
/>
```

Rules so the component behaves like a good guest - they are part of the
contract and are tested:

- no `window.location` routing, no global keyboard handlers without
  `opt-in`;
- no global CSS: all styles under `.quiz-root` and via the existing color
  tokens as CSS custom properties;
- assets via a configurable base URL, never via absolute paths;
- `unmount` fully ends the connection, timers, and audio;
- pauses on `document.visibilitychange` when the shell covers the game.

If the shell turns out not to be React after all, only the outermost layer
changes: `packages/game` additionally gets a web-component or iframe shell
with the same lifecycle. The core stays the same.

## 6. Status and Open Work

Development ran on two lines for a while: `main` rebuilt the presentation
layer (CSS Modules, dedicated components under `stage/`, palette, kids'
world), while multi-context capability was built in parallel. Both touched
the same files. They were therefore not merged, but combined in the order in
which the stages build on one another - and the interface stages are
rebuilt on the new components rather than the old ones.

### Done on `main`

| Stage | Content |
|---|---|
| **Runtime package** | `packages/runtime` split out of `packages/server`. `createQuizRuntime()` is the shared wiring; `packages/server` is now only transport. |
| **Player count** | `players` is an array with one or two entries. Second chance only when an opponent is present, solo result with hit count instead of a winner. |
| **Flow profile** | `operated` and `self-service` in the game state, `player` role with the operator command sequence (`BUZZ`/`LOG_OPTION_ANSWER`/`RESOLVE_ATTEMPT`), automatic transitions via the existing timer mechanism. |
| **Content filter** | `evaluationModes` in the slot filter, three touch presets in the quiz package, suitability in the validation report, filtered catalog for the player view. |
| **Touch view** | `apps/web/src/game` with `<QuizGame/>`: start selection, foot bar, result. Both players stand side by side in front of the same image; at the bottom each has their own corner made of score card and buzzer, with the hint and `Weiter` in the middle. The four answers appear once above and use `AnswerList` - the same rows as in the hall. In single-player mode, the opponent and buzzer are omitted; the question counter takes over the now-free right-hand corner, so the middle stays the middle. Reachable at `/play`. |
| **Kiosk** | `apps/kiosk` as an Electron full-screen app: runtime in the same process, loopback only, no operator window, idle supervision as an operational feature. |
| **Embedding** | `onFinished`/`onExit`, teardown on removal, example collection at `/shell` as a test bed. |

With this, two of the three contexts are done: a game can be played from the
first question to the result without a single operator command - in the
browser at `/play` and on the kiosk device. This is verified by 167 unit
tests and 74 end-to-end tests, including one complete single-player game
without an operator; stage operation remained unchanged throughout, including
the stage's visual regression tests.

Of the four bugs from the first attempt, three were avoided during the
rebuild - the two socket bugs did not recur because the connection layer on
`main` had already fixed them, and the odd result is now pinned down by a
dedicated test. The fourth (`pendingStart`) is implemented as an intermediate
state.

### Open: The Third Context

What works today: stage (`/stage` with an operator) and the standalone touch
game (`/play`, kiosk). What doesn't work yet: the quiz as an importable
component of a THIRD-PARTY application.

The example collection at `/shell` already shows the full lifecycle - mount,
unmount, remount, without residue - but it lives in the same application and
therefore uses the same global stylesheets. A third-party application would
have to load them too, and would then get more than it bargained for.

| Stage | Content | What needs to be solved |
|---|---|---|
| **Package split of the presentation** | `apps/web/src/presentation` and `ui/` into `packages/presentation` | Mostly moving files. The stage's visual regression test is the safety net. |
| **Connection as a package** | `useQuizConnection` into `packages/client` | Small and mechanical. |
| **Game package** | `apps/web/src/game` into `packages/game`, output `<QuizGame/>` | Only after this can a third-party application write `import { QuizGame } from '@quiz/game'`. |
| **CSS encapsulation** | The global token layer must come along | This is the real issue, see below. |

**CSS encapsulation is the open question.** Everything component-like
already lives in CSS Modules and can't touch anything that isn't its own. The
global layer very much can:

| File | What the guest needs from it | Why it can't come along as-is |
|---|---|---|
| `palette.css` | the `--color-*` fallback values | sets them on `:root` |
| `tokens.css` | fonts, radii, durations | sets them on `:root` |
| `stage.css` | `.stage`, `.stage--*` | class selectors, comes along fine |
| `motion.css` | keyframes and transition classes | comes along fine |
| `base.css` | nothing | reset with `*`, `html`, `body` - belongs to the host |

The colors already travel along inline anyway (`themeVariables` sets them on
the component's root element); what remains to be solved is the rest of
`tokens.css`. The way there is a scoping class on the component's own root
element instead of `:root` - plus a test that pins exactly that down: no
selector in a bundled stylesheet may start with an element name, `*`, `html`,
`body`, or a bare `:root`.

## 7. Decisions Made

| Question | Decision |
|---|---|
| Platform for the touch variant | Electron kiosk, like `apps/desktop` |
| Embedding in the multigame app | React component from a workspace package |
| Single-player rules | like the duel, just without an opponent: no time pressure, no lives/streak system |
| Two players on one device | both stand side by side in front of the same image: at the bottom, each has a corner made of score card and buzzer in the player's color, with the answers appearing once above; whoever presses first gets them. Previously, two mirrored answer rows faced each other - the same four answers then appeared twice on the device. |
| Selection on the device | player count and difficulty; the quiz mode belongs to the setup |

## 8. Open Items

1. **Selection before the game in the kiosk**: only "1 or 2 players", or
   additionally quiz mode and difficulty? Both are cheap; it is purely a
   question of UI flow on the device.
2. **Leaderboard**: should the kiosk show scores across games? The database
   can't do this without a schema change; it would be a small migration.
3. **Sound in the kiosk**: permanently on, or muted with a visible switch?
4. **Quiz package in the kiosk**: bundled and only updated with a new
   program version, or should a device be able to reload content?
5. **Multigame shell**: does it live in this repository or in a third-party
   one? This decides whether `@quiz/game` stays a workspace package or has to
   be published as a package.

## 9. Risks

| Risk | Countermeasure |
|---|---|
| Stage flow breaks due to core changes | Every rule change is tested for both flow profiles; the existing E2E tests run at every stage |
| The touch client bypasses role permissions | `player` may only use the self-service sequence and a restricted `START_GAME`; this is checked server-side |
| Unfair outcome on simultaneous tapping | the turn is decided engine-authoritatively via `BUZZ` (revision-free); the server decides within one transaction |
| The embedded component disturbs the shell | encapsulation rules from section 5.3 as part of the contract, with a test for multiple embedding |
| Questions without options end up in the kiosk | filter in the preset plus validation warning, not only caught at runtime |
