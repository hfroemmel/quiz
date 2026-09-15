# Status of the split

The split of the system into published packages and standalone application
repositories runs in phases. This file records what is done and what is next.

## Done

| Phase | Content |
|---|---|
| 0 | CI regression net (`ci.yml`), three-tier Chromium resolution |
| 1 | Emit setup: `dist` per package, `publishConfig`, publint/attw on the tarball |
| 2 | Paths come from the caller; the repo-root oracle is gone |
| 3 | Kiosk self-service uses the operator command sequence (buzz, log in, submit) |
| 4 | `QuizRuntime` contract, `QuizScene`, event derivation, theme as a host concern |
| 5 | Five packages `@hfroemmel/quiz-{core,content,themes,react,kiosk}`, schema v2 |
| 6 | Changesets (fixed), `release.yml`, Vite lib builds, 0.1.0 publish |
| 7 | Content moved to `quiz-content-data`, test fixtures here, content profiles, `pull` |
| 8 | Stage operation moved to `quiz-live`: server, persistence, role clients, Electron shell |
| 9 | Kiosk moved to `quiz-standalone`: `LocalQuizRuntime` in a window, no server, no network |
| 10 | `app-collection`: game collection with an embedded quiz, setup and teardown by the host |
| 11 | Teardown: applications, server, and persistence leave this repository |

Proof per phase: `pnpm typecheck`, `pnpm test`, `pnpm packages:verify`
(publint + attw on the packed tarballs), and `npx playwright test` -
including unchanged screenshot baselines.

After the teardown, 149 unit tests and 58 end-to-end tests remain here; the
rest moved with their subject matter (35 server and persistence tests to
`quiz-live`, likewise the gameplay flows).

## CI is running

The previously reported account blocker is gone: since August 27, the
GitHub-hosted runners start. The first fully green run has arrived - both
`checks` (typecheck, unit tests, `packages:verify`, production build) and
`e2e` (80 Playwright tests in a container, about nine minutes) succeed.

One adjustment was needed for this: since phase 7, `content/dist` is no
longer versioned, so both jobs now build the quiz package before the test run.

## Published versions

| Version | What |
|---|---|
| 0.1.0 | First publish of all five packages |
| 0.2.0 | `QuizGame` takes the runtime from the host (`runtime` prop) |

The path is the documented one: the release workflow creates the "Version
Packages" PR, and merging it publishes.

Two observations for the next release:

- The version PR comes from `github-actions[bot]`; its CI run stays at
  `action_required` and needs a one-time *Approve and run*. This has no
  effect on the content - the version PR only changes `package.json`
  versions and changelogs, and `main` re-checks regardless.
- The changesets action creates version tags but cannot push them from this
  work environment (GitHub answers `refs/tags/*` with 403). Their origin is
  recorded in the changelogs and at the merge commit; whoever needs the tags
  sets them from their own working copy.

## Blocked

1. **The packages are not yet released to the application repositories.**
   Their CI runs fail at the registry with `403`, even though the token is
   valid and the job has `packages: read`: a private package belongs only to
   the repository it was published from. Remedy: for each of the five
   packages, under *Package settings -> Manage Actions access -> Add
   repository*, add the consuming repository with `Read` - for `quiz-live`,
   `quiz-standalone`, and `app-collection`.
2. **The media is missing from `quiz-content-data`.** The LFS endpoint
   (`lfs.github.com`) is blocked from within the migration session. The text
   content there is complete; the repository's README names the commands for
   the one-time upload from a working copy.

## The split stands

| Repository | What |
|---|---|
| `quiz` | the five libraries plus the test harness |
| `quiz-live` | stage operation: server, persistence, role clients, Electron shell |
| `quiz-standalone` | kiosk: one window, no server, no network |
| `app-collection` | game collection with an embedded quiz |
| `quiz-content-data` | the editorial content |

All three application repositories consume `@hfroemmel/quiz-*@^0.2` from
GitHub Packages. The packages are published; what each repository still
lacks is read access (see blocker 1).

Two points were deliberately NOT carried along in the teardown:

- The embedding test "no connection is left behind" depended on a server
  that counted its clients. There is no longer one in the test harness; the
  corresponding commitment - whoever provides the runtime cleans it up - is
  verified by `app-collection` at its session level, without a window.
- `docs/` continues to describe the system as a whole. Some documents belong
  topically to stage operation; they remain here for now.
