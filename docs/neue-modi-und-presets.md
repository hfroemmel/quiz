# New audiences, pools, and difficulty presets

Audiences, question pools, and presets are pure configuration in
`content/source/config.json`. There is **no** special-case code for them in
the engine - in particular not for `kids` or `Saarbruecken`.

Since schema v2, the three axes are separate:

* **Audience** (`audiences`): who is playing. It carries the theme, start
  graphic, and the allowed presets.
* **Question pool** (`pools`): which content set is drawn from. The
  questions name their own pools (`poolIds`); which pools a game draws from
  is decided by `START_GAME` - without a specification, all of them
  participate.
* **Preset**: the dramaturgical flow configuration of the question slots.

On top of that, since the quiz selection at the podium, there is a fourth,
summarizing axis:

* **Quiz type** (`quizzes`): the single offering an operator chooses before
  the evening - "Bundestagsquiz", "Kinderquiz", "Bremen-Quiz". It NAMES the
  three axes below, it does not replace them.

## Creating a quiz type

```jsonc
{
  "id": "bremen",
  "label": "Bremen-Quiz",
  "subtitle": "Ein Quiz zur Freien Hansestadt",
  "audienceId": "adults",
  "themeId": "default",
  "poolIds": ["bremen"],
  "presetIds": ["medium"],
  // What the start menu shows - all four optional:
  "playerCounts": [1, 2],
  "artworkAssetId": "art-bremen",
  "emphasis": "regular",
  "order": 30
}
```

Rules:

* `audienceId`, `themeId`, `poolIds`, and `presetIds` must exist; every
  preset must be open to the audience. Anything else is a hard validation
  error.
* **The difficulty choice is not represented as a separate switch**, but
  follows from `presetIds`: exactly one preset means "no choice, this one
  applies"; several mean "the operator chooses". The form asks
  `catalog.quizzes[].supportsDifficulty` and does not rebuild the rule.
* `defaultPresetId` is the default of the choice. Without one, the first
  entry applies. The order of `presetIds` is the order of the offering.
* The quiz type's theme applies DURING the game and takes precedence over the
  audience's. Without a quiz type - at a kiosk device, for example - the
  audience's theme applies. So there is exactly one mapping at any given time.
* A colorful card on stage is NOT a theme. The offering overview colors its
  cards by quiz, the quiz itself runs in the theme from this row.
* `playerCounts` says which player counts this quiz offers. Without the entry
  both apply. A device only one person stands at states `[1]`, and the question
  about the number of players falls away.
* `artworkAssetId` is the motif of the card and must exist in `assets.json`;
  `emphasis: "wide"` gives the card two columns. Both are optional: without
  them the card carries its name and nothing else.
* `order` places the card in the menu, ascending, with gaps (10, 20, 30) so
  that one more quiz can be put in between. Quizzes without an `order` follow
  in the order of the configuration.

The whole menu comes out of these fields: `deriveStartMenu(config, catalog,
locale)` in `@hfroemmel/quiz-core` turns them into one model that the kiosk
device, the operator form and the stage overview all read. A quiz without a
question set is reported there as unavailable BEFORE the start, with a reason -
the menu never reroutes silently.

The server resolves the quiz type at start (`resolveQuizMode`), writes
audience, pools, and preset into the game state, and only ever serves them
from there afterward. Neither the podium nor the stage derives anything from
it themselves.

## Creating a new audience

1. Optionally add a theme:

```jsonc
{
  "id": "senioren",
  "label": "Seniorenquiz",
  "logoAssetId": "logo-senioren"
}
```

A theme can choose, via `skin`, which **design world** it belongs to:
`default` (the stage, the default) or `kids` (the illustrated Karlchen
world). There are no other worlds - a new one would need its own artwork and
its own rules in every component module.

Colors and fonts do NOT live in the quiz package: presentation is the host's
responsibility and comes from the interface's theme layer (`quiz-themes`,
values from `packages/contracts/src/theme.ts`). The package only names the
world.

An audience without its own design preferences simply references an existing
theme (`"themeId": "default"`).

2. Add the audience:

```jsonc
{
  "id": "senioren",
  "label": "Senioren",
  "themeId": "senioren",
  "startVisualAssetId": "start-senioren",
  "allowedPresetIds": ["easy", "mixed"]
}
```

3. Assign questions to the audience (`"audiences": ["senioren"]`).
4. `pnpm content:validate && pnpm content:build`.

The audience then appears automatically in the operator's start view - the
list comes from `view.catalog`, and thus from validated configuration, not
from UI constants.

## Regional selection: a pool, no special-case code

`Saarbruecken` is a **question pool**. The regional questions carry
`"poolIds": ["saarbruecken"]`, all others `"poolIds": ["bundestag"]`; the
pool itself is listed with an ID and a label in `pools`. An operator starts a
regional game by choosing any audience, plus the `Saarbrücken` pool, plus the
`regional` preset - theme and game rules stay unchanged.

A new pool thus needs three steps: an entry in `pools`, `poolIds` on the
questions, done. The operator's start view shows the pool selection on its
own, as soon as there is more than one pool.

## Presets for the touch device

There is no one at the touch device who could evaluate a spoken answer. A
preset is therefore only playable there if **every** question slot filters
for evaluable questions:

```jsonc
{
  "id": "touch-easy",
  "label": "Leicht",
  "slots": [
    {
      "id": "einstieg",
      "label": "Einstieg",
      "filters": {
        "difficultyIds": ["easy"],
        "evaluationModes": ["option-comparison"]
      }
    }
    // ... further slots, each with "evaluationModes"
  ]
}
```

Suitability is derived from the filters, not stated separately - a second
statement could deviate from it. The validation report shows it per preset
("Suitable for the touch device"), and the device's start view only gets
suitable presets in its catalog.

An image-recognition question slot only belongs in a touch preset if the
questions there have answer options: the reveal runs, and a tap freezes it.
Image questions that need a spoken answer are skipped in self-service
operation.

## Creating a new preset

A preset is a **dramaturgical flow configuration**, not a global filter.
`easy` may therefore contain individual medium-difficulty question slots.

```jsonc
{
  "id": "kurzformat",
  "label": "Kurzformat",
  "slots": [
    { "id": "einstieg",     "filters": { "difficultyIds": ["easy"], "questionTypes": ["text-choice"] } },
    { "id": "wissen",       "filters": { "categoryIds": ["wissenschaft", "natur"] } },
    { "id": "bilderkennen", "filters": { "questionTypes": ["image-reveal"] } },
    { "id": "mittelfeld",   "filters": { "difficultyIds": ["medium"] } },
    { "id": "steigerung",   "filters": { "difficultyIds": ["hard"] } },
    { "id": "bildauswahl",  "filters": { "questionTypes": ["image-choice"] } },
    { "id": "finale",       "filters": {} }
  ]
}
```

Rules:

* The number of slots must match `questionsPerGame`; otherwise the build
  fails.
* Missing filters mean "any".
* Slots with **identical** filters compete for the same pool. Different
  filters significantly increase the number of repetition-free games.
* The preset's name is not an automatic filter.

Afterward, enter the preset in `allowedPresetIds` of the desired audiences and
run `pnpm content:validate`. Unfillable question slots are hard errors; too
small a pool produces warnings with a concrete candidate count.

## Changing the number of questions

Adjust `questionsPerGame` in `config.json` and bring **all** presets to the
same slot count. The number is not hardcoded anywhere else: UI, server, and
data model all read it from the configuration.
