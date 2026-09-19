# Adding a new question type

Presentation form, evaluation method, and medium are modeled separately. So a
new editorial request often does not need a new type at all.

## Check first: does a combination of existing fields suffice?

| Request | Solution without a new type |
|---|---|
| Image with a spoken answer | `image-reveal` with `manual-correct-incorrect` |
| Question without options | `evaluationMode: "manual-correct-incorrect"` plus `acceptedAnswerText` |

## A type that only looks different

Some types differ only in layout. `person` - the question about a pictured
person - plays like `image-choice`, but shows the image large next to the
category, question, and answers. Types like this need neither phases, nor
commands, nor scoring:

1. **Contracts** - add the value to `questionPresentationTypes` and place it in
   the predicates `presentationNeedsOptions` / `presentationNeedsImage`. These
   two functions are the single source of truth for what a type must bring -
   validation and UI read them, nobody keeps their own lists.
2. **Presentation** - add the layout to `QuestionComposition`. The question and
   solution scenes stay unchanged, because both use this building block.
3. **Data and tests** - convert questions, `pnpm content:validate && pnpm
   content:build`, add the scene to `test/e2e/presentation.spec.ts`.

Everything else - phases, buzzer rules, projection, commands - stays untouched.

## When a genuinely new type is needed

1. **Contracts** - `packages/contracts/src/content.ts`:
   add the new value to `questionPresentationTypes`. The compiler then shows
   every place that has to react.

2. **Validation** - `packages/content/src/validate.ts`:
   in `validateMedia` and `validateAnswerModel`, define which media and
   answer fields are required.

3. **Domain** - `packages/domain/src/engine.ts`:
   in `questionEntryPhase`, decide which phase the question starts in. If the
   type needs its own phases, extend `GamePhase` in `@quiz/contracts` and add
   the transitions in `applyPhase`.

4. **Buzzer rules** - `packages/domain/src/buzzer.ts`:
   touch this only if the type introduces new buzzable phases
   (`buzzablePhases`).

5. **Scoring** - usually nothing. The rule "100 without a prior failed
   attempt, 50 otherwise" applies regardless of type.

6. **Projection** - `packages/domain/src/projection.ts`:
   extend `sceneForPhase` and check which fields may become public.

7. **Commands** - `packages/contracts/src/commands.ts`:
   register new commands in `commandSchema` **and** `commandRoles`, then
   assign them to a phase in `allowedCommands.ts`.

8. **Presentation** - `apps/web/src/presentation/scenes/`:
   create a new scene and hook it into `StageScreen.tsx`. Register the
   transition in the registry (see [animationen.md](animationen.md)).

9. **Operator controls** - `apps/web/src/apps/operator/OperatorControls.tsx`:
   bind new controls to `allowedCommands`, not to their own conditions.

10. **Tests** - rule cases in `packages/domain/test/engine.test.ts`, validation
    in `packages/content/test/validate.test.ts`, scene in
    `test/e2e/presentation.spec.ts`.

## Example: audio question

* `presentationType: "audio-then-question"`, `evaluationMode` as usual
* Required medium `audioAssetId` (validation)
* Phases `audio-ready` and `audio-playing`, both **not** in `buzzablePhases`
* Commands `START_AUDIO`, `PAUSE_AUDIO`, `SHOW_QUESTION_AFTER_AUDIO`
* Scene `AudioScene.tsx`, transition `audioEnter.ts`

A medium that plays before the question is a step of its own in front of the
question: an extra phase that is not in `buzzablePhases`, the commands that
start it and hand over to the question, and a scene with its own transition.
The image reveal, which likewise runs ahead of the answers, is the closest
template in the code.
