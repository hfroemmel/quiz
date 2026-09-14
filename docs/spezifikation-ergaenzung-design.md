# Addendum to the development specification: visual implementation

This addendum finalizes the delivered screen designs for implementation. It is
part of the specification and is subordinate to it: **In case of a conflict
between design and specification, the specification wins; the design then
only determines the appearance.**

It consists of four parts:

| Part | File |
|---|---|
| Colors, grid, typography, components | [`docs/design-system.md`](design-system.md) |
| State by state, including designed states | [`docs/screens.md`](screens.md) |
| Motion, proposed for approval | [`docs/animationskatalog.md`](animationskatalog.md) |
| Order, structure, acceptance | [`docs/umsetzungsplan-ui.md`](umsetzungsplan-ui.md) |

## 1. Binding answers from the review meeting

These points were open and are now decided. They are recorded here so no one
has to guess later.

| Question | Decision |
|---|---|
| What does the projector show from the operator view? | score and `Frage x/y` ("Question x/y") yes, controls no |
| Relationship between design and specification | specification wins, design is purely visual |
| Missing screens | will be designed in the style shown and finalized in `docs/screens.md` |
| Font | font files will be delivered |
| Theming | every mode brings a complete color system with it |
| Scaling | fill the area, typography scales along |
| Animations | catalog is proposed, then approved |
| Incorrect feedback | the cross is missing in the templates and will be added |
| Category above the question | label of the question's first category |
| "click to learn more" | area expands and shows additional information |
| Reveal | grid of tiles that fall one after another; no zoom |
| Score tiles | arranged mirrored |
| Answer options | appear only after `Starten` ("Start") |
| Logged-in answer | marked publicly in blue |
| Reveal ring | struck out again later, see section 5 |
| Black bar at the top | operating system window frame, not a component |
| Mode chips | come from the configuration, layout designed for three |
| Resolutions | laptop 16:10, projector 16:9 |
| `Zurücksetzen` ("Reset") | discards player assignment and logged-in answer |
| Score | counts up during the correct-answer animation |
| Text question without image | category and question full width, options below |
| Second chance | marked visibly - via the player tiles, without its own row |

## 2. Addendum to section 12 - public and private display

The operator view contains the stage output as an embedded area at a 16:9
ratio. This yields a testable rule:

- **Only** the public view model may be rendered within this area. It uses
  the same component as the stage window.
- Private content - solution, background, directorial notes, diagnostics -
  lies **outside** this area, in the lower control bar.
- Operator controls may overlay the area (`+`/`-` next to the score tiles),
  but do not belong to the public render path and do not appear in the stage
  window.

The existing test that verifies the solution never appears anywhere in the
stage client's DOM before the solution scene remains valid unchanged and is
the acceptance test for this rule.

## 2b. Addendum to section 6 - the intermediate step before every round

Every question is first displayed statically so the moderator can read it
aloud. Only the operator's release fades in the answer options or starts the
reveal - and only then can buzzing happen.

| Question type | Waiting state | Release |
|---|---|---|
| Choice question | `question-presented` | `OPEN_BUZZER` ("Antworten einblenden" / "Show answers") |
| Image recognition | `reveal-ready` (new) | `START_IMAGE_REVEAL` ("Enthuellung starten" / "Start reveal") |
| Video question | `video` | `SHOW_QUESTION_AFTER_VIDEO`, then like a choice question |

Two points here are not display questions but business logic:

- In `question-presented`, the server does not transmit the answer options
  **at all**. They therefore do not appear in a stage client's DOM before
  anyone is meant to see them.
- In `reveal-ready`, the reveal clock does not run. The read-aloud time does
  not cost a single second of the ten - the value remains untouched.

After a failed attempt at image recognition, it goes back to
`reveal-running`, not to `reveal-ready`: the question has already been read
aloud.

## 3. Addendum to section 13 - public view model

Newly added:

| Field | Type | Purpose |
|---|---|---|
| `question.categoryLabel` | `string?` | category above the question text; label of the first category |

Both fields are display values. They are projected server-side; the client
derives nothing from them and recomputes nothing.

## 4. Addendum to section 14 - themes in the quiz package

`theme.colors` will in future carry the full token set of the design system
instead of a selection. This makes a mode switch a complete color change of
the interface, without any code change.

Validation: a theme must carry all tokens; missing tokens are an **error** in
the content report, not a hint. A mode without a start image
(`startVisualUrl`) produces a warning.

*Implementation note:* the built package carries the full set - the source,
on the other hand, only the deviations. The values live in a single place
(`packages/contracts/src/theme.ts`) and are filled in at build time. The
commitment thus remains unchanged; it is simply no longer copied into every
file. See `docs/design-system.md`, section "Where the colors live".

## 5. Addendum to section 22 - presentation and animation

- The animation catalog is the complete list of movements. Each row becomes
  exactly one definition under `transitions/`.
- Two durations remain bound to `gameTiming` and carry `locked`: correct and
  incorrect feedback.
- The reveal remains bound to `packages/domain/src/reveal.ts`: which tiles are
  open comes solely from the server's progress variable.
- **Subsequently struck out:** the countdown ring and the second counter next
  to the image. There is no longer a visible countdown on the stage - the
  falling tiles are the clock, and a counter next to it drew attention away
  from the motif. The moderator still sees the remaining seconds in their own
  view. The same decision also removed the alarm-clock sound.
- New: the score counts up during the correct-answer animation. The animation
  interpolates between two snapshot values and never produces its own value.

## 6. Addendum to section 27 - windows and resolutions

| Role | Device | Ratio |
|---|---|---|
| Operator | Laptop | 16:10 |
| Stage | Projector | 16:9 |
| Moderator | iPad | free, own layout |

The stage area stays 16:9 in every environment and fills the available space.
Typography scales via container queries with the area's width, not via device
queries. The black bar at the top edge of the templates is the operating
system's window frame and is not rebuilt.

## 7. Addendum to section 31 - acceptance

Additional acceptance criteria:

1. The operator preview and the stage window show the same composition for
   the same phase; differences exist only in size and control frame.
2. Every state described in `docs/screens.md` is selectable in the
   development view `/preview` and is accepted there.
3. Every row of the animation catalog has a definition with a reduced-motion
   value.
4. A mode switch on the start view re-skins the stage area without any mode
   name appearing in the code. The control interface keeps its own fixed
   color system.
5. No component contains a color value; all colors come from tokens.

## 8. Open points

- Approval of the animation catalog.
- Delivery of the font files, start visuals, icons, and the color systems for
  `Kinder` ("Kids") and `Saarbruecken` (list in
  [`docs/umsetzungsplan-ui.md`](umsetzungsplan-ui.md)).
- Window thumbnail on template 17: not implemented until clarified.
