---
'@hfroemmel/quiz-react': minor
---

A host's sound switch keeps applying - and the device says whether it sounds.

`soundEnabled` was read ONCE, at the start of the first round. An application
with a switch of its own - the media table keeps one in its bar - could
therefore silence itself and the quiz would go on sounding into a room that had
just asked for quiet. The value is followed now whenever the HOST changes it,
while a round is running as well; what is remembered is the last value taken
from the host, so a device's own toggle in the settings still works and is only
overruled when the host says something new.

`[data-quiz-game]` carries `data-sound` for it. During a round the settings are
gone - that attribute is the one place the state is visible, which is what
makes the promise above testable from outside (`test/e2e/embedding.spec.ts`,
with the example host's switch thrown mid-round).
