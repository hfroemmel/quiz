# Quiz package: schema and example

A quiz package is the **only** source from which the server loads content at
runtime. It is built from `content/source/` and lands, built, under
`content/dist/`.

The editorial content lives in
[`hfroemmel/quiz-content-data`](https://github.com/hfroemmel/quiz-content-data);
`content/source` here contains a generated test set (see README).

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
    "summary": "Short text - may appear publicly in the solution",
    "details": "Background - operator and moderator only",
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
* Of `explanation`, only `summary` is ever shown publicly - and only in the
  solution scene. `details`, `source`, and `moderatorNotes` never leave the
  server toward the stage screen.
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
