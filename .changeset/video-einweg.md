---
'@hfroemmel/quiz-core': minor
'@hfroemmel/quiz-content': minor
'@hfroemmel/quiz-themes': minor
'@hfroemmel/quiz-react': minor
'@hfroemmel/quiz-kiosk': minor
---

Turn the video question into a one-way flow: an order out, nothing back

The video used to be modelled twice - once in the browser that played it and once
in the server state, which carried a status, a position, a reported duration and
an error, and scheduled the end of the phase from that duration. Two truths about
one playback drift apart, and everything the operator saw about the stage was the
drifting copy.

Now the server publishes an order and stops there:

```ts
interface VideoPlaybackRequest { questionId: string; requestId: string; requestedAt: string }
```

`START_VIDEO` carries the `questionId` it was clicked for and writes a fresh
`requestId`; the stage remembers the last one it executed and starts from zero on
any other. A second click is simply a new order. Nothing is reported back, and the
end of the video is no longer a server-side transition - the last frame stands
until the operator shows the question.

Breaking changes for hosts:

- The phases `video-ready`, `video-playing` and `video-ended` are one phase,
  `video`.
- `START_VIDEO` now requires `{ questionId }`; `PAUSE_VIDEO`, `RESTART_VIDEO` and
  `REPORT_VIDEO_STATUS` are gone, as is `gameTiming.videoTailMs`.
- `PublicVideoState` (status, position, duration, error) becomes
  `PublicVideoRequest` (`questionId`, `requestId`).
- `SHOW_QUESTION_AFTER_VIDEO` is open to the `player` role, because a self-service
  device has no operator to press it.
- `PublicQuestion` gained `id`, so a client can tell whether an order belongs to
  what it is showing.
- `StageScreen`'s `onReport` prop is now `onCommand` - the stage does not report,
  and in the operated flow it sends nothing at all.

The empty host overlay pad no longer swallows pointer events, which it did over
anything laid out beside a scaled stage.
