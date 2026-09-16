# Import and validation

## Pipeline

```text
editorial sheet - a Google table, or a workbook in a mail
  → final editorial handoff
  → AI-assisted spelling and typo check
  → HUMAN APPROVAL
  → import and normalization
  → strict validation
  → versioned quiz package
  → application build
```

AI suggestions must never be accepted unreviewed: proper names, political
terms, historical spellings, and deliberately wrong answer options would
otherwise be silently changed.

## Commands

```bash
pnpm content:fetch      # optional: fetch raw data from an approved sheet source
pnpm content:validate   # required: schema, references, media, pool coverage
pnpm content:build      # produce a normalized, versioned package
pnpm build              # build the application with the approved package version
```

`content:fetch` writes exclusively to `content/incoming/` and **never**
directly to `content/source/`. Without `QUIZ_SHEET_CSV_URL` it does nothing -
the offline build is unaffected.

A build of the event software never depends on Google Sheets at runtime.

### The sheet itself

```bash
quiz-content import-sheet --url <address> --mapping <file>   # a shared table
quiz-content import-sheet --csv fragen.csv --mapping <file>  # an export
quiz-content import-sheet --xlsx fragen.xlsx --sheet Fragen  # a workbook
quiz-content import-sheet --xlsx fragen.xlsx --print-headers # only the columns
quiz-content import-sheet --url <address> --dry-run          # write nothing
```

All three ways end in the same table, and the import knows only that one.
`--xlsx` reads the file directly - a Google table is one way an editorial team
works, a workbook in a mail is the other, and "export it as CSV first" is a
manual step in front of an automated one: whoever forgets it imports the
previous export. Without `--sheet` the first sheet of the workbook is read, and
the run says which ones there were.

THE SHEET IS THE SOURCE, `questions.json` the product. Whoever corrects the
product loses it with the next import.

The column names are configuration, not code (`--mapping`): every editorial
team names its columns differently, and renaming a sheet is the worse answer.
A mapping states three things - which column carries which field, what applies
where a cell is empty (`defaults`), and how cell values translate into
identifiers (`values`: "leicht" → `easy`).

### Two languages in one sheet

A team that works in two languages writes them side by side: `question` and
`question_en`, `A` and `A_en`. `translations` in the mapping names those column
groups per locale:

```json
{
  "columns": { "id": "ID", "prompt": "Frage", "options": ["A", "B", "C", "D"], "correct": "Richtig" },
  "translations": {
    "en-GB": { "prompt": "Frage EN", "options": ["A EN", "B EN", "C EN", "D EN"], "explanation": "Info EN" }
  }
}
```

Two sheets - one per language - would be the alternative, and then nothing says
WHICH German question the English one belongs to. The pairing lives in the row,
so it is read from the row.

Only what a translation may change can be named: text, options, expected
wordings, background, medium. Everything that decides the game - difficulty,
pool, audience, type, which option is correct - stays with the question itself,
because a translated row is the same question in other words and not another
question. An empty group produces no translation (a question that exists in one
language only), and a group that forgets a single option leaves that one in the
base language instead of dropping it.

## Validation levels

**Errors - the build aborts:**

missing or duplicate question ID · unknown question type · invalid
difficulty, category, or mode reference · missing question text · multiple
choice without a correct option · `correctOptionId` points to no option ·
wrong option count for question types that require exactly four · missing
required medium · missing media file for an active question · unfulfillable
question slot · invalid preset or theme reference · unparseable version
string.

**Warnings - require deliberate approval:**

missing explanation text · missing image credit · very long question or
answer text · near-identical questions without a shared repeat group ·
identical answer options · very small candidate pool · orphaned media ·
questions unreachable from any mode or preset · unused categories · unusual
capitalization of IDs · missing media file for a **disabled** question.

## Report

`pnpm content:validate` writes `content/reports/validation.md`,
`pnpm content:build` additionally writes `content/reports/build.md`. The
report contains:

* Totals by mode, difficulty, type, and category
* Errors and warnings with question ID
* Pool coverage per mode, preset, and question slot
* Number of repeat groups and possible games without repetition
* Media status
* Comparison with the previous package version

### How "games without repetition" is calculated

Question slots with identical filters compete for the same pool. For such a
group of `k` slots and `g` unique repeat groups, `floor(g / k)` games are
possible; the minimum across all groups is decisive. This number is
deliberately conservative - a selection algorithm cannot mask a pool that is
too small.

## Legacy migration

```bash
pnpm content:migrate path/to/questions.js path/to/config.js
```

The migration code does **not** execute the legacy files. It only reads
literals (`packages/content/src/legacy/parseLiteral.ts`); a function call or
a template literal produces a clear error instead of a side effect.

The result lands under `content/migrated/` and is deliberately **not**
carried over automatically into `content/source/`. The report
`migration-report.md` names:

* automatically normalized values (`Kids` → `kids`, `mittel` → `medium`,
  IDs, umlauts) - corrected, but never silently;
* editorial remarks (`Anmerkung`) - what one editor wrote to another about a
  question. They are NOT carried into the product: a remark on a screen is a
  mistake, and a remark dropped in silence loses something somebody meant to be
  read;
* detected repeat groups with matching question text - for confirmation;
* correct answers derived from `option_1` - for spot-checking;
* questions not carried over, with a reason;
* diverging question slot counts of the legacy presets (e.g. eight instead of
  seven).

`info` of the legacy files becomes `explanation.details` - the paragraph an
audience reads after the solution where nobody tells it. It used to land in
`summary`, which is the moderator's lead-in, and a lead-in of six lines is
none.

`playCount` is discarded: runtime data does not belong in the content.

## Preparing media

The real image material of the adopted catalog lives under
`content/source/assets/questions/`. `pnpm content:assets` generates abstract
placeholder graphics and is therefore now meant only for new, still
unillustrated questions - it does not overwrite existing files. A new image
either gets the same file name or its own entry in `assets.json`.

Videos live under `content/source/assets/video/`. They are registered via
`assets.json` just like images (`"kind": "video"`) and attached to a
question via `media.videoAssetId`.
