# Kids quiz: illustrated player view

Implementation of the Karlchen the eagle world with the boxes asset package:
the surfaces are the ORIGINAL PATHS from the design (cut from `Boxes.svg`)
and scale via 9-slice; the characters and the background scene are supplied
as vector and WebP respectively. This file is the reference for the
structure, states, and acceptance of this view.

## 1. Inventory before implementation

| Question | Finding |
|---|---|
| Who renders the player view? | `StageApp` → `StageScreen` → scene components under `presentation/scenes/`. There was no dedicated kids view; the modes only differed in their color tokens. |
| Where do question, answers, image, category, players, score, and question counter come from? | Exclusively from `PublicQuizViewModel`: `question.prompt`, `question.categoryLabel`, `question.imageUrl`, `visibleOptions[]`, `playerScores[]`, `progress`. |
| Which states exist? | `PublicOption.state` with `chosen`, `correct`, `chosen-incorrect`; plus the scene (`question`, `solution`, …) and the phase. |
| What is reusable? | `optionLetter` (A–D), the view model, and `StageScreen`'s transition and sound logic. Not the dark primitives (`OptionBar`, `Tile`, `MediaFrame`) - they carry a different visual language. |
| Where do themes, fonts, styles, and asset paths live? | Colors in the quiz package (`content/source/config.json`), fonts and layout in `apps/web/src/styles.css`, media via `/media/<assetId>` from the server. |
| Which viewports? | The stage screen is a container (`container-type: size`); all sizes are in `cqw`/`cqh`. 16:9 and 16:10 are tested. |
| Which tests? | Vitest for domain, content, persistence, and server; Playwright with the `live` (real server) and `preview` (server-free scene preview, with screenshot baselines) projects. |

## 2. Choosing the design world

The world depends on the **theme**, not the mode name:

```jsonc
// content/source/config.json
{ "id": "kids", "skin": "kids" }
```

`quizThemeSchema.skin` (`default` | `kids`) is passed through to the stage
via the view model. `StageScreen` turns it into the ONLY class in which the
two worlds differ:

```text
.stage.stage--default   .stage.stage--kids
```

In the client, no mode name appears anywhere, and there are no more
kids-specific components: header, question board, and answer rows are the
same components as on the adult stage. Each component brings both worlds
along in its own CSS module (`:global(.stage--kids)`). A further mode gets
the kids world without any code change.

## 3. Files

```text
apps/web/public/assets/kinderquiz/     asset package (boxes/, characters/, fonts/)
apps/web/src/styles/stage.css          root classes and tokens for both worlds
apps/web/src/presentation/stage/
├── StageHeader.tsx / .module.css      wordmark, player cards, question counter
├── Score.tsx / .module.css            score card
├── Counter.tsx / .module.css          question counter
├── QuestionHead.tsx / .module.css     question image and question board
├── Media.tsx / .module.css            image frame with a peeking character
├── AnswerList.tsx / .module.css       answer rows
├── Mascot.tsx / .module.css           character layer
├── answerState.ts                     the single derivation of answer state
└── kidsAssets.ts                      list of drawings to preload
```

The addresses of the drawings live in the components' stylesheets, not in the
markup: which drawing a state carries is a matter of design.

## 4. Layers

| Layer | Content | Behavior |
|---|---|---|
| 1 | `karlchen-quiz-scene-16x9.webp` | `cover`, centered right, decorative |
| 2 | wordmark, cards, question, photo, answers | real DOM content |
| 3 | Karlchen (large and small) | `pointer-events: none`, no alt text |
| 4 | drawn SVG surfaces | pseudo-element `::before`, 9-slice via `border-image` |
| 5 | `paper-grain.svg` | overlay over cards AND characters, can be switched off |

On 9-slice: hand-drawn corners must not be distorted. Every box is therefore
split into nine fields following the package's pattern (`boxes.css`) -
corners stay undistorted, edges and center stretch. The slice value per
element comes from `boxes.json` (the `slice` prop of `KidsSurface`); the
component class sets the border width in `cqw`: at 1920 container width it
matches the source value exactly. Two files are derived because the design
does not include them (the process is in the package's README):
`answer-box-correct` (paper -> green) and `answer-box-incorrect` (red ->
muted red).

The player card exists in two drawings per player: `chip-score-playerN`
shows plain paper, `chip-score-playerN-selected` shows the colored field with
the yellow corner. Who is up is thus visible in the drawing itself - the same
world in which every answer state is drawn, not computed.

The question photo carries a meaningful alt text, all decorative images an
empty one.

## 5a. Structure of an answer row

Chip and card are **two separate drawings** with a visible gap
(`clamp(10px, .9cqw, 18px)`):

```text
li.kids-answer                grid, no drawing of its own
├── span.kids-answer__chip    square chip drawing, fixed column
└── span.kids-answer__surface wide card drawing
    └── span.kids-answer__text
```

The wide card never sits on top of the row - otherwise the letter would sit
on it too, and that was exactly what gave away the first version as a
standard-UI look.

## 5. Answer states

Derived in exactly one place: `answerVisualState`.

| Server state | Display | Surface | Chip |
|---|---|---|---|
| `state = 'chosen'` | `selected` | `answer-box-b` (red) | `badge-letter-b` (yellow) |
| Solution scene, `state = 'correct'` | `correct` | `answer-box-correct` (green) | the row's paper badge |
| Solution scene, everything else | `disabled` | the row's paper box, 55% opacity | the row's paper badge |
| `state = 'chosen-incorrect'` | `incorrect` | `answer-box-incorrect` (muted red) | the row's paper badge |
| otherwise | `idle` | the row's paper box | the row's paper badge |

"The row's": in the design, every answer row has its own drawing (a through
d, each wobbling differently); row B only exists in red and uses a
neighboring drawing in its idle state. The mapping lives in
`kidsAssets.answerSurface`.

On the solution scene: there, **only the correct answer** carries color -
the same rule as on the dark stage. `chosen-incorrect` outside the solution
means "this answer is used up in the second chance"; the `answer-incorrect`
surface is meant for that.

## 6. Layout

- Grid and proportions of the design reference: image 27%, question the
  rest, Karlchen 25%.
- Between the question image and the question area there is a visible gap of
  `clamp(16px, 1.4cqw, 28px)`; the two never touch.
- Answer rows and the solution row end at 75% of the width, so the character
  area stays free.
- Karlchen stands at the bottom right edge of the **entire view**, not in the
  question row - so he stands on the floor as in the reference. He is about
  half as tall as the view (`58cqh`) and presents with his wing stretched out
  to the left toward the answers.
- He appears only **once the answers are showing** (`data-answers-shown` on
  the stage) and stays until the solution. While the moderator is still just
  reading the question aloud, his wing would point at an empty area - he
  would be presenting something that does not exist yet. The small Karlchen
  on the image frame belongs to the picture framing and is not affected by
  this.
- **On the touch device he is not shown at all.** There, the outer thirds
  belong to the two players' buzzers, and the character would cover one of
  them. Without him, nothing needs to stay free for him either:
  `--kids-content-width` is set to 100 percent there, and the question and
  answers take up the whole middle. The buzzer itself carries the boxes
  package's drawn answer card - a plain surface in `--tile` would fade away
  on the light paper.
- The small Karlchen looks out centered over the top image edge; his lower
  edge sits 8 to 13 pixels behind the frame drawing, so his hands appear to
  rest on the edge.
- Without a question image, the question area takes over the image column
  (`.kids-stage--textonly`). The order image → question → answers never
  changes.

### Who gives way

The question row is the flexible part: it grows into the free space so the
composition carries the full height as in the reference, and gives it back
as soon as four two-line answers need more room. The answer rows give up
nothing - they are the content this is all about.

### Units

The asset package states its values in `vw`/`vh` and means the stage screen
in fullscreen. They are implemented as PURE container units (`cqw`/`cqh`,
without `clamp` limits): in fullscreen that is the same value, and every
smaller stage - including the operator preview - is an exactly proportional
scale-down. No value is maintained twice, and no pixel cap shifts the
composition.

### Narrower views

| Width | Behavior |
|---|---|
| from 1100 px | full reference composition |
| below 1100 px | answers at 88% width, Karlchen smaller, question area wider |
| below 768 px | developer and operator preview: content scrolls, Karlchen becomes a faint decoration; nothing is removed |

## 7. Fonts

**Patrick Hand** (400) carries everything read: question, answers, category,
and labels. **Melior** (700) carries the numbers (player number, scores,
question counter) and the letters A–D - the same serif as on the main
stage, where digits need to stand still while counting up
(`tabular-nums`).

The handwriting font comes from the asset package and lives under
`apps/web/public/assets/kinderquiz/fonts/`. It is deliberately not bundled:
only this way does it keep a fixed address that `apps/web/index.html` can
preload. `font-display: block` prevents a system font from briefly showing
on the stage; the fallback is a script font, not a system sans. Melior is
bundled in the regular font set (`apps/web/src/styles.css`).

There is **no computed bold**: Patrick Hand has exactly one weight (400),
Melior exists as a genuine bold cut.

## 8. Acceptance

`test/e2e/kids-quiz.spec.ts` checks in the `preview` project:

- wordmark, both player cards, counter, image, question, four answers
- mirrored player cards, exactly one active player
- three-digit scores, counter `7/7`, tabular digits
- state mapping `idle` / `selected` / `incorrect` / `correct` / `disabled`
  with the corresponding surface and chip file
- no CSS border, no CSS radius, no computed shadow on cards, chips, answers,
  image, player cards, and counter
- chip and answer card as separate surfaces with a visible gap
- Patrick Hand for text, Melior for numbers and letters, both actually
  loaded
- visible gap between the question image and the question area
- Karlchen about half the image height, on the right, on the ground,
  without touching the answers; small Karlchen centered above the image
  frame
- long texts in all four target formats: no clipping, multi-line question,
  two-line answers, chip at a fixed size and centered
- fallback without a question image
- `prefers-reduced-motion`
- screenshots at 1920×1080, 1440×900, 1280×720, and 1024×768

For stress testing, the development preview has a **Lange Texte** ("Long
texts") toggle; it inserts the test texts from `ASSET_INTEGRATION.md`.

## 9. Open points

1. **Question and solution have their own components.** Pause screen,
   feedback, reveal, video, start, and result keep their shared composition
   but are redrawn for the kids world (`kids.css`, section "Header of the
   shared scenes"): player groups and question counter carry the card
   drawings via `border-image`, the reveal photo sits in the drawn portrait
   frame (the blur is held by a `clip-path` in the frame), the second-chance
   hint is the yellow chip, and the large result tiles sit on paper.
2. **Exactly one radius remains**: the crop of the question photo
   (`.kids-media__image`). It is read off the inner contour of
   `media-frame.svg` and prevents right-angled photo corners from sticking
   out of the drawing's rounded inner shape (asset package, section 10). All
   drawn components are radius-free.
3. **The wordmark** is the already-approved asset already present in the
   project (`apps/web/src/assets/images/logo.svg`), not the drawing from the
   package.
4. **The kids mode has no start graphics of its own yet.** The start image
   and pause logo still come from the configuration.
