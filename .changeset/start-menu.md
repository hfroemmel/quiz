---
'@hfroemmel/quiz-core': minor
'@hfroemmel/quiz-content': minor
'@hfroemmel/quiz-themes': minor
'@hfroemmel/quiz-react': minor
'@hfroemmel/quiz-kiosk': minor
---

One start menu, and the configuration fills it

The device's start selection asked two questions and answered them from a
property and the catalogue; which quiz was played it could not ask at all. A
host that wanted a quiz choice had to bring its own screen - the media table
did, with its own three cards in its own code.

`StartMenu` (`@hfroemmel/quiz-kiosk`) takes the model of `deriveStartMenu` and
asks what the configuration offers: which quiz, how many are playing, how hard.
Every step with a single option falls away, because a choice of one is a hurdle
and not a choice. The offer cards carry the motif of the content
(`artworkAssetId`), and the emphasised quiz takes the whole row (`emphasis`).
`GameStart` keeps its old interface for one release and builds the model itself.

Two rules of a device moved into the core, where the catalogue is built. A quiz
whose levels need somebody to judge an answer does not appear in a device's menu
at all - at the device there is nobody to ask - and a quiz that keeps only some
of its levels there is shortened to them. And `deriveStartMenu` takes the
audience of the installation: a device shows its own audience's offers and never
the other one's.

An offer that cannot be started now says so before the attempt: the content
service counts the questions of every quiz and reports the empty ones
(`quizAvailability`), the menu shows the reason and keeps its button disabled.
The two sentences are interface texts (`start.rejected.no-questions`,
`start.rejected.missing-pool`) and therefore translatable like everything else
on that screen; `kiosk.quizChoice` names the new step.

Levels in the menu model now carry the length of their round (`slotCount`), and
an audience offer always names its levels even when there is only one - the
start command needs the id, and whether there is anything to choose is said by
the length of the list.
