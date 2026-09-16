/**
 * Footer of the touch device: the two player corners and the question
 * counter.
 *
 * It replaces the stage's header on the device. The reason is body posture,
 * not styling: in the hall you look up at the projector, at the table you
 * stand in front of it. Score and buzzer belong where the hand is - at the
 * bottom, in the corner of the player they belong to.
 *
 * Duel:
 *   [Player 1 | Score]     [Notice or "Next"]     [Score | Player 2]
 *   [      BUZZ      ]        [Question 6/7]        [      BUZZ      ]
 *
 * Single-player:
 *   [Player 1 | Score]     [Notice or "Next"]          [Question 6/7]
 *
 * THREE SLOTS IN BOTH CASES, and the middle one sits at the centre of the
 * screen in both. In single-player mode the buzzer and opponent move away;
 * so the notice still sits centred, the counter takes the freed-up third
 * slot - instead of shifting toward the right along with the notice.
 *
 * Notice, "Submit answer" and "Next" share ONE field of fixed height, so
 * switching between sentence and button does not shift anything above it -
 * question and answers must not jump while someone is aiming.
 *
 * The score card and the counter are the SAME components as on the stage.
 * Here they only carry their player's colour; everything else - layout,
 * counting up, the kids' world's drawn card - comes unchanged from there.
 */
import type { PlayerId, PlayerQuizViewModel } from '@hfroemmel/quiz-core'
import { Counter } from '../presentation/stage/Counter'
import { Score } from '../presentation/stage/Score'
import { Buzzer } from './Buzzer'
import { textsFor } from '../presentation/texts'
import styles from './Game.module.css'

interface PlayerFootProps {
  view: PlayerQuizViewModel
  /** Who has the buzz - `null` as long as nobody has pressed. */
  turn: PlayerId | null
  /** Is this player even allowed to grab the buzz? */
  canBuzz(playerId: PlayerId): boolean
  onBuzz(playerId: PlayerId): void
  /** Submit the logged answer and have it revealed. */
  onResolve(): void
  /** Request the next question - only possible after the solution. */
  onContinue(): void
  /**
   * The way onward is somewhere else in this round - then there is none here.
   *
   * It is the details step: where a question carries a background, that card
   * carries the only way on, and from the moment the solution stands - not only
   * once the card is there, or a fast thumb would skip the step in the seconds
   * in between.
   */
  continueElsewhere?: boolean
}

/**
 * The sentence currently shown in the notice field.
 *
 * It is the only place where the device addresses the players, and it stays
 * deliberately sparse: on the second chance, the turn switches to the other
 * player without them having buzzed - they would otherwise see that nowhere
 * else. Everything else the screen says for itself.
 */
function hint(view: PlayerQuizViewModel): string | null {
  if (view.phase !== 'second-chance') return null
  const opponent = view.playerScores.find((entry) => entry.playerId === view.currentPlayer)
  return opponent ? textsFor(view)('kiosk.secondChance', { player: opponent.label }) : null
}

export function PlayerFoot({ view, turn, canBuzz, onBuzz, onResolve, onContinue, continueElsewhere }: PlayerFootProps) {
  const t = textsFor(view)
  const [playerOne, playerTwo] = view.playerScores
  if (!playerOne) return null

  /*
   * In single-player mode there is nobody to signal against: the answers are
   * open as soon as the server accepts them, and a button before that would
   * be pure ceremony.
   */
  const solo = view.playerScores.length < 2

  const corner = (player: (typeof view.playerScores)[number], side: 'left' | 'right') => (
    <div className={styles.corner} data-corner={side}>
      <Score
        label={player.label}
        score={player.score}
        active={turn === player.playerId}
        mirrored={side === 'right'}
        playerText={t('stage.player')}
        pointsText={t('stage.points')}
      />
      {!solo && (
        <Buzzer
          playerId={player.playerId}
          label={player.label}
          side={side}
          buzzText={t('kiosk.buzzer')}
          enabled={!turn && canBuzz(player.playerId)}
          armed={turn === player.playerId}
          onBuzz={onBuzz}
        />
      )}
    </div>
  )

  const text = hint(view)
  const next = view.allowedCommands.includes('CONTINUE') && !continueElsewhere
  /*
   * Submitting is only possible once an answer is logged. Whether one is
   * marked is reported by the view model - the same state everyone else
   * sees too. Only this button triggers scoring; up until then the player
   * may change their mind.
   */
  const submit =
    view.allowedCommands.includes('RESOLVE_ATTEMPT') &&
    (view.visibleOptions?.some((option) => option.state === 'chosen') ?? false)
  const counter = view.progress.total > 0 && <Counter current={view.progress.current} total={view.progress.total} label={t('stage.question')} />

  return (
    <div className={styles.foot} data-player-foot="">
      {corner(playerOne, 'left')}

      <div className={styles.middle}>
        {/* Fixed height, changing content - see above. */}
        <div className={styles.notice} data-notice="">
          {next ? (
            <button type="button" className={`stage-button stage-button--primary ${styles.continue}`} data-continue="" onClick={onContinue}>
              {t('kiosk.continue')}
            </button>
          ) : submit ? (
            <button type="button" className={`stage-button stage-button--primary ${styles.continue}`} data-confirm="" onClick={onResolve}>
              {t('kiosk.submit')}
            </button>
          ) : (
            text && <span className={styles.noticeText}>{text}</span>
          )}
        </div>
        {!solo && counter}
      </div>

      {playerTwo ? corner(playerTwo, 'right') : <div className={styles.corner} data-corner="right">{counter}</div>}
    </div>
  )
}
