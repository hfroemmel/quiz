# B. Findings

Each finding: files, current state, cause, impact, hosts affected, priority (high / medium / low). Grouped by the categories of the brief; i18n and language-in-code are added as two further groups. Line numbers refer to the HEADs in A.1.

## B.1 Code duplication

| # | Finding | Files | State | Cause | Impact | Hosts | Priority |
|---|---|---|---|---|---|---|---|
| 1.1 | **Two Electron hosts share 13 byte-identical files** | `quiz-standalone/{build.mjs,vite.config.ts,playwright.config.ts,tsconfig*.json,.npmrc,.gitignore,content.lock.example.json,src/main/{inhalt,preload,protokoll,stand}.ts,src/renderer/host.ts}` ≡ `app-collection/…` | verified with `diff` | both repos were created from the same template in migration phases 9 and 10 | every fix must be applied twice; the two already drifted in `konfiguration.ts` and `main.ts` | standalone, app-collection | medium |
| 1.2 | **Package loading is copied three times** | `quiz-standalone/src/renderer/App.tsx:24-38`, `app-collection/src/renderer/quizSession.ts:27-41`, `bundestags-app/src/components/Quiz/session.js:63-78` | same zod re-validation + `assetsById` map + `rootDir: ''` | `LocalQuizRuntime` takes a pre-built `QuizPackage`, and the package offers no browser-side loader (`loadQuizPackage` in `quiz-content` is Node/fs only, `quiz-live/packages/server/src/createRuntime.ts:58`) | a schema change breaks three hosts | standalone, app-collection, bundestags-app | medium |
| 1.3 | **Six stylesheet imports in a fixed order** | `quiz-standalone/src/renderer/main.tsx:29-35`, `app-collection/src/renderer/main.tsx:26-31`, `bundestags-app/src/components/Quiz/Quiz.js:53-58`, `quiz-live/apps/web/src/main.tsx` | every host lists `palette.css`, `fonts.css`, `motion.css`, `stage.css`, `styles.css`, kiosk `styles.css` | packages ship CSS per package instead of one entry | a new package stylesheet is a change in four hosts | all | low |
| 1.4 | **E2E play-through helpers duplicated** | `quiz-standalone/test/e2e/offline.spec.ts:93-119` ≡ `app-collection/test/e2e/einbettung.spec.ts:118-138`; `bundestags-app/test/e2e/quiz.spec.mjs:87-137` | three copies of "answer until `data-scene=result`" | no shared test helper package | test changes triple | standalone, app-collection, bundestags-app | low |
| 1.5 | **Content pipeline transport re-implemented** | `bundestags-app/scripts/build-quiz-content.mjs:57-85, 301-319, 396-415, 442-453, 476-478` | slug/id, mime, manifest, checksum, preset expansion, cleanup | the app predates `quiz-content` and never switched | two builders of the same package format; `createdAt` dirties git on every run (`:448`) | bundestags-app | high |

## B.2 Semantic duplication

| # | Finding | Files | State | Cause | Impact | Hosts | Priority |
|---|---|---|---|---|---|---|---|
| 2.1 | **Three start menus, three data sources** | `packages/kiosk/src/game/GameStart.tsx`; `bundestags-app/src/components/Quiz/{QuizStart.js,startOffers.js,styles/QuizStart.scss}`; `quiz-live/apps/web/src/apps/{operator/StartPanel.tsx,stage/QuizOverview.tsx,stage/quizArtwork.ts}` | kiosk: audience presets + `playerCounts` prop; app: `QUIZ_OFFERS` + `PLAY_MODES` in host code; live: server catalog + host artwork table | `quizzes` in the configuration arrived in 0.14 and was only adopted by quiz-live; the kiosk menu has no quiz choice; the app therefore built its own | adding a quiz means editing three places (config, `startOffers.js`, `quizArtwork.ts`) plus two locale files; the app hides the package screen with CSS and detects it with a `MutationObserver` (`Quiz.js:223-235`, `Quiz.scss:84-86`) | all | **high** |
| 2.2 | **Two i18n systems for the same wording** | `bundestags-app/scripts/build-quiz-content.mjs:144-187` (35 English `interfaceStrings`), `bundestags-app/src/locales/{de,en}.json:55-75`, `packages/react/src/presentation/texts.ts:21` (`standardTexte`, German only) | the app translates the package UI in a build script and its own screens with react-i18next; the two already diverged (`Europa` vs `Europa-Quiz`) | packages ship German defaults only | every host that wants English must re-translate the package | bundestags-app (today), any English host | high |
| 2.3 | **Two corpora per language instead of translations** | `bundestags-app/src/components/Quiz/content/source/questions-{adults,kids}-{de,en}.js` | 162 de / 168 en adult questions, 60 / 53 kids; different sets | pipeline predates `translations` | a language switch changes the question set; repetition avoidance treats de/en versions as different questions; the app locks the language per session to hide this (`Quiz.js:116-117`, `Controls.js:46-59`) | bundestags-app | high |
| 2.4 | **`details` exists twice with two policies** | `packages/core/src/contracts/content.ts:64-74` (`explanation.details`, internal to operator/moderator), `bundestags-app/scripts/build-quiz-content.mjs:275-292` + `content/index.js:63-71` (host-only `details` looked up by prompt text) | the schema field is stripped by parsing; the host writes raw JSON and re-attaches by prompt | the public view never carries `explanation.details`; the app needs it after the solution | prompt collisions are a build error (`:426-440`); `[data-continue]` is hidden by CSS; `FADE_MS` copies `--stage-fade-duration` by hand (`Quiz.js:79-86`) | bundestags-app | high |
| 2.5 | **Two lists of "which option is used up"** | `quiz-live/apps/web/src/apps/operator/OperatorControls.tsx:106`, `apps/moderator/ModeratorApp.tsx:140` | `option.state === 'chosen-incorrect'` derived twice | the projection exposes the state but not the derived flag | rule drift between desk and moderator | quiz-live | low |
| 2.6 | **Dimension matrix spelled out four times** | `bundestags-app/src/components/Quiz/content/index.js:26-36`, `scripts/build-quiz-content.mjs:114-245`, `test/e2e/quiz.spec.mjs:34-39` | `AUDIENCES × LANGUAGES` as host constants | see 2.3 | any new audience or language edits four files | bundestags-app | medium |

## B.3 Responsibility problems

| # | Finding | Files | State | Cause | Impact | Hosts | Priority |
|---|---|---|---|---|---|---|---|
| 3.1 | **Joker presentation lives in one host** | `quiz-live/apps/web/src/components/{JokerDrawOverlay,JokerCard,JokerFlipCard}.tsx` + `.module.css`, `jokerCardArt.ts` (~600 lines) | data, timings and the `besidePlayer` slot are package contracts (`packages/react/src/presentation/stage/StageHeader.tsx:43-48`), the composition is host code | the feature was built for the live evening first | the kiosk (`/play`, standalone, app) cannot show jokers; the slot exists only for this host and says so in its doc comment | quiz-live (owner), all others (missing) | medium |
| 3.2 | **Media resolution by monkey-patch** | `bundestags-app/src/components/Quiz/assets.js:82-94` | replaces `runtime.content.assetUrl` at runtime | `LocalQuizRuntime` has no resolver option; the core builds `/media/<id>` | depends on an internal property; a nine-minor version gap between installed 0.6.1 and locked 0.15.3 has no guard except one `throw` | bundestags-app | high |
| 3.3 | **Rules live in constants, idle timeout in a prop** | `packages/core/src/contracts/config.ts:12-118`, `packages/kiosk/src/game/QuizGame.tsx:104`, `quiz-standalone/quiz.config.json` (`idleSeconds`) | scoring/timing are code; idle is host config | no `rules` block in the package configuration | changing points is a package release; idle is configured differently per host | all | medium |
| 3.4 | **Stage class contract copied as strings** | `quiz-live/apps/web/src/apps/stage/StageApp.tsx:48` (`'stage stage--default stage--dark'`), `quiz-live/apps/web/src/apps/moderator/ModeratorApp.module.css:160-162` (`:global(.button)`) | host writes package class names | no exported "empty stage" component/state | breaks silently on a class rename | quiz-live | low |
| 3.5 | **Hotfix diff and answer serialisation in a component** | `quiz-live/apps/web/src/apps/operator/HotfixPanel.tsx:54-84` | `'; '`-join/split of `acceptedAnswerText` and change detection in React | no content-side helper | format knowledge in UI code | quiz-live | low |
| 3.6 | **Host chrome recoloured from package attributes** | `bundestags-app/src/components/Quiz/styles/Quiz.scss:123-144` (`$hell`: `[data-quiz-game][data-skin="kids"]`, `[data-theme="bright"]`) | host reads package presentation attributes | no published "surface is light/dark" signal | coupling to internals; asserted by an E2E test (`quiz.spec.mjs:333-362`) | bundestags-app | low |

## B.4 API problems

| # | Finding | Files | State | Cause | Impact | Hosts | Priority |
|---|---|---|---|---|---|---|---|
| 4.1 | **`QuizGame` props carry configuration** | `packages/kiosk/src/game/QuizGame.tsx:49-104` (`audience`, `playerCounts`, `soundEnabled`, `zoom`, `locale`, `idleTimeoutMs`, `onFinished`, `onExit`) | `playerCounts` and `idleTimeoutMs` are business configuration; `audience` pre-empts a menu choice | menu model not derived from config | standalone hard-codes `playerCounts={[1]}` (`App.tsx:108`); the app cannot offer quiz choice without its own screen | all self-service hosts | high |
| 4.2 | **Five CSS suppression rules instead of props** | `bundestags-app/src/components/Quiz/styles/Quiz.scss:48,57,70,84,94` (`[data-brand]`, `[data-abort-game]`, `[data-settings-open]`, `[data-game-start]`, `[data-continue]` hidden) | host hides package UI by attribute | `QuizGame` has no `chrome`/slot options | breaks silently on rename | bundestags-app | medium |
| 4.3 | **Rejection reason lost** | `bundestags-app/src/components/Quiz/Quiz.js:200, 363` | `lastRejection.message` read, then replaced by one generic host sentence | rejection is a German message string, not a code | host cannot localise the real cause | bundestags-app | low |
| 4.4 | **`allowedPresetIds[0]` chosen silently** | `bundestags-app/src/components/Quiz/Quiz.js:201` | adults always play `short`; `normal`/`long` unreachable | `START_GAME` requires `presetId` without a quiz, and the app menu has no round step | configured presets are dead | bundestags-app | medium |
| 4.5 | **`brandWordmarkUrl` is a package asset with a host meaning** | `packages/react/src/presentation/brandAssets.ts:14`, `quiz-live/apps/web/src/apps/stage/QuizOverview.tsx:47` (`alt="Deutscher Bundestag"`) | the file is in the library, the name in the host | no theme asset slot | a customer wordmark is a package release | all | medium |
| 4.6 | **Package structure: five packages, one consumer pattern for kiosk** | `packages/kiosk/*`; consumers `quiz-standalone/src/renderer/App.tsx:16`, `app-collection/src/renderer/Sammlung.tsx:13`, `bundestags-app/src/components/Quiz/Quiz.js:32`, `quiz-live/apps/web/src/main.tsx:76-86` | every kiosk consumer already depends on quiz-react | historical split | one more version to pin and one more stylesheet to import | all | low |

## B.5 Configuration problems

| # | Finding | Files | State | Cause | Impact | Hosts | Priority |
|---|---|---|---|---|---|---|---|
| 5.1 | **Configuration drift across content packages** | `quiz-content-data/content/source/config.json` (no `quizzes`, no `locales`, no `interfaceStrings`), `quiz-live/content/source/config.json` (`quizzes`, no `locales`), `quiz-standalone`/`app-collection` `content/source/config.json` (29 fixture questions, no `quizzes`), four app packages (`locales` with exactly one entry each) | four shapes of the same schema | optional fields adopted per host | the "single source of truth" exists only where quiz-live filled it; the content repo README documents fields its data does not contain | all | high |
| 5.2 | **Version pinning** | `bundestags-app/package.json` (`0.x`, lock 0.15.3, installed 0.6.1), `quiz-standalone`/`app-collection` (`0.x`), `quiz-live` (`~0.14.0`), `quiz-content-data` (`^0.1.0`), `quiz-live/README.md:30` (`^0.3.0`) | five different ranges, one stale README | `docs/veroeffentlichung.md` argued for `0.x` while everything was in one hand | breaking minors flow into hosts unreviewed; the app runs code nine minors behind its lockfile | all | high |
| 5.3 | **Zoom expressed three ways** | `packages/kiosk/src/game/QuizGame.tsx:80,328` (`--stage-zoom`), `bundestags-app/src/components/Quiz/QuizStart.js:88` (`--quiz-start-zoom`), `packages/react/src/presentation/stage/Stage.module.css:116` (`scale: 0.8` hard-coded for touch) | prop, second custom property, literal | no single zoom contract | the app test at `quiz.spec.mjs:481` failed when the host constant changed to 0.9; the quiz E2E at `touch-play.spec.ts:652` failed when the literal was added | bundestags-app, quiz | medium |
| 5.4 | **Kiosk `locales`/switch trick** | `bundestags-app/scripts/build-quiz-content.mjs:355-360` | exactly one locale per package "so the switch never appears" | language is a package choice, not a translation | see 2.3 | bundestags-app | medium |
| 5.5 | **quiz-live content does not build** | `quiz-live/content/reports/build.md:2-3` (`FEHLGESCHLAGEN (21 Fehler, 88 Warnungen)`), `content/dist/manifest.json` at 1.0.1 | shipped package is the previous successful build; checksum re-stamped by hand during this session | 21 asset references without files | `content:build` cannot be part of CI; hotfixes bypass validation | quiz-live | high |

## B.6 Question model problems

| # | Finding | Files | State | Cause | Impact | Hosts | Priority |
|---|---|---|---|---|---|---|---|
| 6.1 | **Legacy corpus with positional answers** | `bundestags-app/src/components/Quiz/content/source/questions-*.js` (`option_1` correct, three options, `img_credits` unused) | 443 questions outside the canonical model | never migrated | `img_credits` dropped on import (`build-quiz-content.mjs`: not read); `correctOptionId: 'o1'` derived per build | bundestags-app | high |
| 6.2 | **Two catalogues, thirteen shared prompts** | `quiz-content-data/content/source/questions.json` (201), app packages (218 distinct prompts) | separate editorial corpora | the app's questions never reached the content repository | the content repository is not the single corpus its README claims | quiz-content-data, bundestags-app | medium |
| 6.3 | **Difficulty semantics differ** | `bundestags-app/scripts/build-quiz-content.mjs:214-244` (adults `standard` + length presets; kids `easy`/`hard`), `quiz-content-data` (easy/medium/hard) | one axis used for two meanings | presets model "length" for adults | a merged corpus needs a decision: difficulty is per question, length is per preset | bundestags-app | medium |
| 6.4 | **Sheet mapping has no per-locale columns** | `packages/content/src/sheetImport.ts:24-70` | one locale per import | translations were added after the sheet import | the documented multilingual model cannot be produced from a table today | quiz-content-data | medium |

## B.7 Theme and styling problems

| # | Finding | Files | State | Cause | Impact | Hosts | Priority |
|---|---|---|---|---|---|---|---|
| 7.1 | **House colours of five quizzes in the theme library** | `packages/themes/src/palettes.ts:199-210` (`quizSelectPalette`: `card-bundestag`, `card-kids`, `card-europe`, `card-unity`, `card-bremen`, `ink-on-europe`), mirrored by `quiz-live/apps/web/src/apps/stage/quizArtwork.ts:21` | brand colours of specific quizzes in a generic package | offer poster built with per-card colours | a sixth quiz is a package release; the reference menu (bundestags-app) uses one quiet surface anyway | quiz-live, quiz | high |
| 7.2 | **Palette values copied into the app** | `bundestags-app/src/components/Quiz/styles/QuizStart.scss:27-41` (eight literals, comment: "changes it here by hand; there are three"; `$line` dead) | hand copies of `--start-*` | `--start-*` is declared on the quiz root, not reachable outside | drift on every palette change | bundestags-app | high |
| 7.3 | **Five token families for one design** | `packages/themes/src/palettes.ts` (`--color-*`, `--ui-*`, `--start-*` with `brightStartPalette` at `:375`, `--quiz-select-*`, `--kids-*`) | each surface got its own family; bright/dark handled twice (`brightPalette:101`, `brightStartPalette:375`) | surfaces were added one at a time | a new theme has to fill five families; roles are duplicated (`selected` = `accent`, `palettes.ts:418`) | all | medium |
| 7.4 | **Tokens on `:root` leak between two quizzes on a page** | `packages/themes` `palette.css`/`tokens.css` `:root` selectors (open point in `docs/mehrkontext-architektur.md`) | global custom properties | historical | app-collection cannot host two differently themed quizzes | app-collection | low |
| 7.5 | **Bright/dark preference lives in the package** | `packages/react/src/presentation/stageTheme.ts:17-60` (`localStorage`, cross-window event) | a host preference implemented as a package hook; the stage window reads it out-of-band (`quiz-live` `StageApp.tsx` does not call it, survey §2.2) | needed by the operator preview | package owns a UI preference of one host | quiz-live | low |
| 7.6 | **Kids exclusion by condition, not by definition** | `packages/react/src/presentation/stageTheme.ts:9-12`, `StageScreen` (`const theme = kids ? null : stageTheme`) | `if kids` in presentation code | kids is a skin, bright/dark is a theme; the two axes are not modelled | every new skin needs the same condition | quiz, all | low |
| 7.7 | **Art placement follows no rule** | wordmark in `quiz-react`; quiz card icons in `quiz-live/apps/web/src/assets/quiz/` and `bundestags-app/…/images/start/`; joker type icons in `quiz-react`; joker card art in `quiz-live/apps/web/src/assets/`; kids drawings in `quiz-react` CSS | mixed | no asset model in the theme | see G.4 | all | medium |

## B.8 Host coupling in shared packages

| # | Finding | Files | State | Cause | Impact | Hosts | Priority |
|---|---|---|---|---|---|---|---|
| 8.1 | **Packages name the live host** | `packages/react/src/presentation/stage/StageHeader.tsx:43` ("genau das braucht die Jokerkarte des Live-Quiz"), `packages/core/src/contracts/commands.ts:68` ("Der Buehnenbetrieb laesst das Feld weg"), `packages/core/src/engine/projection.ts:287,506` (`Saal`), `quizOffers` doc "Ankuendigung an den Saal" | slots and fields justified by one host | the live evening was the first host | readers cannot tell contract from anecdote; the English sweep must rewrite these as generic contracts | quiz | medium |
| 8.2 | **`variant: 'stage' | 'preview' | 'touch'`** | `packages/react/src/presentation/stage/*` | presentation variants named after host windows | the operator preview needed a small stage | a fourth host has to pick one of three host names | quiz | low |
| 8.3 | **Role vocabulary mismatch** | `quiz-live/packages/server/src/wsServer.ts:80` (`stage` → actor `system`), `:114-124` (envelope re-parsed untyped) | transport role ≠ core actor role | `ClientRole` and `ActorRole` grew separately | host resolves a core inconsistency | quiz-live | low |
| 8.4 | **German UI strings of one host ship in the package** | `packages/react/src/presentation/texts.ts:32` (`stage.joker.*`) | defaults are German and joker-specific | no locale bundles | see 2.2 | all | medium |

## B.9 Internationalisation

| # | Finding | Files | State | Cause | Impact | Hosts | Priority |
|---|---|---|---|---|---|---|---|
| 9.1 | **Package defaults exist in German only** | `packages/react/src/presentation/texts.ts:21-100` | `standardTexte` + `config.interfaceStrings` overrides | design decision "German in code, other languages in content" (`content.ts:452-459`) | every non-German deployment carries a full override table (bundestags-app: 35 keys) | all | high |
| 9.2 | **Locale resolution helpers carry German names** | `packages/core/src/engine/projection.ts:572` (`spracheFuer`; also `beschriftung`, `untertitel`, `fragenTextFuer`), `content.ts:94` (`uebersetzteBeschriftung`) | exported/used across packages | house style | Phase 1 needs aliases | quiz | low |
| 9.3 | **Host chrome and quiz texts on different systems** | `bundestags-app` react-i18next vs package `interfaceStrings`; quiz-live literal German JSX (`ConnectionBanner.tsx`, `OperatorControls.tsx`) | three mechanisms | none of the hosts has a second UI language requirement except the app | acceptable for host chrome; the quiz texts must have one mechanism (D.7) | all | medium |

## B.10 Language in code

| # | Finding | Files | State | Priority |
|---|---|---|---|---|
| 10.1 | **German comments and identifiers** | quiz 153/161 source files, quiz-live 68/73, standalone 15/15, app-collection 18/18; test names: quiz 248, quiz-live 115 (uniform heuristic, string literals excluded; counts in H Phase 1) | house style until this brief; the newest code (joker family in quiz-live, the app's quiz paths) is English, so two styles coexist | high (by decision) |
| 10.2 | **German documentation** | `quiz/docs/*.md` (23 files, ~31 800 words incl. READMEs and changesets), READMEs of quiz-live, standalone, app-collection, quiz-content-data | design rationale lives here; must be translated, not dropped | high (by decision) |
| 10.3 | **German leaks into machine ids** | `bundestags-app/scripts/build-quiz-content.mjs:57-67` (`slug` with umlaut transliteration → `regelungen-des-dbt`, `kurioses-wissenwertes`), `quiz-content-data` category ids (`aemter`, `gebaeude`) | ids derived from German labels | low (ids are content, but the importer should generate neutral ids) |

## B.11 Baseline defects found on the way (not architecture, but blocking Phase 0)

| Repo | Item | Evidence |
|---|---|---|
| quiz | two red E2E after the footer change | `test/e2e/kids-theme.spec.ts:103`, `test/e2e/touch-play.spec.ts:652` (Stage.module.css `scale: 0.8`) |
| quiz-live | four red unit tests | `packages/server/test/media.test.ts` (404 for the fixture asset), `service.test.ts` repetition test |
| quiz-live | README stale ×3 | pin `^0.3.0` (`README.md:30`), "29 synthetische Fragen" (`:110`) vs 230, build reported failed |
| quiz-live | stale comment | `apps/web/vite.config.ts:4-7` lists `/preview`, omits `/play` |
| bundestags-app | zoom test coupled to a host constant | `test/e2e/quiz.spec.mjs:481-520` vs `Quiz.js:100` (`STAGE_ZOOM = 0.9`) |
| bundestags-app | orphans | `src/contexts/QuizStateContext.js` (unused), `quiz-resume` key, `$line`, `brand-adults` mime `image/png` for an SVG (`build-quiz-content.mjs:408` vs `assets.js:41`) |
| quiz-content-data | README ahead of data | describes `locales`, `translations`, `interfaceStrings`; `config.json` has none; media still missing (LFS) |
