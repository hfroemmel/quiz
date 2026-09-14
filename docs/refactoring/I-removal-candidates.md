# I. Removal and consolidation candidates

"Remove" means the concern disappears or moves; the behaviour stays (§21). Phase numbers refer to H.

## I.1 Components

| Candidate | Where | Replaced by | Phase |
|---|---|---|---|
| `GameStart` | `packages/kiosk/src/game/GameStart.tsx` | `StartMenu` (quiz-react) driven by `deriveStartMenu` | 4 → removed in 8 |
| `QuizStart`, `startOffers` | `bundestags-app/src/components/Quiz/{QuizStart.js,startOffers.js}` | `StartMenu` + `quizzes[]` configuration | 4 |
| `QuizOverview` (stage poster) | `quiz-live/apps/web/src/apps/stage/QuizOverview.tsx` | `OfferOverview` (quiz-react) on the same model | 4 |
| `QuizDetails` + details effect | `bundestags-app/src/components/Quiz/QuizDetails.js`, `Quiz.js:245-297` | `renderAfterSolution` slot + `rules.showDetailsAfterSolution` | 6 |
| `JokerDrawOverlay`, `JokerCard`, `JokerFlipCard`, `jokerCardArt` | `quiz-live/apps/web/src/components/*` | moved into quiz-react as the package's joker presentation; the host keeps only `jokerHeaderSlots` wiring or nothing | 6 (optional, medium value) |
| `ConnectionBanner` German literals | `quiz-live/apps/web/src/components/ConnectionBanner.tsx` | interface strings | 7 |

## I.2 Hooks and utilities

| Candidate | Where | Replaced by | Phase |
|---|---|---|---|
| `MutationObserver` latch on `[data-game-start]` | `bundestags-app/src/components/Quiz/Quiz.js:210-235` | none needed once the package menu is the only menu | 4 |
| `installMediaResolver` (monkey-patch of `runtime.content.assetUrl`) | `bundestags-app/src/components/Quiz/assets.js:82-94` | `media` option of `LocalQuizRuntime` | 6 |
| `detailsByPrompt`, `detailsFor` | `bundestags-app/src/components/Quiz/content/index.js:63-71`, `session.js:141-143` | `explanation.details` in the public view under a rule flag | 6 |
| `buildQuizPackage` / `bauePaket` ×3 | `bundestags-app/…/session.js:63-78`, `quiz-standalone/src/renderer/App.tsx:24-38`, `app-collection/src/renderer/quizSession.ts:27-41` | `loadQuizPackage()` in quiz-core | 6 |
| `useStageTheme` as package API | `packages/react/src/presentation/stageTheme.ts` | host helper choosing `bright`/`dark` definitions; kept as an internal helper for quiz-live | 5 |
| `klemmeZoom` and the second zoom variable | `packages/kiosk/src/game/zoom.ts`, `bundestags-app/…/QuizStart.js:88` (`--quiz-start-zoom`) | one `--stage-zoom` from `QuizGame` | 4 |
| `FADE_MS`, `DETAILS_DELAY_MS` | `bundestags-app/src/components/Quiz/Quiz.js:77-86` | package timing (`presentationTiming`) via the slot | 6 |
| `AUDIENCES`/`LANGUAGES`/`PACKAGES` matrices | `bundestags-app/src/components/Quiz/content/index.js:26-36` | one package, `quizzes` filtered by audience, `locale` prop | 2 + 7 |
| `useBuzzerKeys`, `desktopBridge` | `quiz-live/apps/web/src/client/*` | **keep** (host hardware and window) | — |

## I.3 Styles

| Candidate | Where | Replaced by | Phase |
|---|---|---|---|
| `QuizStart.scss` (364 lines, eight colour literals) | `bundestags-app/src/components/Quiz/styles/QuizStart.scss` | package `StartMenu` styles on `--start-*` tokens | 4 |
| five suppression rules `[data-brand]`, `[data-abort-game]`, `[data-settings-open]`, `[data-game-start]`, `[data-continue]` | `bundestags-app/…/styles/Quiz.scss:48-96` | `QuizGame` `chrome` props; menu and details slot | 4 + 6 |
| `$hell` recolouring by package attributes | `Quiz.scss:123-144` | `data-surface` signal on the quiz root | 6 |
| details-step styles (~110 lines) | `Quiz.scss:166-292` | package slot styles | 6 |
| `QuizOverview.module.css` (232 lines) | `quiz-live/apps/web/src/apps/stage/` | package `OfferOverview` styles | 4 |
| `stage stage--default stage--dark` literal | `quiz-live/apps/web/src/apps/stage/StageApp.tsx:48` | exported empty-stage state of `StageScreen` | 5 |
| `:global(.button)` override | `quiz-live/apps/web/src/apps/moderator/ModeratorApp.module.css:160-162` | `--ui-*` button tokens | 5 |
| hard-coded `scale: 0.8` for touch | `packages/react/src/presentation/stage/Stage.module.css:116` | `--stage-zoom` (already the contract) | 0 (bug) |
| six per-package stylesheet entries | `@hfroemmel/quiz-themes/{palette,fonts}.css`, `@hfroemmel/quiz-react/styles/{motion,stage}.css`, `styles.css`, `@hfroemmel/quiz-kiosk/styles.css` | one `@hfroemmel/quiz-react/styles.css` (themes emitted by `themeVariables`) | 5 + 8 |

## I.4 Theme definitions

| Candidate | Where | Replaced by | Phase |
|---|---|---|---|
| `quizSelectPalette` with `card-bundestag/kids/europe/unity/bremen`, `ink-on-europe` | `packages/themes/src/palettes.ts:199-210` | offer cards on `option`/`accent`; artwork from content | 5 |
| `brightStartPalette` as a separate block | `palettes.ts:375-430` | role tokens shared with the stage (references already exist) | 5 |
| `--start-*`, `--quiz-select-*` families | `palettes.ts` | role-named tokens with one-release aliases | 5 → 8 |
| `QuizCardTheme` names | `quiz-live/apps/web/src/apps/stage/quizArtwork.ts:21` | none | 4 |
| `fonts.css` as a package file | `packages/themes` | `typography.fonts` in the theme definition | 5 |

## I.5 Configs

| Candidate | Where | Replaced by | Phase |
|---|---|---|---|
| `QUIZ_OFFERS`, `PLAY_MODES` | `bundestags-app/src/components/Quiz/startOffers.js:31-65` | `quizzes[].playerCounts`, `artworkAssetId` | 3 + 4 |
| `quizArtwork` table | `quiz-live/apps/web/src/apps/stage/quizArtwork.ts:39-66` + five image files | `quizzes[].artworkAssetId` in the content package | 3 + 4 |
| `EXTRA_POOLS`, `AUDIENCES`, `LANGUAGES` (incl. 35 English strings) | `bundestags-app/scripts/build-quiz-content.mjs:108-245` | `config.json` in quiz-content-data; package locale bundles | 2 + 7 |
| four generated packages `content/{adults,kids}-{de,en}` | `bundestags-app/src/components/Quiz/content/` | one pulled package (`content.lock.json`) | 2 |
| `playerCounts={[1]}` | `quiz-standalone/src/renderer/App.tsx:108` | `quizzes[].playerCounts` in the standalone content config | 3 |
| `idleSeconds` in `quiz.config.json`/`sammlung.config.json` | `quiz-standalone`, `app-collection` | **keep** as host override of `rules.idleTimeoutMs` (installation fact) | — |
| twelve `quiz-start-*` locale keys | `bundestags-app/src/locales/{de,en}.json:62-75` | interface strings of the package | 4 |
| `quiz-resume` key, `QuizStateContext.js` | `bundestags-app/src/locales/*.json:55`, `src/contexts/QuizStateContext.js` | delete (dead) | 0 |
| `0.x` ranges | `quiz-standalone`, `app-collection`, `bundestags-app` `package.json` | `~0.15.3` | 0 |

## I.6 Adapters

| Candidate | Where | Replaced by | Phase |
|---|---|---|---|
| Electron main process ×2 (`inhalt`, `protokoll`, `stand`, `preload`, `host.ts`) | `quiz-standalone/src/main/*`, `app-collection/src/main/*` | `@hfroemmel/quiz-host-electron` (or a shared folder) | 6 |
| `build.mjs`, `vite.config.ts`, `playwright.config.ts`, tsconfigs ×2 | same two repos | shared host package / template | 6 |
| `scripts/build-quiz-content.mjs` | `bundestags-app` | `quiz-content` CLI | 2 |
| `readSource` text-slicing of `.js` arrays | `build-quiz-content.mjs:42-50` | gone with the script | 2 |
| `HotfixPanel` diff + `'; '` serialisation | `quiz-live/apps/web/src/apps/operator/HotfixPanel.tsx:54-84` | `quiz-core` `questionPatchFrom(before, after)` helper | 6 (low) |

## I.7 Package exports

| Candidate | Package | Action | Phase |
|---|---|---|---|
| `@hfroemmel/quiz-kiosk` (whole package) | kiosk | merge `QuizGame` into quiz-react; re-export until 8 | 4 → 8 |
| `GameStart` export | kiosk | remove | 8 |
| `brandWordmarkUrl` | react (`presentation/brandAssets.ts:14`) | `theme.assets.wordmark` | 5 |
| `useStageTheme`, `stageThemes` | react | internal / host helper | 5 |
| `uebersetzteBeschriftung`, `spracheFuer`, `beschriftung`, `untertitel`, `fragenTextFuer`, `standardTexte`, `texteFuer` | core, react | English names with aliases | 1 → 8 |
| `QuizGame` props `audience`, `playerCounts`, `idleTimeoutMs`, `soundEnabled` | kiosk/react | configuration + menu setting | 3 → 8 |
| `variant: 'preview' | 'touch'` naming | react | `size`/`interaction` props with generic names (`compact`, `touch`) | 8 |
| `quizOffers` and `catalog` view fields | core | **keep**, both feed `deriveStartMenu` | — |
| `OperatorConnection`, `ModeratorConnection`, `StageConnection` aliases | react | **keep** (live host contract) | — |

## I.8 Consolidation summary by host

| Host | Files that disappear | Lines (approx.) |
|---|---|---|
| bundestags-app | `QuizStart.js`, `startOffers.js`, `QuizStart.scss`, `QuizDetails.js`, `scripts/build-quiz-content.mjs`, `content/source/*.js`, four generated packages, `assets.js` resolver, half of `Quiz.js`, 90 lines of `Quiz.scss` | ~1 500 + generated JSON |
| quiz-live | `quizArtwork.ts`, `QuizOverview.*`, five images, joker presentation (optional) | ~350 (+600 optional) |
| quiz-standalone / app-collection | shared main process, `bauePaket`, stylesheet list, E2E helper | ~400 per repo |
| quiz (packages) | `GameStart`, `quiz-kiosk` scaffolding, `quizSelectPalette`, `brightStartPalette` duplication, `stageTheme` special-casing | ~600 |
