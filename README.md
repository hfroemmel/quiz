# Live Quiz - the libraries

This repository ships the five libraries of the Live Quiz. The applications
live in their own repositories and pull them in as packages.

| Package | Contents |
|---|---|
| `@hfroemmel/quiz-core` | Contracts, engine, runtime (`QuizService`, `LocalQuizRuntime`, `RemoteQuizRuntime`) |
| `@hfroemmel/quiz-content` | Content pipeline: validation, package build, legacy import, CLI |
| `@hfroemmel/quiz-themes` | Color palettes, fonts, theme objects, `palette.css` / `fonts.css` |
| `@hfroemmel/quiz-react` | `QuizScene`, `StageScreen`, scenes, sounds, connection hooks |
| `@hfroemmel/quiz-kiosk` | The playable quiz as a single component (`QuizGame`) |

| Application | Repository | What it is |
|---|---|---|
| Stage operation | `hfroemmel/quiz-live` | Server, operator desk, stage screen, host, buzzer device |
| Kiosk | `hfroemmel/quiz-standalone` | A single window in the foyer, no server, no network |
| Game collection | `hfroemmel/app-collection` | Menu with an embedded quiz |
| Content | `hfroemmel/quiz-content-data` | The editorial questions and media |

## The test harness

`harness/` is the only runnable application here - and it is never shipped.
It carries the screenshot references and the embedding contract:

| Route | What |
|---|---|
| `/preview` | Call up scenes and transitions individually, with both themes |
| `/play` | The player view as seen on the buzzer device |
| `/shell` | An example host application that embeds the quiz |

All three run without a server: the quiz runs through a `LocalQuizRuntime` in
the browser, and the development server only serves the files and the built
quiz package.

## Quick start

```bash
pnpm install
pnpm content:build   # build the quiz package from the test fixtures under content/source
pnpm harness         # test harness at http://localhost:5180
```

The test fixtures are GENERATED (`pnpm content:fixtures`): 29 synthetic
questions and placeholder media, just enough to fill every question slot of
every preset. The real content lives in `quiz-content-data`.

## Checks

```bash
pnpm typecheck        # TypeScript across packages and the test harness
pnpm test             # core, content pipeline, palette guard (279 tests)
pnpm test:e2e         # Playwright against the harness (100 runs, screenshot baselines)
pnpm packages:build   # dist per package
pnpm packages:verify  # publint + attw on the packed tarball
```

Stage operation - server, SQLite, WebSocket, resumption - is verified in
`quiz-live`, offline operation in `quiz-standalone`, and the embedding
contract additionally in `app-collection`.

Baseline of the refactoring (branch `refactor`, 2026-09-14): typecheck clean,
279 unit tests and 100 end-to-end runs green. Every phase of
`docs/refactoring/H-migration-plan.md` has to reproduce these numbers before
it is merged.

## Publishing

Changesets with fixed versioning across all five packages; a push to `main`
with open changesets creates the "Version Packages" PR, and merging it
publishes to GitHub Packages. Details in
[docs/veroeffentlichung.md](docs/veroeffentlichung.md).

## Documentation

`docs/` describes the system as a whole - specification, state machine,
design system, content format. Some documents belong topically to stage
operation (operator quick reference, database and recovery); they remain
here for now because they refer to the same specification as the packages.

[docs/migration-status.md](docs/migration-status.md) records how the split
has gone and what is still outstanding.
