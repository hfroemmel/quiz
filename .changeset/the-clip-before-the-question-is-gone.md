---
'@hfroemmel/quiz-core': minor
'@hfroemmel/quiz-content': minor
'@hfroemmel/quiz-react': minor
---

The clip before a question is gone - the whole feature, not just its button.

WHAT IT WAS: any question could carry a film that ran before it. That one field
pulled a section of the flow behind it - a phase of its own (`video`), two
commands (`START_VIDEO`, `SHOW_QUESTION_AFTER_VIDEO`), an automatic start for
the unattended device, a scene, a request the server published to the
presentation clients, an audio authority that had to be handed to whichever
window actually played the file, a lead-in time, an asset kind, a question-slot
filter and a second build profile for the applications that could not ship the
files.

WHY IT GOES: no round that ever ran carried one. The only clips that existed
were fixtures for the tests of the feature itself, and one of them stood in the
first slot of every preset of the show - so an evening opened with a Lorem
ipsum film. A section of the flow that carries nothing but its own test
material is not a feature; it is weight on every other one.

WHAT IS GONE FROM THE SURFACE:

  - `PublicScene`/phase `video`, `state.video`, `PublicVideoRequest`
  - commands `START_VIDEO` and `SHOW_QUESTION_AFTER_VIDEO`, the rejection
    reasons `video-question-mismatch` and `video-source-missing`
  - `question.video` and its translation field, `videoUrl` on the view model
  - the slot filter `hasVideo`, the rule `videoLeadInMs`
  - the asset kind `video` - `MediaAsset.kind` is `'image' | 'audio'`
  - `videoAudioMaster` on the runtime status: there is one authority again
  - content profiles: `applyContentProfile`, `BuildOptions.profile` and
    `--profile` on `quiz-content build`/`validate`. One source builds one
    package. `manifest.profile` stays READABLE so packages built before this
    still load; nothing reads the value.

WHAT STAYS: the moving picture where it was never a question - the delivered
animation clips (stars, trophy) play as before, and `.webm` is still served.

The state machine, the scoring and the audio authority are otherwise
untouched, and the suites say so: the engine, the projection and the flow tests
run unchanged after the cut, and the fixture corpora were rebuilt without the
clips - with the same number of question slots, because a slot that only
allowed a film becomes an ordinary one.
