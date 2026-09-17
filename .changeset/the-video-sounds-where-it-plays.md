---
'@hfroemmel/quiz-core': minor
'@hfroemmel/quiz-react': minor
---

A video sounds where it plays, not where the cues do.

THE BUG, AND IT WAS THE NORMAL SETUP: stage and operator in two browser tabs.
The operator clicks buttons all evening, so their window is the only one a
browser allows to sound and it takes the audio authority. But the operator's
window plays no video - it shows the same area empty on purpose, so the room
sees one picture and not two. The stage played the video MUTED because it was
not the authority. Nobody sounded it: the picture ran, the room heard nothing,
and no error said why.

The two things were coupled that should not be. The cues may sound from any
window that is allowed to; a video is played only by the windows that carry
the room's picture. `QuizRuntimeConnection` therefore has a second authority,
`videoAudioMaster`, and `VideoScene` follows that one (`isVideoAudioMaster` on
`StageScreen`, defaulting to `true` for a host that plays alone). The
`client-info` message carries it; where a server does not send it, the cue
authority decides as before, so an old server stays exactly as it was.

AND A REFUSED CLIP TRIES AGAIN. A browser that has never been clicked in
refuses audible playback, and the scene then plays the picture muted rather
than not at all. That refusal used to last for the whole clip and the next
one, until the window was reloaded. It now ends at the first click or key in
that window, and the clip keeps its position: it goes on sounding where it is
instead of starting over, which in a room is worse than the silence was.
