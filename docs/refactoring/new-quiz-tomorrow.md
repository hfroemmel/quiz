# Practice test: "A new customer quiz tomorrow"

Scenario (§22 of the brief): a new customer orders a quiz on a new topic. Each of the eight steps is walked twice, against `HEAD` of the six repositories (A.1) and against the target architecture (C–G). Every "today" step names the file it was traced through; nothing is assumed. The mark says what the step costs: **Content**, **Configuration**, **Theme** or **Code**.

Preamble that applies to every step today: the customer delivers 60 questions in German and English, with images, and wants a foyer kiosk and a stage evening.

## 1. Import the customer's questions

| | Today | After |
|---|---|---|
| route A (`quiz-content-data`) | Google Sheet → `quiz-content import-sheet --url … --mapping sheet-mapping.json` (`packages/content/src/cli/import-sheet.ts`; mapping shape `sheetImport.ts:24-70`). The mapping has no per-locale columns: the English versions must be added to `questions.json` by hand as `translations` (README "Mehrere Sprachen"). Images: copy under `content/source/assets/questions/`, list in `assets.json` by hand. | `quiz-content template --locales de-DE,en-GB` → customer fills the workbook (D.2, one row per question, one column group per language, `Media` sheet) → `quiz-content import --xlsx` writes `questions.json`, `assets.json` and the config sheets. |
| route B (Bundestags-App) | write `questions-<audience>-<lang>.js` per language (`scripts/build-quiz-content.mjs:42-50`, fields `:258-295`), one corpus per language; images under `src/components/Quiz/images/questions/<audience>/`; `npm run quiz:content`. | route removed (H Phase 2). |
| **mark today** | Content + **Code** (route B: a new source file and script constants; route A: JSON editing for the second language) | **Content** |

## 2. Define two question subsets

| | Today | After |
|---|---|---|
| | Subsets are `poolIds` on questions plus `pools[]` in `config.json`, optionally slot filters in `presets[]` (`packages/core/src/contracts/content.ts:222-282, 336-341`). In quiz-live the subset is then bound to a `quizzes[]` entry (`content.ts:363-397`); in the Bundestags-App it must additionally be listed in `startOffers.js:31-52` and `EXTRA_POOLS` (`build-quiz-content.mjs:108-111`); in standalone and app-collection a subset cannot be offered at all (the package menu has no quiz choice; `packages/kiosk/src/game/GameStart.tsx`). | `Pools` sheet: two pools; `Quizzes` sheet: two rows referencing them. Same mechanism in every host (F.2). |
| **mark today** | Configuration (+ **Code** in the Bundestags-App; **impossible** in standalone/app-collection) | **Configuration** |

## 3. Enable single player and duel

| | Today | After |
|---|---|---|
| | Kiosk: `playerCounts` **prop** of `QuizGame` (`packages/kiosk/src/game/QuizGame.tsx:59`); standalone hard-codes `[1]` (`quiz-standalone/src/renderer/App.tsx:108`); app-collection omits it; Bundestags-App lists `PLAY_MODES` in `startOffers.js:62-65`; quiz-live always duel (`START_GAME.playerCount` omitted, `commands.ts:67-71`). | `playerCounts: [1, 2]` on the quiz definition (D.3); the menu derives the mode choice and hides it for a single value (F.2). |
| **mark today** | **Code** in three hosts | **Configuration** |

## 4. Configure the existing rules

| | Today | After |
|---|---|---|
| | Points, second chance, timings, reveal duration, self-service lead-ins are constants in `packages/core/src/contracts/config.ts:12-118`; jokers are engine behaviour; idle timeout is a host prop (`QuizGame.tsx:104`, `quiz.config.json` `idleSeconds` in standalone). Changing 100 → 50 points is a package release. | `rules` block in the configuration with defaults equal to today's constants (D.5); `idleTimeoutMs` moves in as well. Jokers on/off per quiz. |
| **mark today** | **Code** (package release) | **Configuration** |

## 5. Store a new colour and font set

| | Today | After |
|---|---|---|
| | Edit `packages/themes/src/palettes.ts` (four palette blocks: stage dark/bright, `startPalette`, `brightStartPalette`, `quizSelectPalette`), regenerate `palette.css`, edit `fonts.css`, release five packages, `pnpm install` in every host, copy three values into `bundestags-app/src/components/Quiz/styles/QuizStart.scss:27-31` by hand. | one `ThemeDefinition` object in the host (G.2): `{ base: 'bright', tokens: {...}, typography: {...} }`. |
| **mark today** | **Code** (package release + host edits) | **Theme** |

## 6. Swap logo and icons

| | Today | After |
|---|---|---|
| | Wordmark: `brandWordmarkUrl` export of `quiz-react` (package asset; the institution's name sits in the host, `quiz-live/apps/web/src/apps/stage/QuizOverview.tsx:47`). Start visual: content asset (`audienceConfigSchema.startVisualAssetId`). Quiz card icons: host files (`quiz-live/apps/web/src/assets/quiz/*`, `bundestags-app/src/components/Quiz/images/start/*`). Joker icons: `quiz-react` (`jokerIconUrls`); joker card art: host files. Kids drawings: package CSS `url()`. | Wordmark and kids art: `theme.assets` (G.4). Quiz card artwork: `artworkAssetId` in the content package (D.3). Joker art: theme assets with package defaults. |
| **mark today** | **Code** (package release for the wordmark; host file edits for cards) | **Theme** + **Content** |

## 7. Get the matching start menu automatically

| | Today | After |
|---|---|---|
| | quiz-live: derived from `catalog.quizzes` / `quizOffers` (server) — but artwork and card colours need `quizArtwork.ts` + `quizSelectPalette` (host + package). Bundestags-App: `startOffers.js` is a second configuration; the package start screen is hidden by CSS and detected with a `MutationObserver` (`Quiz.js:223-235`, `Quiz.scss:84-86`). Standalone/app-collection: package `GameStart` shows audience presets and player counts only. | `deriveStartMenu(config, catalog, locale)` (F.2) → `StartMenu` (F.3) in every self-service host; `OfferOverview` on the stage; the operator desk renders its own form on the same model. |
| **mark today** | quiz-live: Configuration + **Code** (artwork); Bundestags-App: **Code**; kiosk: not possible | **Configuration** (nothing else) |

## 8. Run it as a React component or as a standalone application

| | Today | After |
|---|---|---|
| React | `LocalQuizRuntime` + re-validation + `assetsById` map (`bundestags-app/src/components/Quiz/session.js:63-78`), six global stylesheet imports in a fixed order (`Quiz.js:53-58`), media resolver monkey-patch (`assets.js:82-94`), seven props, five CSS suppression rules (`Quiz.scss`). | `loadQuizPackage()` + `<QuizGame runtime theme locale />` (E.2), one stylesheet. |
| Standalone | `quiz.config.json` + `content.lock.json` + `pnpm content:pull` (`quiz-standalone/README.md:65-119`), `App.tsx` with the same package building and `playerCounts={[1]}`. | same config files; `playerCounts` from the configuration; shared Electron host package (H Phase 6). |
| Live | `content.lock.json`, `pnpm content:pull`, `pnpm start`; `quizzes[]` in config. | unchanged, plus artwork from the package instead of `quizArtwork.ts`. |
| **mark today** | **Code** in every host except quiz-live | **Configuration** (config files of the host) |

## Score

| Step | Today | After |
|---|---|---|
| 1 import | Content + Code | Content |
| 2 subsets | Configuration + Code | Configuration |
| 3 modes | Code | Configuration |
| 4 rules | Code (release) | Configuration |
| 5 colours/fonts | Code (release) | Theme |
| 6 logo/icons | Code | Theme + Content |
| 7 start menu | Code | Configuration |
| 8 host | Code | Configuration |
| **core changes** | none needed today either, but five package releases | none |

Today six of eight steps need code, and four of them need a release of all five packages. After the plan, every step falls into Content, Configuration or Theme, and the engine (`packages/core/src/engine/*`) is not touched at any point. That is the acceptance criterion of §22.
