---
'@hfroemmel/quiz-react': patch
---

The scene gets its measurements back - and the kids' question stops landing under its answers.

FOUR SIZES HAD GONE MISSING, each one something another rule depended on:

  1. THE KIOSK SCENE was told to take the full width AND to be 16:9. It cannot
     have both once head and foot have taken their share of the column: the
     browser keeps the width, flex shrinks the height, and a composition
     measured for 1080 draws into 630. In the children's world - where the
     board, the photo frame and the mascot are all a share of the WIDTH - the
     question then sat under the answers. The height is what head and foot
     leave now, and the width follows from it.

  2. THE CHILDREN'S HEAD lost its three columns (`1fr auto 1fr`), so the word
     mark ran into the group beside it. And the solo card kept the empty half
     of the two-field player card: alone at a device there is no player number,
     so it carries the counter's single-field card now.

  3. THE LIVE TOUCH SCENE lost its width entirely. That box is a size
     container, which takes no width from its content - without the line it
     collapses to nothing: header, footer, and an empty middle. It is back,
     and the comment says why it cannot be left out.

  4. THE WIDTH CAP still divided by 0.45, the rendered height of a stage shown
     at 80 percent - a device that shows it full size therefore got a box a
     quarter too tall, and the last answer ended up behind a buzzer. It divides
     by 0.5625 now, and the foot's budget is reserved as a bottom margin,
     because the stage centres its column while the foot stands fixed beside
     it.

And one number followed a change of taste: the reserve of the points cell is
8cqw instead of 7.5, because the cell's own padding grew from 1.2 to 2cqw and
three digits no longer fitted into the old reserve.
