# Quiz package: schema and example

A quiz package is the **only** source from which the server loads content at
runtime. It is built from `content/source/` and lands, built, under
`content/dist/`.

The editorial content lives with the application that plays it, in
[`hfroemmel/quiz-live`](https://github.com/hfroemmel/quiz-live) -
`content/import` the workbook it is read from, `content/source` the generated
set and its media. `content/source` HERE contains a generated test set (see
README).

It used to live in `hfroemmel/quiz-content-data`, which turned out to be a
master for the text only: its media were declared as Git LFS and never
committed. That repository is now the sheet mapping and its history.

```text
content/dist/
  manifest.json     version, timestamp, media list, checksum
  config.json       quiz types, audiences, pools, presets, themes, categories, difficulties
  questions.json    all questions, sorted by ID
  assets.json       media directory
  assets/           images and videos
```

## Manifest

```jsonc
{
  "schemaVersion": "2.0.0",
  "contentVersion": "1.0.1",
  "profile": "no-video",   // absent in the full profile
  "createdAt": "2026-08-18T05:36:00.000Z",
  "questionsFile": "questions.json",
  "configFile": "config.json",
  "assets": [ /* MediaAsset[] */ ],
  "checksum": "…"          // protects against silent changes to the built package
}
```

If the checksum does not match, the server refuses to load with a plain-text
message. This makes the forbidden practice of "editing the built base JSON
directly during the show" technically detectable. Live corrections go through
hotfixes instead.

## Question

```jsonc
{
  "id": "a-m-02",
  "repetitionGroupId": "hauptstadt-australien",   // optional: content-identical variants
  "poolIds": ["bundestag"],                       // question pools: the axis of content selection
  "audiences": ["adults"],                        // audiences (formerly modeIds)
  "difficulty": "medium",
  "categories": ["geografie"],
  "tags": [],
  "locale": "de-DE",

  "prompt": "Welche Stadt ist die Hauptstadt Australiens?",
  "questionType": "text-choice",                  // text-choice | image-choice | person | image-reveal | video-then-question
  "evaluationMode": "option-comparison",          // option-comparison | manual-correct-incorrect

  "options": [
    { "id": "o1", "text": "Sydney" },
    { "id": "o2", "text": "Melbourne" },
    { "id": "o3", "text": "Perth" },
    { "id": "o4", "text": "Canberra" }
  ],
  "correctOptionId": "o4",                        // ALWAYS explicit, never via position
  "acceptedAnswerText": ["Canberra"],             // for spoken answers

  "media": { "imageAssetId": "img-…", "videoAssetId": "vid-…" },

  "explanation": {
    "summary": "Short text for the moderator's lead-in - internal",
    "details": "Background - read at a device, told in a hall",
    "source": "Source reference - internal only",
    "moderatorNotes": "Directorial note - internal only"
  },
  "enabled": true
}
```

Important:

* **`correctOptionId` is required** for `option-comparison`. The legacy
  assumption "`option_1` is correct" no longer exists. The visible order is
  shuffled per game, without affecting the evaluation.
* Of `explanation`, nothing reaches the stage screen: in a hall the moderator
  tells the background, and a screen writing it out would compete with the
  person speaking. One exception, and it is configured: with
  `rules.showDetailsAfterSolution` the `details` text travels with the solution,
  because at a device nobody is there to tell it - see "The background as a
  step" below. `summary`, `source` and `moderatorNotes` stay with operator and
  moderator in every case, and nothing travels before the solution scene.
* Runtime data does not belong in the content. The legacy field `playCount` is
  deliberately not carried over; usages live in the database's `QuestionUsage`
  history.

## Media

```jsonc
{
  "id": "img-bauwerk-brandenburger-tor",
  "kind": "image",                       // image | video | audio
  "filename": "images/img-bauwerk-brandenburger-tor.svg",   // relative, without ".."
  "mimeType": "image/svg+xml",
  "credit": "Image credit",
  "sourceUrl": "https://…",
  "checksum": "…"                        // added at build time
}
```

Media is referenced exclusively via its **asset ID**. The server serves it
under `/media/<assetId>` and checks that the resolved path lies within the
asset directory. Filenames from quiz data can thus never point to arbitrary
local files.

## Configuration

```jsonc
{
  "questionsPerGame": 7,                 // exactly one source of truth
  "difficulties": [{ "id": "easy", "label": "Leicht" }],
  "categories":   [{ "id": "geografie", "label": "Geografie" }],
  "pools": [
    { "id": "bundestag", "label": "Bundestag" },
    { "id": "saarbruecken", "label": "Saarbrücken" }   // "Saarbruecken" is ONLY a pool
  ],
  "themes": [{
    "id": "kids",
    "label": "Kinderquiz",
    "skin": "kids",                      // design world; colors and fonts are supplied by the host
    "logoAssetId": "logo-kids"
  }],
  "presets": [{
    "id": "medium",
    "label": "Mittel",
    "slots": [
      { "id": "einstieg", "filters": { "difficultyIds": ["easy"], "questionTypes": ["text-choice"] } }
      // … exactly questionsPerGame entries
    ]
  }],
  "audiences": [{
    "id": "kids",
    "label": "Kinder",
    "themeId": "kids",
    "startVisualAssetId": "start-kids",
    "allowedPresetIds": ["easy", "mixed"]
  }],
  "quizzes": [{
    "id": "kids",
    "label": "Kinderquiz",
    "audienceId": "kids",
    "themeId": "kids",
    "presetIds": ["easy"],
    "playerCounts": [1, 2],              // what the start menu offers
    "artworkAssetId": "art-kids",        // motif of the card
    "emphasis": "regular",               // "wide" takes two columns
    "order": 20                          // menu position, ascending
  }],
  "rules": {                             // optional; every value has today's constant as default
    "scoring": { "firstAnswerPoints": 100, "secondChancePoints": 50, "manualAdjustmentStep": 50 },
    "timing":  { "pauseScreenMs": 3000, "imageRevealDurationMs": 10000, "questionLeadInMs": 2500 },
    "jokers":  { "enabled": true },
    "idleTimeoutMs": 120000,             // 0 switches the idle watch off
    "showDetailsAfterSolution": false
  }
}
```

Missing filters mean "any". A special value such as the string `random` is
therefore not needed.

### Rules

`rules` sets only rules the engine already has; a package without the block
plays exactly as before, because every value defaults to the constant in
`packages/core/src/contracts/config.ts`. The bounds are part of the schema: a
feedback animation of ten milliseconds or a reveal of an hour would not be a
setting but a broken evening. The reveal grid, the parameters of the selection
algorithm and the question count stay in code and in `questionsPerGame` - they
are fairness, not taste.

The idle watch and `showDetailsAfterSolution` reach the clients through
`catalog.rules`; everything else is read by the engine on the server.

### The words of the interface

The packages speak German and English themselves - the two languages the
applications are operated in. Which of the two a screen uses follows the
language of the running game (`SET_LOCALE`, `view.locale`), and nothing has to
be configured for either.

`interfaceStrings` in the configuration overrides single strings, per locale:

```jsonc
"interfaceStrings": {
  "de-DE": { "kiosk.difficulty": "Welche Runde?" },
  "fr-FR": { "kiosk.start": "C'est parti" }
}
```

It is for two things, and deliberately not for a third. It is where a host
words a screen in its OWN voice - the media table greets its players instead of
saying "Start a game" - and it is where a third language arrives, without a new
program version. What it is no longer for is translating the package into
English: a set of fifty overrides in a build script is a translation nobody
reviews, and two of them had grown that way.

An unknown locale falls back to German, the base language of the content
format; a region reads as its language, so `en-US` gets the English set.

### The background as a step

`showDetailsAfterSolution` decides who reads the background of a question. It
is a property of the PLACE, not of the content: the same question set runs in a
hall and on a media table.

- **Off (the default).** Nothing of the explanation leaves the server publicly.
  In the hall the moderator tells the background, in their own words, and the
  stage shows the solution alone.
- **On.** The `details` text travels with the solution
  (`visibleSolution.details`), and the device gives it its own step: the card
  covers the stage, carries the only way onward, and the round waits until
  somebody has read it. Where a question brings no background there is no step -
  an empty in-between screen would be worse than none.

The step belongs to the package (`DetailsStep` in `@hfroemmel/quiz-react`, put
in place by `QuizGame`): the delay before the card arrives and the fade in both
directions are the stage's own times (`--stage-details-delay`,
`--stage-fade-duration`), and the round is held from the moment the solution
stands - not only once the card is there, or a fast thumb would skip the step in
the seconds in between.

A host whose room wants a different card passes `renderAfterSolution` to
`QuizGame` and draws its own body; it is handed the text and the way onward, and
everything around it - the holding of the round, the withdrawn footer button -
stays as it is.

### What the start menu of a device makes of it

`deriveStartMenu(config, catalog, locale, { audienceId })` turns the
configuration into the menu the device shows (`StartMenu` in
`@hfroemmel/quiz-react`). Four rules decide what appears there:

- **One audience per device.** The menu shows the quizzes of the audience the
  device is set up for, never the other one's. Where that audience has no quiz
  of its own, the audience itself is the offer - a package without `quizzes` is
  a valid package and plays with `audience` and `presetId` as before.
- **Only what the device can play alone.** A quiz whose levels contain a slot
  somebody has to judge - an image question at the stage - does not appear on a
  device at all. A quiz that keeps only some of its levels there is shortened to
  them, and its default moves along.
- **Every step with one option falls away.** One quiz, one player count, one
  level: the value is still sent, it is just not asked about. A choice of one is
  a hurdle, not a choice.
- **An offer that cannot be started says so.** The server counts the questions
  of every quiz; a configured quiz without questions is named in the menu and
  its button stays disabled, instead of failing at the start. The sentence comes
  from the interface texts (`start.rejected.no-questions`,
  `start.rejected.missing-pool`) and is therefore translatable like everything
  else on that screen.

`playerCounts`, `artworkAssetId`, `emphasis` and `order` are the four fields a
menu reads beyond the quiz itself: what may play it, which motif its card
carries, whether the card takes the whole row, and where it stands.

## Content profiles

The same source produces two packages:

| Profile | Invocation | Content |
|---|---|---|
| `full` | `quiz-content build` | everything, including video questions |
| `no-video` | `quiz-content build --profile no-video` | without video questions and video files |

`no-video` powers the offline apps: it removes video questions and video
media and strips the video type from the question-slot filters. The NUMBER of
question slots per preset stays the same - a slot that only allowed video
questions becomes a free slot. Both profiles are validated separately; the
built package names its profile in the manifest.

Which pools a game draws from is decided by `START_GAME` - either via the quiz
type (`quizId`, with the pools listed in `quizzes`) or directly (`audience`,
optionally `poolIds`); without any specification, all pools take part. Since
schema v2, the quiz package carries NO colors or fonts anymore - presentation
is the host's responsibility (`quiz-themes`).
