---
'@hfroemmel/quiz-react': minor
---

The answers move in - and the head stands still while a score grows.

THE ENTRANCE NEVER RAN, for two reasons at once, and both of them are the kind
that leave no trace: the rule was there, the rows simply appeared.

  1. It took the duration and the easing of the SCENE transition, and the
     answers are released in the MIDDLE of a question, where no transition
     runs - the variables were unset and the declaration invalid. The entrance
     is the row's own now: `presentationTiming.optionEnterMs` (380 ms), 70 ms
     apart, with the stage's own easing.
  2. Its keyframes lived in the global `styles/motion.css`, and a CSS module
     cannot reach them by name - it scopes every animation name it sees, so the
     rule asked for a keyframe called `_option-enter_<hash>` that nothing
     defined. The keyframes of a component now live in that component's module
     (`stage/AnswerList.module.css`), exactly where the answer mark's disc
     already had its own; `motion.css` keeps what the transition registry
     applies to the whole scene area and says so.

The same two-line bug had silenced the arrival of the CATEGORY on the interim
screen: `pause-category-in` was referenced in a module and defined nowhere at
all, so the category stood there with the counter instead of following it by a
moment. It rises a line as it fades in now, like the answer rows and in the
same unit.

A rise of 1.4 cqw and a fade, on the adults' stage and on the drawn cards of
the kids' world alike. With `prefers-reduced-motion` the rows stand there at
once - and without the stagger, which would otherwise leave the last row
waiting a quarter of a second for a movement that no longer happens.

AND THE JUMP. The points cell was as wide as the number in it, so the first
correct answer of a round - nought becoming a hundred - widened the card and
pushed the counter and the other player's card sideways, measurably: eleven
pixels, at exactly the moment everybody is looking at the score. The cell
reserves three digits now, which is the most a round produces, and the digits
are tabular, so 111 and 999 are the same width.

Measured rather than asserted: `test/e2e/steady-layout.spec.ts` reads the rows'
animation - its name, its duration, its stagger AND whether a keyframe of that
name is loaded at all, which is the only way to tell a working entrance from a
reference into nowhere - and `test/e2e/kiosk-layout.spec.ts` holds the head
group against a score growing to three digits.
