# Adoption of the original question catalog

> **Historical.** Since the system split, the catalog lives with the
> application that plays it, in
> [`hfroemmel/quiz-live`](https://github.com/hfroemmel/quiz-live);
> `content/source` here carries a generated test fixture set. This file
> still describes WHAT was adopted and the catalog's particulars - both
> still apply unchanged, only the location differs. (Between the split and
> 2026-09-17 the catalog sat in `hfroemmel/quiz-content-data`.)

The delivered catalog has been adopted: it carries the 199 real questions.
The previously bundled sample package has been dropped.

The pipeline and tools are documented in
[`docs/inhalte-import.md`](inhalte-import.md); this file records what the
concrete catalog needs.

```bash
pnpm content:migrate <path>/questions.js   # produces content/migrated/ + report
```

## What the catalog contains

| Size | Value |
|---|---|
| Entries | 199 |
| adopted | 199 |
| Image recognition (`image-reveal`) | 64 |
| Image-based choice (`image-choice`) | 128 |
| Pure text choice (`text-choice`) | 7 |
| Difficulties | leicht (easy) 63, mittel (medium) 85, schwer (hard) 51 |
| Modes | adults 143, children 56 |
| Categories | 12 |
| Repeat groups detected | 8 |
| Referenced image files | 156 |

The legacy catalog lists all image questions as image-based choice, and that
stays as is: the `person` layout is an editorial design decision and is
never set by the migration. In the current set, only the test question
`test-person` carries it. The `person` category has nothing to do with this -
it says what the question is about, not what the question looks like.

Category distribution: Saarbrücken 64, Institution 36, Person 24, Gebäude
(building) 18, Geschichte (history) 13, Ämter (offices) 12, Recht (law) 10,
Wahl (election) 9, Begriffe (terms) 5, Kurioses (trivia) 4, Erdkunde
(geography) 2, Fahnen und Symbole (flags and symbols) 2.

## What the migration corrects itself

| Case | Handling |
|---|---|
| `level` instead of `difficulty` | adopted, noted in the report |
| `mittel` / `Kids` | normalized to `medium` / `kids`, noted in the report |
| `img_filename`, `img_credit` | file and image credit stored on the medium |
| `source_reference` | recorded as content source reference on the explanation, **not** as an image credit |
| `playCount` | discarded - usage is tracked by the server |
| single option in image recognition | becomes the expected answer, **not** a visible answer bar |
| IDs with umlauts | normalized (`Saarbrücken` to `saarbruecken`) |

Converting the single legacy option is the most important point: there is no
selection in image recognition. Had the option been kept, the solution would
have stood on the stage from the first second.

## Missing images: replacement image instead of a block

The catalog's 156 image files do not yet exist. Rather than waiting for
them, development runs with a generated replacement image:

| Level | Behavior |
|---|---|
| Validation | `pnpm content:validate` still reports a missing file as an **error** |
| Validation with `--placeholder-media` | reports it as a warning; that's what `pnpm content:validate:dev` and `pnpm content:build:dev` are for |
| Server | serves a generated SVG with the requested file name at the asset address |
| Operator | gets a warning in the diagnostics for every missing file |

This makes the gap visible without blocking it. As soon as the images are
placed under `content/source/assets/questions/`, the warning and the
replacement image disappear without further changes - the file names are
already in `assets.json`.

Live operation stays protected: `pnpm build` uses strict validation and
aborts on missing media.

## What still needs a human decision

1. **Correct answer.** In the legacy data, `option_1` is always the correct
   answer. The migration translates this exactly once into an explicit
   `correctOptionId`; options are shuffled at build time. A spot check
   should confirm this before the package goes into live operation.

2. **16 images without an image credit.** Before an event, it needs to be
   clarified whether they may be shown without credit.

3. **One question is disabled.** Question 151 ("Sprachgrenze im Saarland" -
   language border in Saarland) has only three instead of four answer
   options. It stands as a template in the set but is `enabled: false` and
   is not played. Once the fourth option is added, flipping the field is
   enough.

4. **Two questions with duplicate answer text** and 42 questions without
   explanation text are noted as warnings in the report - both are
   editorial, not technical.

5. **Saarbrücken mode** - confirmed: the mode draws its questions via the
   category `saarbruecken` from both legacy modes (64 questions). Nothing
   needs to change on the questions for this.

## Question slots of the presets

The seven slots per game are designed for the real content set. No slot has
fewer than eight candidates - validation reports no tight pools.

| Preset | Modes | Slot layout |
|---|---|---|
| `easy` | adults, children | Easy intro, easy knowledge, image recognition, deep dive, step-up, image choice, finale |
| `medium` | adults | Easy intro, medium knowledge, image recognition, parliament and people, step-up, image choice, hard finale |
| `hard` | adults | like `medium`, but one level harder throughout |
| `mixed` | adults, children | no difficulty filter, mixed by type and category |
| `regional` | Saarbrücken | seven slots within the Saarbrücken category |

Slot 1 is always a choice question and slot 3 is always an image-recognition
question. The end-to-end tests rely on this; whoever changes the order must
update them too.

## When the images arrive

1. place the files under `content/source/assets/questions/` - the names are
   in `content/source/assets.json`
2. run `pnpm content:validate` (without a flag); the warnings about missing
   media must disappear
3. `pnpm content:build`

A fresh migration run is not needed for this.
