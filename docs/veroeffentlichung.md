# Publishing the packages

The five libraries of the quiz system appear as PRIVATE packages on GitHub
Packages under the scope `@hfroemmel`:

| Package | Contents |
|---|---|
| `@hfroemmel/quiz-core` | Contracts, engine, runtime (QuizService, Local-/RemoteQuizRuntime) |
| `@hfroemmel/quiz-content` | Content pipeline: validation, package build, legacy import, CLI |
| `@hfroemmel/quiz-themes` | Color palettes, fonts, theme objects, palette.css/fonts.css |
| `@hfroemmel/quiz-react` | QuizScene, StageScreen, scenes, sounds, connection hooks |
| `@hfroemmel/quiz-kiosk` | The playable quiz as a single component (QuizGame) |

Nothing else is shipped: the test harness under `harness/` is excluded from
versioning, and the applications live in their own repositories.

## Versioning

Changesets with **fixed versioning**: all five packages always carry the
same version and are released in lockstep. A change gets a changeset
(`pnpm changeset`) before the merge; SemVer applies strictly from 1.0
onward (view model, command, and schema breaks are major).

## Release flow

1. A push to `main` with open changesets -> the `release.yml` workflow
   creates or updates the **"Version Packages"** PR.

   For this, *Settings -> Actions -> General -> Workflow permissions* must
   have "Allow GitHub Actions to create and approve pull requests" enabled;
   otherwise the run does push the `changeset-release/main` branch, but
   fails when creating the PR. Anyone who wants to work without a PR runs
   `pnpm changeset version` locally and pushes the version state - the next
   release run then publishes directly.

   The PR belongs to `github-actions[bot]`; its CI run therefore waits for a
   one-time *Approve and run*.
2. Merging this PR -> the same workflow publishes the packages with the
   automatic `GITHUB_TOKEN` (`permissions: packages: write`) and creates git
   tags.

Publishing goes through pnpm; only at packing time does
`publishConfig.exports` redirect the entry points from `src/` to `dist/`.
`pnpm packages:verify` checks exactly this artifact with publint and
@arethetypeswrong/cli.

## Publishing by hand

The CI path assumes that GitHub Actions starts jobs for this account at all.
If it doesn't - recognizable by runs failing after one or two seconds
without a single step and without log files -, the same thing works by
hand. These are exactly the steps `release.yml` runs:

```bash
pnpm changeset version   # write versions and changelogs, consume the changeset
pnpm packages:build
pnpm packages:verify     # publint + attw on the packed tarballs
pnpm changeset publish --no-git-tag   # publish
pnpm packages:tag                     # set git tags, purely local
git add -A && git commit -m "Version Packages" && git push
git push origin --tags
```

**Why `--no-git-tag`.** The built-in tag step asks the server, for every
package whose tag is missing locally, whether it already exists there
(`git ls-remote --tags origin`). That's five network round trips, and they
sit behind a spinner: if the network asks for credentials, the prompt is
invisible and the run appears to hang at "Creating git tags...". Everything
is already published by that point - aborting with Ctrl+C only costs the
tags. `pnpm packages:tag` sets the same tags without any network access.

If the run still seems to hang, run

```bash
time git ls-remote --tags origin
```

to see whether it's the network or an invisible password prompt.

**In the app repositories, `pnpm install` is enough.** quiz-standalone,
app-collection, and quiz-live pin the five packages as **`0.x`** - they pick
up every new release of the zero series without anyone bumping a number.

The caret doesn't work for this: on a 0.x version, `^0.6.0` means
`>=0.6.0 <0.7.0`, because SemVer treats every minor as a possible break in
the zero series. Every publish therefore fell outside the pinned range, and
`pnpm install` silently stayed on the old version - silently, because the
resolution was in fact correct. This has cost half a day, twice.

THE PRICE IS PAID DELIBERATELY: an application now also picks up a breaking
change without anyone approving it. This holds up as long as the five
packages and the three applications stay in one hand and run in lockstep -
and as long as breaks in the zero series are documented as `minor` with a
changeset. From 1.0 on, real ranges belong here again.

**WRITE BACK the version state.** `changeset version` changes the
`package.json` of the five packages and consumes the changesets; this state
needs to be committed and pushed. If it stays on the machine, the
repository keeps reporting the old number, and the next run proposes a
version that is already taken in the registry.

For this, the personal `~/.npmrc` needs a classic PAT with
**`write:packages`** (`read:packages` is enough for reading):

```ini
//npm.pkg.github.com/:_authToken=<PAT>
```

The order matters: publish first, then push the version state. If
publishing fails, the repository doesn't end up with a version that doesn't
exist in the registry.

## Consuming from other repositories

In every consuming repository (`quiz-live`, `quiz-standalone`,
`app-collection`):

```ini
# .npmrc in the repository
@hfroemmel:registry=https://npm.pkg.github.com
```

A private package initially belongs ONLY to the repository it was published
from. Every consuming repository therefore needs a one-time authorization:
for each of the five packages, under *Package settings -> Manage Actions
access -> Add repository*, add the repository with `Read`. Without this
entry, the registry answers with `403`, even though the token is valid and
the job has `packages: read`.

CI needs `permissions: packages: read` and passes the token:

```yaml
- uses: actions/setup-node@v4
  with:
    registry-url: https://npm.pkg.github.com
    scope: '@hfroemmel'
# NODE_AUTH_TOKEN: ${{ secrets.GITHUB_TOKEN }} at the install step
```

For local development, each person needs a one-time classic PAT with
`read:packages` in their personal `~/.npmrc`:

```ini
//npm.pkg.github.com/:_authToken=<PAT>
```

The apps pin `0.x` and thus pick up every new release of the zero series;
fixed versioning guarantees the five packages fit together within it. Why
not a caret: see "In the app repositories, `pnpm install` is enough" above.
