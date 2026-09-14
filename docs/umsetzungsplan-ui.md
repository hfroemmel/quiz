# UI implementation plan

Plan for rebuilding the existing interface to match the delivered screen
designs. The plan describes order, responsibilities, and acceptance criteria;
the visual specifications live in
[`docs/design-system.md`](design-system.md) and [`docs/screens.md`](screens.md),
the motion in [`docs/animationskatalog.md`](animationskatalog.md).

## What changes functionally - and what doesn't

**Unchanged:** state machine, commands, role permissions, persistence,
recovery, content pipeline, scoring logic, reveal computation. The design is
presentation.

**Changes outside the interface** - small, but necessary:

| Change | Location | Reason |
|---|---|---|
| `question.categoryLabel` in the public view model | `contracts/viewModels.ts`, `domain/projection.ts` | the category above the question is the label of the first category |
| Full color token set per theme | `contracts/content.ts`, `content/source/config.json` | every mode brings a complete color system with it |
| `theme.startVisualUrl` mandatory usable per mode | `domain/projection.ts` | the start image belongs to the mode, not to the code |
| `pointsIfCorrect` in the stage projection | `domain/projection.ts` | the hint `Zweite Chance · 50 Punkte` ("Second chance · 50 points") must not be a fixed number in the code |

Everything else happens in `apps/web`.

## Guiding principles

1. **One source for the stage.** `StageScreen` renders the public view
   model. Stage window, operator preview, and development preview all use
   the same component. There is no second render path.
2. **Tokens instead of color values.** No component contains a color,
   radius, or spacing value. Everything comes from CSS variables set from
   the quiz package's theme.
3. **Declarative control bar.** The buttons exist as a data structure, not as
   a JSX cascade. Each button's state follows from `allowedCommands` and the
   view model.
4. **Scaling via container queries.** One layout, two sizes. No device
   queries, no second typography scale.
5. **No magic numbers in JSX.** Timings come from the transition registry,
   sizes from tokens.
6. **Lock instead of hide.** Controls keep their position; disallowed
   buttons are locked.

## Target structure

```text
apps/web/src/
  styles/
    tokens.css            base tokens, gradients, radii, spacing
    typography.css        @font-face, type scale in cqw and rem
    stage.css             stage area and scenes
    chrome.css             header bar, control bar, banners
    animations.css         keyframes; durations only via CSS variables
  theme/
    applyTheme.ts         theme tokens -> CSS variables on the root element
  ui/
    Tile.tsx  OptionBar.tsx  ProgressRing.tsx  MediaFrame.tsx
    AnimationClip.tsx     plays a delivered motion graphic
  presentation/
    StageScreen.tsx       frame, scene selection, transition, sound cue
    StageHeader.tsx       score tiles, question counter, slots for operator buttons
    animationAssets.ts    registry of delivered motion graphics
    scenes/               one file per scene, layout only
    scenes/QuestionHead.tsx  media, category, and question text - for three scenes
    transitions/          unchanged: animation contract and registry
  apps/operator/
    OperatorApp.tsx       connection, preview, frame
    OperatorChrome.tsx    quit, fullscreen, sound, score correction
    ControlBar.tsx        renders the model from controlModel.ts
    controlModel.ts       groups, buttons, state derivation - no JSX
    PrivateAnswerPanel.tsx  solution row with an expandable extra area
```

`ui/` knows only tokens. `presentation/` knows only the public view model.
`apps/operator/` additionally knows commands. This direction is never
reversed.

### The control model

The core of maintainability is a single file with no JSX:

```ts
export interface ControlDescriptor {
  id: string
  label: string
  group: 'round' | 'player' | 'answer' | 'resolve' | 'advance'
  command: CommandType
  payload?: (view: OperatorQuizViewModel) => unknown
  visibleWhen?: (view: OperatorQuizViewModel) => boolean
  selectedWhen?: (view: OperatorQuizViewModel) => 'active' | 'quiet' | false
  primaryWhen?: (view: OperatorQuizViewModel) => boolean
}
```

`ControlBar` renders the list, `ActionButton` displays it. A new button is
thus a list entry - not a new special case in the markup. The letter buttons
`A`-`D` are generated from `visibleOptions`, not from four copied blocks.

## Work packages

Each package stands on its own, is runnable, type-checked, and tested.

### P1 - Foundation — **done**

Tokens, typography, theme application. The application runs in the grayscale
system of the design, without any layout being rebuilt.

- `packages/contracts/src/theme.ts` establishes the eighteen color tokens as
  a contract between quiz package, validation, and interface
- content validation reports an incomplete theme as an **error**
- `content/source/config.json` carries the token set for all three modes;
  Kinder and Saarbruecken inherit it until their own color systems are
  delivered
- the values themselves initially existed in three places - in the quiz
  package, in `apps/web/src/theme/designTokens.ts`, and in `tokens.css`.
  They drifted apart and now live only in `theme.ts`; preview, stylesheet,
  and quiz package are all fed from there
- serif typeface throughout, radius set to 6 px

*Accepted:* all tokens set on the stage (E2E), `pnpm typecheck`, `pnpm test`
(108) and both Playwright projects green.

### P2 - Primitives — **done**

`Tile`, `OptionBar`, `ProgressRing`, `MediaFrame` under `apps/web/src/ui/`.
Each component knows only tokens and its own variants; none of them reads the
view model or sends commands.

Two components from the original list are dropped, with reason:

- `CircleBadge` - checkmark and cross come as a delivered motion graphic, not
  as a drawn shape
- `SectionLabel` - belongs to the control bar and comes with P4

*Accepted:* all variants visible in `/preview`, screenshot regression
re-recorded.

### P3 - Stage area and header — **done**

- `StageHeader` with mirrored score tiles, question counter, and slots for
  the operator's controls; the stage window passes no slots
- `QuestionHead` carries media, category, and question text for the
  question, reveal, and solution scenes - once instead of three times
- answer bars stacked full width, solution bar with a chip
- reveal ring starting at 12 o'clock clockwise, image resolution still
  computed from the same progress variable (formerly as blur, now as a tile
  grid)
- results view with confetti and mirrored result tiles
- the stage area is a container; all sizes within it are in `cqw`

*Accepted:* preview and stage window show the same composition, `pnpm test`
(108) and both Playwright projects green.

### P4 - Control frame

`OperatorChrome`, `ControlBar` from `controlModel.ts`, private answer row
with an expandable extra area, `Zurücksetzen` ("Reset"), fullscreen and
sound toggles. Labels switch to real umlauts; the E2E selectors are updated
along with them.

*Acceptance:* every button of the design present, position stable across all
phases; `test/e2e/game-flows.spec.ts` green.

### P5 - Start view

Start image per mode, mode and difficulty chips from `catalog`, `Spiel
starten` ("Start game"), `Spiel fortsetzen` ("Resume game") for a resumable
game.

*Acceptance:* switching modes instantly re-skins the stage area; no mode name
appears in the code. The control interface stays in its fixed color system.

### P6 - Designed states

Pause image, video question, second chance with visible marking, abort,
connection banner, error notices, moderator view.

*Acceptance:* every state from `docs/screens.md` is selectable in `/preview`.

### P7 - Animations — **partially done**

Already implemented: correct and incorrect from the delivered motion
graphics, ring direction from 12 o'clock, options entry rule, score count-up
with stars over the score tile.

Open: the control frame's banners (with P4) and fine-tuning the scene
transitions against the new layouts.

*Acceptance:* every row of the catalog has a definition with
`reducedMotionDurationMs`; locked durations carry `locked` with a reason;
reduced-motion test green.

### P8 - Acceptance

Full run-through at 16:10 and 16:9, screenshot comparison against the
templates, a walkthrough of `docs/operator-kurzanleitung.md`.

## Tests

| Level | What is covered |
|---|---|
| `pnpm test` | derivation of button states from `allowedCommands`; theme tokens complete; category from the first category |
| `pnpm test:e2e --project=preview` | all scenes and states, reduced motion, screenshots per mode |
| `pnpm test:e2e --project=live` | control bar across a full game run, private content never in the stage DOM |

The existing test "the stage screen only receives the solution in the
solution scene" remains the most important safeguard of the rebuild: it
proves that the new preview in the operator window does not weaken the
separation.

## Open deliveries

Without these files, the named placeholders are used; swapping them in
afterward is then a plain file swap without any code change.

| Delivery | For | Placeholder until then |
|---|---|---|
| Color systems `Kinder` ("Kids") and `Saarbruecken` | themes | inherit from `Erwachsene` ("Adults") |
| Start image `Saarbruecken` | start view | no graphic, title only |
| 156 image files of the question catalog | all image and image-recognition questions | generated placeholder image (see [`docs/inhalte-uebernahme.md`](inhalte-uebernahme.md)) |

Already delivered and integrated: Melior and Noto Sans Display, start images
for `Erwachsene` ("Adults") and `Kinder` ("Kids"), the motion graphics for
correct, incorrect, trophy, stars, and question marks, and the confetti SVG.
The fullscreen and sound icons are redrawn as inline SVG - they are pure
controls and not part of the stage output.

## Observation without a decision

Template 17 has a small window thumbnail in the bottom right that shows the
start screen of the other mode. It is **not** implemented, because it is
unclear whether it is a designed component or an artifact of the screen
recording. If a preview of the stage window is wanted in the operator
window, it will be picked up as its own work package.
