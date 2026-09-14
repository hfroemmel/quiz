# Database and recovery

The runtime database is SQLite and lives by default under
`runtime/quiz.sqlite` (changeable via `QUIZ_DB`). It is not part of the
repository.

## Contents

| Table | Contents |
|---|---|
| `event_days` | event days, the reference frame for the repeat history |
| `games` | games with mode, preset, and status |
| `game_state` | current authoritative game state as a snapshot |
| `attempts` | all answer attempts, normalized |
| `score_transactions` | every score booking, automatic and manual |
| `question_usage` | global usage history with question, repeat group, and slot |
| `processed_commands` | already processed command IDs (idempotency) |
| `question_patches` | local live hotfixes with old and new value |
| `audit_log` | audit log of all events |
| `settings` | sound state, active package version, game log starting point |
| `schema_migrations` | applied migrations |

## Transactions

A relevant action is stored atomically. Example `RESOLVE_ATTEMPT`:

```text
Evaluate attempt + score booking + phase transition + audit log + new revision
= one database transaction
```

The new state is distributed only after a successful commit. If the save
fails, the last consistent state is preserved, the command is rejected with
`persistence-error`, and the operator sees a plain-text warning.

## Migrations

`packages/persistence/src/migrations.ts` contains an ordered list of SQL
steps. Each step runs exactly once and is recorded in `schema_migrations`.
New changes are **appended at the end**; existing steps are never changed, so
that existing event databases stay readable.

## Behavior after a restart

1. check the active quiz package version (schema version and checksum)
2. load the last active event day
3. detect an incomplete game
4. reconstruct the saved state and running clocks
5. **let the operator decide**: resume or deliberately discard
6. on resume, synchronize all clients with a complete snapshot

The game is never resumed automatically. The start screen instead shows
"Interrupted game found" with mode, preset, and score.

### Deterministic strategy for running clocks

For live safety, "restore paused after a crash" applies deliberately:

* A **running reveal** at the time of the crash is restored as `paused`,
  frozen at the last persisted state; the phase is set to `reveal-paused`
  accordingly. The buzzer stays open.
* A **running video** is paused at the last known position.
* A **timed transition** (feedback, break screen) is completed immediately
  on resume, instead of waiting out a deadline that has long since expired.

## Reconnect

After a network interruption, a client immediately receives:

* the complete, role-dependent snapshot
* the current revision
* the server time for synchronization
* the allowed commands
* the running reveal or video state, if any

Clients never need to reconstruct missed individual events. The web client
reconnects automatically with increasing intervals (0.5 s to 8 s).

## Event day

The repeat history applies globally for an event day - independent of mode
and preset. A calendar day change does not reset a **running** game: the
change only happens when no active game exists. The operator can start over
deliberately via "Start new event day".

## Game log

How many games have run per quiz mode follows from the `games` table -
there is no second count that could drift out of sync. Counting spans event
days; the log answers "what have we already played with this setup", not
"what ran today".

Because the numbers live in the server's database rather than in the
browser, they survive closing the window, restarting the application, and
switching the operating device.

`RESET_GAME_STATISTICS` resets the **count**, not the data: the command
writes the current timestamp to `settings.statistics-since`, and the
evaluation only counts games from that point on. Deleting rows from `games`
would not be an alternative - game state, attempts, score bookings, and the
audit log depend on them.

## Backup during the event

The file `runtime/quiz.sqlite` (plus `-wal` and `-shm`) can be copied at any
time. For a backup between two games, copying the `runtime/` directory is
enough.
