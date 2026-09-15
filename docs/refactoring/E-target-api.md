# E. Target API

Design rule: a host contributes four things — content, rules (via the content package), theme, and the mount. Everything else has a default. The engine contracts (`QuizRuntime`, commands, view models) stay as they are; what changes is the *surface* around them.

## E.1 Package layout after the refactoring

| Package | Keeps | Gains | Loses |
|---|---|---|---|
| `@hfroemmel/quiz-core` | contracts, engine, selection, projection, `LocalQuizRuntime`/`RemoteQuizRuntime`, `QuizService` | `deriveStartMenu()`, `rules` in config (D.5), `playerCounts`/artwork on `quizzes` (D.3), `loadQuizPackage(raw)` (the zod re-validation + `assetsById` both Electron hosts copy today) | German identifiers |
| `@hfroemmel/quiz-content` | validate, build, pull, migrate-legacy, import-sheet | `template` (Excel workbook), `import --xlsx`, shared column mapping with per-locale groups (D.2) | — |
| `@hfroemmel/quiz-themes` | palettes, fonts, `themeVariables()` | `ThemeDefinition` + `themeDefinitionSchema`, `bright`/`dark`/`kids` as exported definitions, scoped emission (G.2) | duplicate token blocks per surface |
| `@hfroemmel/quiz-react` | scenes, `StageScreen`, sounds, connection hooks | `StartMenu` (F.3), `QuizGame` (moved from kiosk), `QuizProvider` (theme + locale + strings context), `useInterfaceStrings()` | `brandWordmarkUrl` plumbing, `useStageTheme` as public API (becomes a host option) |
| `@hfroemmel/quiz-kiosk` | — | — | **merged into quiz-react** in the last phase (H.8); until then re-exports |

Four packages instead of five, all still fixed-versioned. `quiz-kiosk` disappears because both remaining consumers (standalone, app-collection) import exactly one component from it and every other host already depends on quiz-react.

## E.2 React host (embedded, self-service)

```tsx
import { LocalQuizRuntime, loadQuizPackage } from '@hfroemmel/quiz-core'
import { QuizGame } from '@hfroemmel/quiz-react'
import { bright } from '@hfroemmel/quiz-themes'
import '@hfroemmel/quiz-react/styles.css'          // one stylesheet, scoped to [data-quiz-game]

const quizPackage = loadQuizPackage(await fetchPackageJson())  // manifest + config + questions + assets
const runtime = new LocalQuizRuntime({ quizPackage, restoreFrom, persist })

<QuizGame
  runtime={runtime}
  theme={bright}                 // ThemeDefinition; default = bright
  locale="de-DE"                 // initial; switch inside the menu if config.locales > 1
  zoom={1}
  media={(assetId) => `app://quiz/media/${assetId}`} // optional; default = manifest file names
  onFinished={(result) => ...}
  onExit={() => ...}
/>
```

What is gone compared to today: `audience`, `playerCounts`, `idleTimeoutMs`, `soundEnabled` as props (all configuration: `quizzes`, `rules.idleTimeoutMs`, sound is a menu setting persisted by the runtime), the six stylesheet imports in a fixed order (one entry file), the re-validation and `assetsById` construction (`loadQuizPackage`), and any own start screen. The bundestags-app keeps `QuizPage.js`, the session (audience → which quiz ids are offered is a `quizzes` filter, not a package choice) and its details step, which becomes a `renderAfterSolution` slot on `QuizGame` fed by `explanation.details` from the public view when `rules.showDetailsAfterSolution` is set.

## E.3 Standalone host (Electron kiosk)

```ts
// main process — from a shared host package, see H.7
import { serveQuizPackage, readOperatingConfig, snapshotStore } from '@hfroemmel/quiz-host-electron'
```

```tsx
// renderer
const runtime = new LocalQuizRuntime({ quizPackage: await host.loadPackage(), restoreFrom: await host.readSnapshot(), persist: host.writeSnapshot })
<QuizGame runtime={runtime} theme={bright} locale={config.locale} zoom={config.zoom} />
```

Single-player-only becomes a `quizzes[].playerCounts: [1]` line in the standalone content configuration instead of the `playerCounts={[1]}` prop (`quiz-standalone/src/renderer/App.tsx:108`). The app-collection host is the same code plus `onExit` and `onFinished`.

## E.4 Live host (server + desk + stage)

The live desk stays a separate context. Its API surface is what it is today, with three simplifications:

```tsx
// stage window
const { view, send } = useQuizConnection({ role: 'stage' })
<QuizProvider theme={bright} locale={view.locale}>
  {view.scene === 'start'
    ? <OfferOverview model={deriveStartMenu(view.config, view.catalog, view.locale)} highlighted={...} />
    : <StageScreen view={view} />}
</QuizProvider>

// operator window: own form, same model
const menu = deriveStartMenu(view.config, view.catalog, view.locale)
send({ type: 'START_GAME', quizId, presetId })      // unchanged command
```

- `OfferOverview` is the stage-side, non-interactive rendering of the same `StartMenuModel` (today `QuizOverview.tsx` with `quizArtwork.ts`); it moves into quiz-react so the offer cards look the same in the foyer kiosk and on the stage.
- Artwork resolves through the content package (`artworkAssetId`) served under `/media/<id>` by the existing route, so `quizArtwork.ts` and the five imported image files are removed from the host.
- `useStageTheme()` becomes a host-side preference that picks between the `bright` and `dark` definitions; kids stays excluded by `skin`.

## E.5 Stability

Public surface after the refactoring (everything else is internal):

- core: `LocalQuizRuntime`, `RemoteQuizRuntime`, `QuizRuntime`, `QuizService`, `loadQuizPackage`, `deriveStartMenu`, schemas and types, command types, `createSeededRng`.
- content: CLI `validate | build | pull | template | import | migrate-legacy`, node API `validatePackage`, `buildPackage`, `importWorkbook`.
- themes: `bright`, `dark`, `kids`, `ThemeDefinition`, `themeDefinitionSchema`, `themeVariables`.
- react: `QuizGame`, `StartMenu`, `OfferOverview`, `StageScreen`, `QuizProvider`, `useQuizConnection`, `useInterfaceStrings`.

SemVer stays "0.x with fixed versions" until the hosts pin exact ranges (H, Phase 0). The removal of `quiz-kiosk` and of the old prop names is the one deliberate breaking change and is scheduled last.
