# G. Theme system

## G.1 What exists

`@hfroemmel/quiz-themes` builds `palette.css` from `packages/themes/src/palettes.ts`. The generated custom properties fall into five families, each introduced for one surface:

| Family | Introduced for | Defined in |
|---|---|---|
| `--color-*` | stage scenes (dark base) | `palettes.ts` `darkPalette`, `brightPalette` (`:101`) |
| `--ui-*` | operator / moderator chrome | `palettes.ts` |
| `--start-*` | kiosk start screen; bright block scoped to `[data-quiz-game][data-theme='bright']` | `palettes.ts` `startPalette`, `brightStartPalette` (`:375-430`) |
| `--quiz-select-*` | the "which quiz" selection cards | `palettes.ts` |
| `--kids-*` | the children's world (paper, drawings, mascot) | `palettes.ts`, `tokens.css` |

Bright/dark is a per-window preference in `localStorage` (`packages/react/src/presentation/stageTheme.ts:17-60`), explicitly not applied to the kids world (`stageTheme.ts:9-12`, `const theme = kids ? null : stageTheme` in `StageScreen`). Kids is selected by the content (`quizThemeSchema.skin`, `packages/core/src/contracts/content.ts:284-300`) and expressed as `.stage--kids` plus `[data-theme]`.

Copies outside the package: the bundestags-app repeats three `--start-*` values and five more colours as SCSS variables (`src/components/Quiz/styles/QuizStart.scss:28-36`, with the comment "Whoever changes one of them there changes it here by hand; there are three"); quiz-live keeps card colour names per quiz (`apps/web/src/apps/stage/quizArtwork.ts:21`, `QuizCardTheme`) and its own operator palette (see A.7 and B for counts).

## G.2 Theme schema (based on Bright)

The bright variant is the base because it is the documented default (`stageTheme.ts` `FALLBACK = 'bright'`) and the one the reference start menu was designed on. A theme is a typed object the host passes in; the package turns it into CSS custom properties with the existing `themeVariables()`:

```ts
export interface ThemeDefinition {
  id: string                       // matches content `themes[].id`
  base: 'bright' | 'dark'          // which built-in token set to start from
  skin?: 'default' | 'kids'        // layout world; today `themeSkins`
  tokens?: Partial<ThemeTokens>    // overrides, see G.3
  typography?: {
    display: string; body: string  // font-family stacks
    fonts?: { family: string; src: string; weight?: number }[] // @font-face inputs, replaces fonts.css copies
  }
  assets?: {
    wordmark?: string              // replaces `brandWordmarkUrl` prop plumbing
    startVisual?: string
    kids?: { paper?: string; frame?: string; mascot?: string } // today url()/border-image in tokens.css
  }
  motion?: 'default' | 'reduced'
}
```

Resolution order: built-in base tokens → `tokens` overrides → CSS custom properties on the quiz root element (`[data-quiz-game]` / `.stage`), never on `:root`. That closes the open point "CSS-Kapselung" from `docs/mehrkontext-architektur.md`: two quizzes on one page (app-collection) cannot leak into each other.

## G.3 Token groups

`ThemeTokens` keeps the five families but names them by role and documents each token once:

| Group | Tokens (target names) | Today |
|---|---|---|
| surface | `page`, `pageTop`, `surface`, `surfaceQuiet`, `line`, `lineStrong` | `--color-page-*`, `--start-surface*`, `--start-line*` |
| ink | `text`, `textMuted`, `textQuiet`, `inkOnStrong` | `--color-text*`, `--start-text*` |
| accent | `accent`, `accentInk`, `selected`, `selectedInk` | `--color-accent`, `--start-selected`, `--quiz-select-*` |
| feedback | `correct`, `incorrect`, `warning` | `--color-correct/--color-incorrect` |
| action | `action`, `actionInk` | `--start-green`, `--start-ink-on-green` |
| option | `option`, `optionHover`, `optionSelected`, `optionIcon` | `--color-option*`, `--start-option*` |
| kids | `paper`, `frame`, `chip`, `mascotShadow` | `--kids-*` |
| controls (host chrome) | `ui.*` | `--ui-*` (stays, live desk only) |

Rule: a value that exists on the stage is *referenced* from the start menu, never copied (the pattern `brightStartPalette` already follows: `'surface-selected': brightPalette.accent!`, `palettes.ts:418`). The generated `palette.css` keeps emitting the current variable names for one release so hosts can migrate; after that only the role names remain.

## G.4 Typography and assets

- Fonts: today `fonts.css` in quiz-themes plus host-level imports; target: `typography.fonts` in the theme, emitted as `@font-face` by `themeVariables()` companion `themeStyles()`, scoped like the tokens.
- Wordmark: `assets.wordmark` replaces the `brandWordmarkUrl` export/prop pair of quiz-react.
- Kids assets: remain in the package as defaults (`assets.kids`), overridable per theme; references move from `url()` in `tokens.css` to custom properties set by the theme, so a host can replace a drawing without rebuilding the package.

## G.5 Start menu and stage presentation

The start menu (F) and the stage read the same `ThemeDefinition`. Card artwork is content (`artworkAssetId`), card colour is the theme's `accent`/`option` pair; the per-quiz colour names of quiz-live (`QuizCardTheme`) go away because the reference menu uses one quiet surface for all offers on purpose (`QuizStart.scss:40-45`).

## G.6 Deliberately not themeable

- layout geometry of scenes and of the kids world (`.stage--kids` is a world, not a colour set; changing its geometry is a new world)
- animation timings that carry game meaning (`gameTiming`, `revealGrid`, `packages/core/src/contracts/config.ts:32-100`)
- the reveal grid and its order (fairness, `config.ts:72-100`)
- operator and moderator chrome (`--ui-*`) beyond bright/dark
- data attributes and class names used by tests and hosts

## G.7 Languages

A theme carries no text. Every label on a themed surface comes from configuration labels or interface strings (D.7). Fonts must cover the glyphs of all registered locales; the validator of the theme (a small `themeDefinitionSchema` in quiz-themes) warns when `typography.fonts` lacks a `unicode-range` for a registered locale's script, which is the only language-related rule a theme has.
