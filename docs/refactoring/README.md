# Quiz platform: refactoring analysis

Decision document for the brief "Quiz-Plattform analysieren und Refactoring planen" (2026-09-14). Nothing has been implemented, refactored or committed; this folder is the deliverable. Every claim carries a file reference; the four surveys behind it were taken on the HEADs listed in A.1.

| Part | File |
|---|---|
| A. Current architecture | [A-current-architecture.md](A-current-architecture.md) |
| B. Findings | [B-findings.md](B-findings.md) |
| C. Target architecture | [C-target-architecture.md](C-target-architecture.md) |
| D. Target data model | [D-data-model.md](D-data-model.md) |
| E. Target API | [E-target-api.md](E-target-api.md) |
| F. Derived start menu | [F-start-menu.md](F-start-menu.md) |
| G. Theme system | [G-theme-system.md](G-theme-system.md) |
| H. Migration plan | [H-migration-plan.md](H-migration-plan.md) |
| I. Removal and consolidation candidates | [I-removal-candidates.md](I-removal-candidates.md) |
| Practice test "A new customer quiz tomorrow" | [new-quiz-tomorrow.md](new-quiz-tomorrow.md) |

Decisions taken with the owner before the analysis: all six repositories in scope; engine, state machine and scoring unchanged, contracts may grow; **no German in code** (identifiers, comments, tests, fixtures, repo documents) with the sweep as an early phase; multilingual support as a requirement on every target model; the live operator desk stays its own context; the Bundestags-App start screen is the reference for the package menu; fewer packages are welcome if that simplifies use; the app's questions move to `quiz-content-data`; the customer format is an Excel workbook with a template, CSV as the fallback.

## Closing summary

### 1. The five biggest architecture problems

1. **Three start menus with three data sources** (B 2.1): the kiosk menu takes `playerCounts` as a prop and offers no quiz choice, the Bundestags-App keeps `startOffers.js` and hides the package screen with CSS plus a `MutationObserver`, quiz-live pairs the server catalogue with a host artwork table. Adding a quiz touches three places.
2. **Two content pipelines and two corpora** (B 1.5, 2.3, 6.1, 6.2): `bundestags-app/scripts/build-quiz-content.mjs` rebuilds what `quiz-content` does, from a legacy format with positional answers, one corpus per language, and a `details` field the engine strips. Only 13 of its 218 prompts exist in `quiz-content-data`.
3. **Configuration is not the single source of truth** (B 5.1, 3.3, 4.1): five content sets fill the same schema five ways; rules are constants; `playerCounts`, idle timeout and artwork live in props, host tables and files.
4. **Theme values in five families, with house colours in the library and copies in a host** (B 7.1–7.3): `quizSelectPalette` names Bundestag, Bremen, EU and Unity colours inside `quiz-themes`; the app copies three `--start-*` values by hand; a customer palette is a package release.
5. **Version drift and a partly red baseline** (B 5.2, 5.5, B.11): ranges from `0.x` to `~0.14.0`, the app runs 0.6.1 against a 0.15.3 lockfile, quiz-live's content does not build (21 errors), six tests are red for known reasons.

### 2. The five most important structural changes

1. `deriveStartMenu()` in core and one `StartMenu` in react (ported from the Bundestags-App), fed by `quizzes[]` with `playerCounts`, artwork and order (F).
2. One import pipeline in `quiz-content` with an Excel template and per-locale column groups; the app corpus migrated into `quiz-content-data` with `translations` (D.1, D.2, H Phase 2).
3. `rules` in the package configuration with today's constants as defaults, plus `loadQuizPackage()`, a `media` resolver option and a details slot on `QuizGame` (D.5, E, H Phase 6).
4. `ThemeDefinition` based on Bright: role-named tokens, typography and assets in one object, scoped emission, `kids` as a skin (G).
5. Interface strings with package defaults per locale; question texts through `translations`; host chrome stays on the host's own i18n (D.7, H Phase 7). Preceded by the English-only sweep (H Phase 1) and followed by merging `quiz-kiosk` into `quiz-react` (H Phase 8).

### 3. Recommended order

0 baseline and pinning → 1 English-only sweep → 2 content consolidation ∥ 3 configuration completeness → 4 start menu in the package → 5 theme definition ∥ 6 host surface → 7 i18n unification → 8 API slimming and package reduction. Details, dependencies, risks and tests per phase in H.

### 4. Public APIs that change

- `QuizGame`: loses `audience`, `playerCounts`, `idleTimeoutMs`, `soundEnabled`; gains `theme`, `media`, `chrome`, `renderAfterSolution`; moves from `quiz-kiosk` to `quiz-react`.
- `LocalQuizRuntime`: gains a `media` resolver option; `loadQuizPackage()` is added to core.
- `quizModeSchema`: gains `playerCounts`, `artworkAssetId`, `emphasis`, `order`; `quizConfigSchema` gains `rules`.
- `quiz-themes`: `ThemeDefinition`, `bright`/`dark`/`kids` exports; token names become role names with one release of aliases; `quizSelectPalette` and `brightStartPalette` as separate blocks disappear.
- `quiz-react`: `StartMenu`, `OfferOverview`, `QuizProvider`, `useInterfaceStrings` added; `GameStart`, `brandWordmarkUrl`, public `useStageTheme` removed; German exported names renamed with aliases.
- `quiz-content`: `template` and `import --xlsx|--csv` commands added.
- Unchanged: commands, view models, `QuizRuntime`, `StageScreen`, `useQuizConnection`, the server protocol of quiz-live.

### 5. Areas deliberately not unified

The operator desk and moderator view of quiz-live; the three persistence adapters (SQLite, snapshot file, `localStorage`); media transport per host; app chrome of the game collections; hardware buzzer handling; the kids world as a layout skin rather than a token set; the rule constants of the engine that decide fairness (selection window, reveal grid).

### 6. Effort reduction for a new customer quiz

Today six of the eight steps of the practice test need code and four of them need a release of all five packages. After the plan every step is Content, Configuration or Theme, and the engine is not touched (new-quiz-tomorrow.md). In host terms: the Bundestags-App loses about 1 500 lines of quiz-specific code, the two Electron hosts share one main process, quiz-live drops its artwork table.

### 7. Decisions that enable a later configurator

Every input a configurator would produce is already, or becomes, a zod-validated JSON document: `config.json` (quizzes, subsets, modes, rules, texts, theme references) and a `ThemeDefinition` document. No configuration requires React code or callbacks; menu content is derived, never authored; assets are referenced by id; the content release is an immutable, checksummed artefact (`content.lock.json`). A configurator therefore only has to write two documents and publish one release (C.3).

## Baseline numbers (measured)

| Repository | Unit | E2E |
|---|---|---|
| quiz | 279/279 | 98/100 |
| quiz-live | 68/72 | 64/64 |
| bundestags-app | – | 24/25 |
| quiz-standalone | – | 4 (not run here) |
| app-collection | 3 | 3 (not run here) |

Causes of the red tests are listed in H Phase 0 and B.11.
