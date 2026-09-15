# Design System

Binding visual foundation for the operator, stage, and moderator views.
The values come from the seventeen delivered screen designs and were
measured on the artwork, not estimated.

## Scope and Precedence

1. **The development specification wins.** In case of a conflict between
   the screen design and the specification, the specification applies; the design
   then only determines appearance, not function.
2. The design supplements the specification with colors, grid, typography, and
   state representation. It changes neither phases, commands, nor role permissions.
3. Whatever doesn't appear in any screen is designed in the shown style and
   recorded in [`docs/screens.md`](screens.md) before it is built.

## The Central Structural Statement

The operator view is **not its own screen design**, but the
stage output plus a control frame:

```text
+------------------------------------------------------------------+
| OS window frame                                                  |
+------------------------------------------------------------------+
| [Quit]            +--------------------------+   [Fullscreen]    |
|                   |                          |   [Sound]         |
|                   |     STAGE AREA 16:9      |                   |
|                   |    = exactly what the    |                   |
|                   |     projector shows      |                   |
|                   +--------------------------+                   |
|                                                                  |
+------------------------------------------------------------------+
| Private answer row + [Reset]                                     |
| 1. Round | 2. Determine player | 3. Answer | [Continue]          |
+------------------------------------------------------------------+
```

Two hard rules follow from this:

- **Only the public view model is rendered in the stage area.** The
  same component runs in the stage window in fullscreen. There is
  no second render path and therefore no way for the preview to
  show anything different from the projector.
- **Everything private lies outside the stage area**, i.e. in the
  lower control bar. The solution appears in the stage area only in the
  solution scene - unchanged from specification 12.

The operator's controls that lie **inside** the area in the design
(the `+`/`-` buttons next to the score tiles) are an overlay layer over the
preview. They are not rendered by the stage window.

## Geometry

Measured from the screens (1728 x 1152 pixel reference):

| Size | Value | Share |
|---|---|---|
| Stage area width | 1234 px | 71.4% of window width |
| Side margins | 247 px each | 14.3% - symmetric |
| Stage area aspect ratio | 1234 x 694 | exactly 16:9 |
| Top edge of stage area | 72 px below window edge | 6.4% of window height |
| Control bar (game view) | 259 px tall | 23.2% of window height |
| Control bar (start view) | 138 px tall | without the private answer row |
| Header inside the area | 70 px tall tiles | 10% of area height |

The header with score tiles and `Frage x/y` ("Question x/y") lies **inside** the
stage area and is thus public - confirming that the projector shows
the score and question counter, but no controls.

## Scaling

| Target | Aspect ratio | Behavior |
|---|---|---|
| Operator laptop | 16:10 | frame fills the window, stage area stays 16:9 and centered |
| Projector | 16:9 | stage area fills the screen completely |
| Moderator iPad | free | own, text-oriented layout (see `docs/screens.md`) |

Rule: **The area is filled, the typography scales along with it.** This is
implemented via container queries rather than device queries:

```css
.stage { container-type: size; container-name: stage; }
.stage__prompt { font-size: 2.8cqw; }
```

This makes the 1234 px wide preview in the operator window pixel-for-pixel the
same composition as the 1920 px wide projector output. There is no second
typography scale and no breakpoints in the stage layout.

The operator's control frame does **not** scale along: labels and
buttons are set in `rem`, so they stay the same size and
reliably tappable on every laptop.

## Color Tokens

All colors are CSS variables. No component writes a color value directly.

### Base (application's base tone)

| Token | Value | Use |
|---|---|---|
| `pageTop` | `#12161A` | page background, top |
| `pageBottom` | `#171C21` | page background, bottom (linear gradient) |
| `stageTop` | `#171C21` | stage area, top |
| `stageBottom` | `#293139` | stage area, bottom |
| `controls` | `#12161A` | control bar |
| `tile` | `rgb(255 255 255 / 0.09)` | tiles, letter chips |
| `tileDisabled` | `rgb(255 255 255 / 0.05)` | locked area |
| `tileQuiet` | `rgb(255 255 255 / 0.06)` | stepped-back tile |
| `option` | `rgb(255 255 255 / 0.05)` | answer bar, neutral |

The stage area runs lighter from top to bottom and slightly toward blue - a
cool background against which the warm light of the question images works.

**The area colors are semi-transparent.** This isn't a detail, it's the
core of the design: behind the scene lies the blurred question image, and
tiles, letters, and answer bars let it shimmer through like frosted glass,
instead of covering it up. A token with an opaque color would immediately
destroy the depth.

### Blurred Question Image as Background

Behind every scene with an image lies the same image filling the frame,
strongly blurred (`blur(3cqw)`), darkened (`brightness(0.72)`) and overlaid
with a color veil made of `stageTop`/`stageBottom` at 66% opacity. Every
question thus gets its own atmosphere without text losing calm.

Darkening happens deliberately twice, both on the image AND on the veil: the
question images range from night shots to a cloudless summer sky, and a
bright sky would otherwise tip the stage into a milky look.

**During the image reveal**, the same background is much more strongly
blurred (`blur(9cqw)`, `brightness(0.5)`, veil 84%). The task there is
to recognize the subject; the background must not give away a silhouette -
9 cqw is roughly 170 pixels of blur on a 1920-wide projector.

### Radii and Shadows

`--stage-radius` is set to `0.7cqw` - roughly 13 pixels on a 1920 pixel wide
projector. Like all stage sizes, the value is in container units,
so the small operator preview and fullscreen look identical.

`--stage-shadow` (`0 0.5cqw 1.6cqw rgb(0 0 0 / 0.35)`) sits under the image,
tiles, and answer bars. It serves purely for spatial depth -
there are no visible outlines or borders on the stage.

The cyan is a **meaning color, not an area color**: it marks the
active player, the selected answer, the category, and state changes like the
second chance. Large areas stay in the cool background.

### Font Mix on Stage

The serif typeface carries content, the sans-serif carries labels:

| Element | Typeface |
|---|---|
| Question text, answer texts, tile values, seconds, result | Melior |
| `Spieler`, `Punkte`, `Frage` ("Player", "Points", "Question"), category | Noto Sans Display |

The category is set small (1.15 cqw), semi-bold, and in `accent`: an
orientation element above the question, not a second heading.

### Colors of the Control Surface

The eighteen tokens above belong to the **stage**. The operator's control
surface - as well as the moderator view - has its own, fixed
color system, which a mode change does NOT retint:

These values, too, are in `packages/contracts/src/theme.ts` (`uiPalette`), and
not here:

| Variable | Use |
|---|---|
| `--ui-page` | control surface page background |
| `--ui-surface` | cards and bars: control bar, private section, popups, start panel |
| `--ui-surface-quiet` | header and footer |
| `--ui-surface-raised` | lightened area inside a card |
| `--ui-control` | buttons, icon buttons |
| `--ui-control-disabled` | locked icon button |
| `--ui-input` | input fields |
| `--ui-border` | borders and dividers |
| `--ui-border-quiet` | divider inside a card |
| `--ui-border-strong` | edge of a field that should stand out |
| `--ui-scrim`, `--ui-scrim-quiet` | area behind a popup, background of a preview tile |
| `--ui-text` | text |
| `--ui-text-muted` | labels, secondary information |
| `--ui-accent` | primary action, correct answer in the private section, selection ring |
| `--ui-correct` | `Antwort war richtig` ("Answer was correct"), marking of the correct option |
| `--ui-incorrect` | `Antwort war falsch` ("Answer was wrong"), warnings |
| `--ui-warning-soft`, `--ui-error-soft` | highlighted messages in the connection banner |

The reason for the separation is practical, not aesthetic: the room should see
the color of the quiz mode, while the operator always sees the same
surface - otherwise they'd have to relocate their buttons on every mode
change. The dark control surface also makes the stage
preview stand out as the only bright field.

The variables sit on the root element and are untouched by
`themeVariables`; that only sets `--color-*`. A stage component never
accesses `--ui-*` and vice versa.

### Role Colors

The meaning colors come from the **federal government's color
spectrum**. For each token, the shade with the smallest distance to the
previously set color (CIELAB) was chosen, so the stage keeps its
image while still carrying official values. The dark version takes
the lightened shades of the tint scale - the pure tone would drown
on a dark background - the light version uses the same colors at 100 percent.

The values are **not here**, but in `packages/contracts/src/theme.ts`.
A copy in this file would go stale at the next color change, without
anyone noticing.

| Token | Brand color | Meaning |
|---|---|---|
| `accent` | Blue | active player, selected answer, category, state change |
| `accentQuiet` | Petrol, darkened | the same meaning, but closed or no longer operable |
| `primary` | Green | exactly one primary action per screen |
| `solution` | Green | solution bar in the solution scene |
| `solutionChip` | Dark green | letter chip in the solution bar |
| `correct` | Turquoise | circle of the correct feedback |
| `incorrect` | Red, darkened | circle of the incorrect feedback |
| `text` | - | text on all dark areas |
| `textMuted` | - | tile labels, locked buttons |

`--accent-quiet` is the design's most important invention: it shows
"this was the selection" without still inviting interaction. It appears on
the player button after buzzing and on the answer button after resolving.

### Button State Matrix

| State | Area | Text | Occurrence |
|---|---|---|---|
| operable | `--surface-tile` | `--text` | default |
| locked | `--surface-tile-disabled` | `--text-muted` | command not in `allowedCommands` |
| selected, active | `--accent` | `--text` | logged-in answer before resolving |
| selected, closed | `--accent-quiet` | `--text` | after resolving, buzzer assignment |
| primary | `--primary` | `--text` | exactly one button per state |

States are **not** decided in the component, but derived from
`allowedCommands` and the view model (specification 10.4). The design
supplies the display, the server the truth.

## Where the Colors Live

**In exactly one file: `packages/contracts/src/theme.ts`.** That's where the
two design worlds, the light version, the few colors that belong to
no world, and the operator's control frame live. No color value lives anywhere
else; `apps/web/test/palette.test.ts` checks that on every test run.

Two paths run from there:

```text
theme.ts ──> pnpm content:build ──> content/dist/config.json ──> Server ──> Stage
         └─> pnpm palette:build ──> apps/web/src/styles/palette.css
```

The quiz package is the path for operation: the server delivers the colors of
the active mode with every snapshot, and `themeVariables` writes them as
inline variables onto the **frame** around the stage. `palette.css` is the second
path - the fallback level at the root element until the first snapshot arrives, and
the light version, which must sit on the stage element itself.

**Cascade rule of thumb:** an inherited inline value beats a `:root` rule.
Anyone who changes a stage color in the stylesheet therefore changes nothing -
in operation, the quiz package always wins. Only a rule that hangs on the
stage element itself (`.stage--default.stage--bright`) beats the inherited value.

A theme in `config.json` only names **deviations** from its design world:

```jsonc
{ "id": "senioren", "label": "Senioren", "colors": { "accent": "#e8b84b" } }
```

The complete set is built from this at build time; the package remains readable
on its own. A new mode therefore needs **no code change** - exactly as
described in `docs/neue-modi-und-presets.md`.

The token list sits next to the values and applies in three places at
once: the quiz package supplies the values, content validation
checks completeness (a color left blank is an **error**), and the
UI turns them into CSS variables. Composite values like the area
gradient are deliberately only assembled at the point of use - a variable
that already resolved its colors at the root element would ignore
later theme values.

Three namespaces, three areas of responsibility:

| Prefix | Who owns the color | Example |
|---|---|---|
| `--color-*` | the quiz mode - changes with the theme | `--color-accent` |
| `--stage-*` | the location, not the theme - the same in every mode | `--stage-inkOnStrong` |
| `--ui-*` | the control frame - stays dark no matter which mode is running | `--ui-surface` |

`--stage-playerOne` and `--stage-playerTwo` also belong to `--stage-*`, the
two player colors of the touch device: red on the left, blue on the right. They
deliberately do NOT change with the mode - a player recognizes their corner
by them, and if it belonged to a different color in a different mode, they'd
tap the wrong one. From each single color, the stylesheet derives everything
else: the buzzer's background is the same tone, mixed into the stage
background.

The three start-view modes (`Kinder`, `Erwachsene`, `Saarbruecken`) come from
`catalog.modes`. The layout is designed for three entries; more
entries wrap into a second row instead of squeezing the bar.

## Two Design Worlds, Two Versions

There are exactly **two design worlds** (`theme.skin`):

| World | Class on the stage | Who uses it |
|---|---|---|
| `default` | `.stage--default` | Adults and Saarbruecken |
| `kids` | `.stage--kids` | Kids |

Both share **the same markup**. The only difference is the class on
the stage area; every component brings both worlds along in its own CSS
module (`:global(.stage--default)` / `:global(.stage--kids)`). There are no
mode-dependent components or class names - `Score`, not `KidsScore`.

The `default` world additionally has **two versions**:

| Version | Class | Effect |
|---|---|---|
| dark | `.stage--dark` | the quiz mode's values, unchanged |
| light | `.stage--bright` | the same eighteen tokens on a light panel |

The version changes **only colors, transparencies, outlines, and
shadows**. Fonts, components, positions, and spacing are identical in both.
It is a matter of the operator's own preference - it lives in
`localStorage`, not in the snapshot, and the server knows nothing about it.
It is toggled in the header of the operator view, to the left of the
fullscreen switch; in kids mode the switch is dropped, because that world
brings its own paper along.

**Why the theme values sit on the frame and not on the stage:** `themeVariables`
delivers the eighteen tokens as an inline style, and an inline style beats every
class rule. If they sat on the stage itself, `.stage--bright` could
no longer set its colors. They are inherited from the surrounding frame - and
a value on the element itself beats any inherited value.

## Typography

The design uses a **serif typeface** throughout - for questions,
answers, tile values, and buttons alike. There is no second
font family; hierarchy arises solely through size, weight, and
color.

| Role | Size | Unit | Example |
|---|---|---|---|
| Start screen title | 3.8 | cqw | `Bundestags-Quiz` |
| Feedback | 3.8 | cqw | `Richtig!` (Correct!) |
| Result title | 2.8 | cqw | `Spieler 1 hat gewonnen!` (Player 1 has won!) |
| Question text | 2.8 | cqw | question prompt |
| Point value in the tile | 2.6 | cqw | `100` |
| Answer text | 1.9 | cqw | option bar |
| Category above the question | 1.7 | cqw, bold | `Saarbruecken` |
| Tile label | 1.0 | cqw | `Spieler`, `Punkte`, `Frage` (Player, Points, Question) |
| Control bar | 1.0 | rem | buttons and group titles |

### Delivered Fonts

| Family | Files | Use |
|---|---|---|
| **Melior** | `MeliorCom.ttf`, `-Bold`, `-Italic`, `-BoldItalic` | the stage: category, question, answers, tile values, headings |
| **Noto Sans Display** | `-Regular`, `-SemiBold`, `-Bold` (+ additional cuts in stock) | the operator's control frame and the moderator view |

Melior is the design's serif typeface. Noto Sans Display carries the small
labels in the control frame, where reading happens at short distance -
it never appears on the projector. Anyone wanting a single family
everywhere changes exactly one line for that: `--font-ui` in
`apps/web/src/styles.css`.

Embedded locally via `@font-face` with `font-display: block` - never via
a network CDN, because the application must remain usable offline
(specification 2). `block` instead of `swap`, because a font swap in
the middle of the show would be more noticeable than a brief moment without text.

The stage font also sits in the quiz package (`theme.typography`): a
mode can thus get its own font without a code change.

Labels in the UI use **real umlauts** - everywhere
text reaches the user: button labels, headings,
hints, the server's rejection reasons, and log entries. The source texts
are UTF-8; the ASCII transliteration is retained only in comments and in
this documentation.

## Shapes and Spacing

| Token | Value |
|---|---|
| `--radius-tile` | 6 px at 1728 px reference width (0.35% of width) |
| `--radius-option` | 6 px |
| `--radius-circle` | 50% |
| `--gap-tight` | 4 px - between `+` and `-` |
| `--gap-group` | 12 px - between buttons in a group |
| `--gap-section` | 28 px - between the numbered groups |

There are **no shadows, no borders, and no transparent overlays** anywhere
in the design. Separation arises solely through brightness.

## Symbols

| Symbol | Location | Form |
|---|---|---|
| Fullscreen | top right | four corner angles, 2 px stroke, white |
| Sound off | top right, below | speaker with a diagonal slash |
| Checkmark | correct feedback | delivered motion graphic `correct.webm` |
| Cross | incorrect feedback | delivered motion graphic `wrong.webm` |

This clarifies the cross missing from the templates: it is part of the
delivered incorrect graphic.

Fullscreen and sound are drawn as inline SVG with `currentColor`. There is
no icon font and no external symbol files.

## Delivered Graphics

| File | Location in the project | Use |
|---|---|---|
| `quiz-adults.svg` | `content/source/assets/branding/start-adults.svg` | adult start screen: eagle at 8% opacity, with the `?` on top. The title is application text, not part of the graphic |
| `quiz-kids.png` | `content/source/assets/branding/start-kids.png` | kids start screen, 1024 x 828, edge-to-edge |
| `correct.webm`, `wrong.webm`, `trophy.webm`, `stars.webm`, `question-marks.webm` | `apps/web/src/assets/animations/` | motion graphics, VP9 with alpha channel, 500 x 500, 30 fps, no sound |
| `confetti.svg` | `apps/web/src/assets/animations/` | animated SVG for the results view |

The start screens are content of the quiz package and are assigned via
`mode.startVisualAssetId` - a new mode needs no code change for this. The
motion graphics belong to the presentation layer and are registered in
`apps/web/src/presentation/animationAssets.ts` with the length and timing of the
complete statement.

**Outstanding delivery:** start screen for the `Saarbruecken` mode; until then
the placeholder graphic remains in stock.

## Accessibility and Stage Suitability

- Contrast: white text on `#444444` reaches 8.9:1, on `--primary` 2.4:1.
  That's why only short, bold text appears on green areas.
- The `Richtig`/`Falsch` ("Correct"/"Incorrect") feedback is never color-coded
  alone: circle color, symbol, and word all carry the same statement.
- `prefers-reduced-motion` switches every animation to the short value
  stored in the catalog; this doesn't change the functional timings.

## Component Inventory

The implementation follows three layers. A layer may only use the
one below it - that keeps the UI free of special cases.

```text
Layer 1  Global          styles/palette.css, tokens.css, base.css, controls.css,
                         motion.css, stage.css - deliberately not modules
Layer 2  Components      presentation/stage/* and ui/*, one *.module.css each
Layer 3  Areas           StageScreen (+ scenes), OperatorApp, ModeratorApp,
                         PreviewApp, one *.module.css each
```

Only six stylesheets are global, and each for a reason:

| File | Why global |
|---|---|
| `palette.css` | GENERATED from `packages/contracts/src/theme.ts` - all color values |
| `tokens.css` | dimensions, fonts, and durations on the root element |
| `base.css` | fonts, reset, base typography |
| `controls.css` | `.button` and `.field` - any view may use them |
| `motion.css` | the transition registry sets class names as strings |
| `stage.css` | `.stage--default` / `.stage--kids` / `.stage--bright` - the switch all component modules access via `:global(...)` |

| Component | Task | Variants |
|---|---|---|
| `Score` | a player's score card | `header`, `result`, mirrored |
| `Counter` | question counter | - |
| `QuestionComposition` | arrangement of image, question, and answers | stacked, portrait side by side |
| `QuestionHead` | media and question board | with and without image |
| `Media` | image frame, with a tile cover for image recognition | `inline`, `reveal`, `solution`, `portrait` |
| `RevealTiles` | tile cover for image recognition | - |
| `AnswerList` | answer rows with letter chip | `idle`, `selected`, `correct`, `incorrect`, `disabled` |
| `Mascot` | character layer | visible only in the kids world |
| `Buzzer` | a player's buzz area on the touch device | left, right; free, on turn, withdrawn |
| `PlayerFoot` | touch device footer: both player corners and the counter | - |

On the touch device, the rows of `AnswerList` are buttons - the same list,
just with `onSelect`. There is deliberately no second row component for the
device: states, letter chip, and the drawn cards of the kids world
must never diverge.

What changes there is the size: in the room a row is something to
read, on the device something to hit. It therefore gets noticeably more
padding top and bottom - via `padding` and not via a fixed line
height, so a two-line answer grows with it instead of overflowing its tile. The
letter is widened accordingly, otherwise it would stand as a narrow strip
next to a wide tile. In the kids world this doesn't apply: the drawn
card is thumb-sized anyway and brings its own height.

### The Scene on the Touch Device

There, the footer sits below the scene, so it remains an area that is
much wider than tall. But all stage dimensions are in container units and
are designed for 16:9 - in a flat box, every `cqw` value grows
relative to the available height, until the image and question push out
the answers.

The scene therefore keeps its aspect ratio, takes its height from
that, and is its own container at the same time (`container-type: size`). At
its center, this yields EXACTLY the same composition as in the room, only
smaller; what remains left and right is its margin. No component needs a
second dimension for the device.

Every component knows only tokens and its own variants. No component reads
the view model, none sends commands, and none knows the name of a mode.
Every visual change is thus a change to exactly one file.

**Test hooks:** class names are hashed and are not suitable as selectors. The
components instead carry stable data attributes (`data-answer`, `data-panel`,
`data-score`, `data-counter`, `data-media`, `data-prompt` ...); the state of an
answer row is in `data-state`.

## Layout by Question Type

The question and solution scenes don't assemble their content
themselves, but hand it to `QuestionComposition`. Only this component knows
the difference between the layouts; both scenes therefore stay
structured the same way.

| Type | Layout |
|---|---|
| `text-choice` | category and question span the full width, answers below |
| `image-choice` | image on the left, category and question beside it, answers below |
| `person` | large portrait on the left, category, question, and answers to the right |

Only the **presentation type** decides the layout. The identically named
category `person` does not: it says what the question is about, and its
questions exist as `image-choice` - image left, answers below.

The stage carries the type as `data-presentation`. Components that need to
behave differently in one layout - the left-aligned answer text of the
portrait question, for example - hang their rule on this attribute instead of
getting their own variant.

For the portrait, the dimensions are tied to the stage's **height** (`cqh`),
not to its width as usual: the image and answer column should reach
equally far down, and on a flat stage the image must not stick out at the
bottom.
