/**
 * Image guessing with synchronous reveal (spec 10).
 *
 * The image sits under a cover of tiles that disappear one after another. It
 * IS the clock: anyone wanting to see how much time is left looks at the
 * image. There used to be a number beside it; it was deliberately dropped -
 * the room should look at the picture, not at a counter.
 *
 * NOTHING ELSE STANDS NEXT TO THE IMAGE. There used to be a director's note
 * here for the preview (`pausiert`, `Buzzern weiterhin möglich`). It came and
 * went with the phase and pushed the picture aside while doing so - right at
 * the moment everyone is looking at it. What it said is in the control bar
 * anyway.
 *
 * DERIVING THE REVEAL: `reveal.progress` comes from `useRevealClock` and
 * thus from server state. No CSS animation of its own may ever drive the
 * reveal here - otherwise the picture would run against the server's clock,
 * and a player could gain an information advantage.
 *
 * Nothing changes about the image itself: no zoom, no motion (confirmed
 * design decision).
 *
 * BEHAVIOUR ON PAUSE AND RECONNECT: if the server pauses the reveal, the
 * value freezes, because `status !== 'running'` disallows any further
 * advance. After a reconnect, the next snapshot immediately takes over the
 * server's state again.
 */
import { revealGrid } from '@hfroemmel/quiz-core'
import { Media } from '../stage/Media'
import { QuestionHead } from '../stage/QuestionHead'
import styles from './scenes.module.css'
import type { SceneProps } from './sceneProps'

export function RevealScene({ view, reveal }: SceneProps) {
  const question = view.question
  if (!question) return null

  return (
    <div
      className={`${styles.scene} ${styles.reveal}`}
      data-fit-box=""
      data-paused={String(view.reveal?.status === 'paused')}
    >
      <QuestionHead question={question} />

      <div className={styles.revealStage}>
        <Media
          src={question.imageUrl}
          {...(question.imageCredit ? { credit: question.imageCredit } : {})}
          reveal={{ grid: revealGrid, progress: reveal.progress }}
          variant="reveal"
        />
      </div>
    </div>
  )
}
