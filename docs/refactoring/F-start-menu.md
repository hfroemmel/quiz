# F. Start menu: configuration → derived model → UI

## F.1 Three start screens today

| Host | Component | Source of the offer list | What is hard-coded |
|---|---|---|---|
| kiosk package (`quiz-standalone`, `app-collection`, `bundestags-app` kids) | `packages/kiosk/src/game/GameStart.tsx` | audience presets from `catalog`, `playerCounts` from a **prop** (`QuizGame.tsx:59`), locales from `config.locales` | player counts, texts, layout |
| bundestags-app adults | `src/components/Quiz/QuizStart.js` + `startOffers.js` | `QUIZ_OFFERS` (three ids = pool ids) and `PLAY_MODES` in **host code** | offers, modes, artwork, colours (`styles/QuizStart.scss:28-36`), preselection |
| quiz-live | operator `apps/web/src/apps/operator/StartPanel.tsx`, stage `apps/web/src/apps/stage/QuizOverview.tsx` | `view.catalog.quizzes` / `view.quizOffers` from the server (config `quizzes`) | artwork per quiz id in `quizArtwork.ts:35-70`, card theme names |

The bundestags-app additionally has to *suppress* the package's own start screen: `[data-game-start] { visibility: hidden }` in `styles/Quiz.scss` and a `MutationObserver` latch on `[data-game-start]` in `Quiz.js` to know when the package wants to show it. That is the clearest symptom that the menu belongs into the package.

Decision from the brief: the operator desk of quiz-live is its own context and keeps its form; the bundestags-app `QuizStart` is the reference for every self-service start menu (kiosk, standalone, embedded, React).

## F.2 Derived menu model

One pure function in `quiz-core`, next to the existing `quizOffers()` and `buildCatalog()` in `packages/core/src/engine/projection.ts`:

```ts
export interface StartMenuModel {
  locale: string
  locales: { id: string; label: string }[]          // > 1 → language switch
  offers: StartMenuOffer[]                          // in config order (`order`)
  playModes: { playerCount: 1 | 2; label: string }[] // union of offers' playerCounts, or the selected offer's
  preselect?: { quizId?: string; playerCount?: 1 | 2 } // only if config says so
}
export interface StartMenuOffer {
  quizId: string
  label: string; subtitle?: string                  // resolved for `locale`
  artworkAssetId?: string; emphasis: 'wide' | 'regular'
  playerCounts: (1 | 2)[]
  difficulties?: { presetId: string; label: string; default: boolean }[] // only when quizSupportsDifficulty
  available: boolean; unavailableReason?: 'no-questions' | 'missing-pool' // from the catalogue, never silent
}

export function deriveStartMenu(config: QuizConfig, catalog: QuizCatalog, locale: string): StartMenuModel
```

Inputs are all in the configuration after D.3 (`playerCounts`, `artworkAssetId`, `emphasis`, `order`); labels come through the same locale resolution the projection uses today (`labelFor`/`subtitleFor` helpers, currently `beschriftung()`/`untertitel()`). `available` is computed from the catalogue counts, which is what quiz-live's server does when it rejects a `START_GAME` for an empty pool; the bundestags-app currently shows the rejection notice *after* the attempt (`[data-quiz-start-notice]`). With the model the menu can show it before, and still never reroutes silently.

The same model feeds quiz-live: the stage overview (`QuizOverview`) renders `offers`; the operator form renders `offers` + `difficulties`. Both already consume server-provided offer lists, so this is a rename of the input shape, not a new data flow.

## F.3 Start menu UI in the package

`StartMenu` in `@hfroemmel/quiz-react` (F.4 says why react and not kiosk), ported from `bundestags-app/src/components/Quiz/QuizStart.js`:

- markup: one radio group per axis (`[data-quiz-choice]` with `[data-quiz-card=<quizId>]`, `[data-play-mode]` with `[data-mode-option]`, optional `[data-difficulty-choice]`, optional locale switch), a notice slot `[data-quiz-start-notice]`, one action `[data-quiz-start-action]`. These data attributes are the ones the app's E2E suite already asserts, so the tests move with the component.
- interaction: touch, mouse and keyboard as today (native radios with visible focus).
- sizing: the app's `vw`-based layout becomes container-query units (`cqw`) inside the `.stage` container, and zoom comes from the same `--stage-zoom` the game uses (`packages/kiosk/src/game/QuizGame.tsx:328`) instead of a second `--quiz-start-zoom`.
- colours: only `--start-*` tokens from the theme (G.3); the SCSS copies in the app disappear.
- props: `model: StartMenuModel`, `value`, `onChange`, `onStart({ quizId, playerCount, presetId? })`, `onSelectLocale`, `notice?`.

`QuizGame` (kiosk) renders `StartMenu` when `scene === 'start'` and sends `START_GAME { quizId, playerCount, presetId?, flowProfile: 'self-service' }`. The existing `GameStart` becomes a removal candidate (I.1); its settings dialog and exit button move into `StartMenu` as optional slots so `quiz-standalone` and `app-collection` keep their behaviour.

Hosts without `quizzes` in their configuration (a pure kiosk with one audience) get a one-offer model derived from the audience, so `deriveStartMenu` never returns an empty menu for a valid package. The operator desk remains free to render its own form on the same model.

## F.4 What presentation still needs from the host

| Need | Source in target | Why not configuration |
|---|---|---|
| artwork files for `artworkAssetId` | content package assets (`assets.json`, kind `image`) | they are content, like the start visual today (`audienceConfigSchema.startVisualAssetId`) |
| wordmark | theme assets (G.4) | brand, not content |
| mount area, zoom, initial locale | host props | installation facts |
| exit / house button | host callback (`onExit`) | navigation belongs to the host |
| rejection notice text | interface strings (`interfaceStrings`), key `start.rejected.<reason>` | translatable like every other UI text |

## F.5 Texts and languages

All visible strings of the menu come from two places only: entity labels of the configuration (`labels`, `subtitles`, `startTitles`) resolved for the active locale, and interface strings with package defaults per locale plus `config.interfaceStrings` overrides. The bundestags-app's fourteen `quiz-start-*` keys in `src/locales/{de,en}.json` map one-to-one to interface string keys (`start.title`, `start.mode.single`, `start.mode.duel`, `start.action`, ...), so the host's react-i18next stays responsible for the app chrome only.
