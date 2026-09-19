# Adjusting and testing transition animations

Animations are interchangeable presentation. They **never** control the game
state machine.

Which movements should exist is defined in
[`docs/animationskatalog.md`](animationskatalog.md). This file describes how
they are technically set up and changed.

## Separation of state and presentation

```text
Domain decides:                 phase = attempt-feedback, outcome = correct
Presentation registry:          which animation, which duration, which easing,
                                which sound cue, which reduced-motion fallback
```

The business state transition does not depend on whether a browser delivers an
`animationend` event. The server uses defined fallback times and then sends
`ADVANCE_TIMED_PHASE`.

## Where is what?

```text
apps/web/src/assets/animations/   delivered motion graphics (WebM with alpha, SVG)
apps/web/src/assets/audio/        delivered sounds (mp3, wav)
apps/web/src/ui/AnimationClip.tsx playback building block, knows no game state
apps/web/src/presentation/
  animationAssets.ts       registry of delivered files: length and point in
                           time of the complete statement (`payoffMs`)
  animationPresets.ts      central timings and easings
  soundCues.ts             mapping of cue -> audio file
  SoundProvider.tsx        access to the cues for scenes and tiles
  useStageSounds.ts        cues that arise WITHIN a scene
  soundCues.ts             sound cues (Web Audio, no files)
  StageScreen.tsx          selects scene, applies transition, plays sound cue
  scenes/                  PauseScene, QuestionScene, RevealScene,
                           FeedbackScene, SolutionScene, ResultScene, StartScene
  transitions/
    types.ts               animation contract
    registry.ts             all transitions, mapping to scene edges
    fadeThrough.ts  questionEnter.ts  correctFeedback.ts
    incorrectFeedback.ts  solutionReveal.ts  resultCelebration.ts
```

## Where keyframes belong

Two kinds of movement live in two places, and mixing them up produces a bug
that leaves no trace - the rule is there, the element simply does not move.

* **A whole scene area moving** is applied by the transition registry through a
  GLOBAL class (`.scene-fade`, `.question-enter`, ...). Those classes and their
  keyframes live together in `packages/react/src/styles/motion.css`, which the
  host imports as a plain stylesheet.
* **One component's own movement** - the entrance of an answer row, the
  arrival of the category on the interim screen, the disc of the answer mark -
  belongs in that component's CSS MODULE, keyframes included.

The reason is the module: it scopes every animation name it sees, so
`animation: option-enter ...` in a module asks for a keyframe called
`_option-enter_<hash>`. A definition in `motion.css` is not that, and the
browser silently runs no animation at all. Whoever adds a keyframe to a module
therefore defines it in the same file - and whoever tests one asks not only for
the name but for whether a keyframe of that name is loaded
(`test/e2e/steady-layout.spec.ts`).

## The animation contract

```ts
interface PresentationTransitionDefinition {
  id: string
  description: string
  appliesTo: { from: PublicScene | '*'; to: PublicScene }
  durationMs: number
  delayMs?: number
  easing: string
  reducedMotionDurationMs: number
  soundCueId?: SoundCueId
  classNames?: { from?: string; active?: string; to?: string }
  locked?: string    // reason, if the duration cannot be freely changed
}
```

Each definition answers, in exactly one place: which scene transition, which
elements, which duration and which easing, which sound cue, which
reduced-motion fallback, and what is fixed for fairness reasons.

## Adding a new transition animation

1. create the definition in the `transitions/` directory
2. register ID and timing in the registry (the `transitions` list in `registry.ts`)
3. map the affected scene edge via `appliesTo`
4. add the reduced-motion fallback (`reducedMotionDurationMs`)
5. check it in the development view `/preview`
6. update the visual regression test (`test/e2e/presentation.spec.ts`)

The associated CSS class goes into `apps/web/src/styles.css`; duration, delay
and easing are **not** hardcoded there, but set from the registry via
`--transition-duration`, `--transition-delay` and `--transition-easing`.

## What may I change, and what not?

| Value | Changeable? |
|---|---|
| `sceneFadeMs`, `optionStaggerMs`, `resultConfettiMs`, `scoreCountUpMs` | free - purely visual |
| Easings, class names, keyframes | free |
| `correctFeedbackMs`, `incorrectFeedbackMs`, `solutionDelayMs`, `pauseScreenMs` | only in `gameTiming` (`packages/contracts/src/config.ts`) - the server ends the phase after exactly this time |
| `imageRevealDurationMs` | confirmed at ten seconds; changes only after consultation |
| Deriving the image resolution from the reveal progress | must **not** be changed - fairness |
| `payoffMs` of a delivered motion graphic | only together with the file; the phase must run at least that long |

Anyone who changes a feedback duration only in the animation lets the display
and the game state drift apart: the solution would appear while the animation
is still running. That's why `correctFeedback.ts` and `incorrectFeedback.ts`
deliberately mirror `gameTiming` and carry a `locked` field with a reason.

## Image resolution

The image lies under a blanket of tiles that disappear one after another
during the reveal. Which tile falls when is defined in the domain's reveal
plan and depends solely on the server's progress:

```text
progress = clamp(elapsedMs / durationMs, 0, 1)
open     = progress >= plan[tile]
```

The functions live in `packages/domain/src/reveal.ts`; the client uses them
via `useRevealClock`. An independent CSS animation must never run alongside a
separate JavaScript timer - otherwise a player would gain an informational
advantage.

There is no longer a visible countdown: the tiles ARE the clock. The
moderator still sees the remaining time in their own view.

The grid can be adjusted via `revealGrid` in
`packages/contracts/src/config.ts` - size, spread, focal point of the motif,
and the fade of a single tile.

## Pausing and reconnecting

If the server pauses the reveal, the value freezes because `status !== 'running'`
does not allow further calculation. After a reconnect, the next snapshot
immediately takes over the server's state again - the client never restarts at
10. Both are covered by `test/e2e/live-presentation.spec.ts`.

## Development view

```bash
pnpm dev     # then http://localhost:5180/preview
```

The preview is deliberately server-free: it does not open a WebSocket
connection, sends no commands, and uses locally generated sample view models.
In the production build it is locked via `import.meta.env.DEV` and thus does
not interfere with the production workflow.

It allows: choosing a scene, switching theme, toggling the feedback variant,
checking the reveal progress via a slider, simulating a draw, replaying a
transition repeatedly, and inspecting all registered transitions with
duration, reduced-motion value, and locked spots.

## Tests

```bash
pnpm test:e2e --project=preview   # scenes, themes, reveal synchronization, reduced motion, screenshots
pnpm test:e2e --project=live      # double click, reconnect, window loss, solution lock
pnpm test                          # fake-clock tests of reveal and feedback timings
```

Screenshot baselines are platform-dependent. Once on a new system:

```bash
npx playwright test --project=preview --update-snapshots
```
