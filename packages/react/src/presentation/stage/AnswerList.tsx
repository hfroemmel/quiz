/**
 * Answer rows - ONE component for every row, every state, both worlds.
 *
 * Structure of each row: letter chip and answer surface are two separate
 * siblings. The wide background belongs exclusively on the surface; if it
 * sat on the row, the letter would sit on top of it too.
 *
 *   li.answer > span.chip + span.surface > span.text
 *
 * On the stage the rows are NOT buttons: nothing is clicked there, play
 * happens through buzzers and the operator, and the screen only shows the
 * state the server sends.
 *
 * On the touch device they are. There, the tap replaces the buzzer, and then
 * every row needs a real `button` - for the keyboard, for screen readers, and
 * for the hit area. These rows therefore receive `onSelect`; without that
 * callback everything stays as it is on the stage.
 *
 * There is deliberately no second row component that could drift apart
 * later: states, letter chip and artwork must never diverge just because a
 * context was added.
 */
import type { CSSProperties } from 'react'
import { presentationTiming } from '../animationPresets'
import { optionLetter, type AnswerState } from './answerState'
import styles from './AnswerList.module.css'

export interface AnswerRow {
  id: string
  letter?: string
  text: string
  state: AnswerState
  /** Taken out of play by a 50:50 - dimmed in place. */
  eliminated?: boolean
}

export interface AnswerListProps {
  rows: AnswerRow[]
  /**
   * Touch device only: what happens when a row is tapped. If the callback is
   * set, every row becomes a button.
   */
  onSelect?: (optionId: string) => void
  /** Answering is not currently possible - the buttons are inert. */
  disabled?: boolean
  /** Screen readers should know whose answers these are. */
  label?: string
}

export function AnswerList({ rows, onSelect, disabled, label }: AnswerListProps) {
  if (rows.length === 0) return null
  return (
    <ul
      className={styles.answers}
      data-answers=""
      {...(onSelect ? { role: 'group' } : {})}
      {...(label ? { 'aria-label': label } : {})}
    >
      {rows.map((row, index) => {
        /*
         * Fixed column, fixed size: with two-line text the letter must
         * neither grow along with it nor slide downward - otherwise letters
         * A through D would dance vertically out of line.
         */
        const content = (
          <>
            {row.letter && (
              <span className={styles.chip} data-answer-chip="">
                {row.letter}
              </span>
            )}
            <span className={styles.surface} data-answer-surface="">
              <span className={styles.text} data-answer-text="">
                {row.text}
              </span>
            </span>
          </>
        )

        return (
          <li
            key={row.id}
            className={styles.answer}
            data-answer=""
            data-state={row.state}
            /*
             * A row a 50:50 has taken out. It KEEPS its place and steps back in
             * it (see the stylesheet) - no line across it: the room reads the
             * row, and a line would be a second statement over the first. And
             * it leaves the game for good: `aria-hidden` takes it out of the
             * reading order, `disabled` out of reach of thumb and keyboard. A
             * dimmed answer that could still be tapped would be the worst of
             * both.
             */
            {...(row.eliminated ? { 'data-eliminated': 'true', 'aria-hidden': true } : {})}
            style={
              {
                /* Offset of the entrance animation - the rows appear one after another. */
                animationDelay: `${index * presentationTiming.optionStaggerMs}ms`,
                /*
                 * And the same idea on stepping back: several answers taken
                 * out by a 50:50 step back one after another.
                 */
                '--joker-eliminate-duration': `${presentationTiming.jokerEliminateMs}ms`,
                '--joker-eliminate-delay': `${index * presentationTiming.jokerEliminateStaggerMs}ms`,
              } as CSSProperties
            }
          >
            {onSelect ? (
              /*
               * The button carries the same layout as the stage row and no
               * styling of its own: chip and surface should look the same in
               * both places.
               */
              <button
                type="button"
                className={styles.touch}
                data-answer-button=""
                disabled={disabled || row.eliminated === true}
                onClick={() => onSelect(row.id)}
              >
                {content}
              </button>
            ) : (
              content
            )}
          </li>
        )
      })}
    </ul>
  )
}

export { optionLetter }
