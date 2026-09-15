# Architecture

## Layers and dependency direction

```text
UI (React) / Electron
        ↓
Transport adapters    (packages/server: HTTP, WebSocket)
        ↓
Application services  (packages/runtime)
        ↓
Domain and contracts  (packages/domain, packages/contracts)

Persistence / WebSocket / Hardware
        ↓ implement ports of the application layer
```

`@quiz/domain` knows neither React nor Electron, WebSocket nor SQLite.
That's why all rule tests run with a fake clock and without a UI.

## Who is responsible for what?

| Package | Responsibility | Does NOT know |
|---|---|---|
| `@quiz/contracts` | Types, Zod schemas, commands, role permissions, view models, `scoringRules`/`gameTiming` | anything else |
| `@quiz/domain` | State machine, scoring, buzzer rules, question selection, projection | filesystem, network, time source |
| `@quiz/content` | Legacy import, validation, package build, hotfix overlay | game rules, network |
| `@quiz/persistence` | SQLite schema, migrations, transactional commit | game rules |
| `@quiz/runtime` | Command processing, idempotency, timers, recovery, content access, snapshots | transport, UI, game rules (delegated to domain) |
| `@quiz/server` | HTTP delivery, WebSocket distribution, sessions and access rules | command processing (delegated to runtime) |
| `apps/web` | Rendering view models, sending commands, presentation | game rules |
| `apps/desktop` | Windows, displays, preload bridge, process startup | game rules |

## Where do I change what?

| Change | Location |
|---|---|
| Scoring rule | `packages/domain/src/scoring.ts` and `scoringRules` in `@quiz/contracts` |
| Buzzer authorization | `packages/domain/src/buzzer.ts` |
| Phase transitions | `packages/domain/src/engine.ts` |
| Question selection, repeat avoidance | `packages/domain/src/selection.ts` |
| What the stage screen is allowed to see | `packages/domain/src/projection.ts` |
| Available buttons per phase | `packages/domain/src/allowedCommands.ts` |
| Database schema | `packages/persistence/src/migrations.ts` |
| Animation duration, easing, sound cue | `apps/web/src/presentation/transitions/` |
| Business-relevant timings | `gameTiming` in `packages/contracts/src/config.ts` |

## Two deliberate deviations from the specification

Both are expressly permitted under section 20.3 of the specification
("Separate packages only make sense if they represent a genuine functional
boundary").

1. **No dedicated `packages/presentation` package.**
   The presentation layer lives under `apps/web/src/presentation/` and keeps
   exactly the internal structure proposed in section 22.2 (`scenes/`,
   `transitions/`, `animationPresets.ts`, `soundCues.ts`, `README.md`). The
   only consumer is the React entry point in the same package; a package
   boundary here would not have represented a functional boundary, but would
   have complicated the build.

2. **No dedicated `packages/ui` package.**
   There are so far only four shared building blocks (`ScoreBoard`,
   `PlayerBadge`, `Confetti`, `ConnectionBanner`). They live under
   `apps/web/src/components/`. Abstraction happens only once a second real
   consumer exists.

## Flow of a command

```text
Client (operator / host / buzzer)
  → WebSocket message with CommandEnvelope
  → QuizService: schema, idempotency, role, revision
  → Domain engine: reduce(state, command, ctx)
  → QuizStore: ONE transaction (state + score + usage + audit + revision)
  → Broadcast role-dependent snapshots to all clients
```

Distribution only happens after a successful commit. If the transaction
fails, the last consistent state is preserved and the operator gets a
plain-text error.

## Ports

| Port | Defined in | Implemented by |
|---|---|---|
| `QuestionSource` | `packages/domain/src/engine.ts` | `packages/runtime/src/contentService.ts` |
| Time (`nowMs`) | `EngineContext` | Server, or fake clock in tests |
| Randomness (`Rng`) | `packages/domain/src/selection.ts` | Server, or `createSeededRng` in tests |
