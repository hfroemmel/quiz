/**
 * The lower half of the KIOSK layout - one component, two modifiers.
 *
 * A device standing in a foyer is not a device at a live event. There an
 * operator runs the round and the players know the rules before they touch
 * anything; here two strangers walk up to a table and have to see what to do
 * from the screen alone. That is the whole reason this layout exists, and it
 * is what every decision below follows from.
 *
 * Duel:
 *
 *   [ buzzer ]        Wenn du die Antwort kennst, jetzt buzzern!   [ buzzer ]
 *                                 Runde beenden
 *
 * Single player:
 *
 *                     Sicher? Dann gib deine Antwort nun ab.
 *                                Antwort abgeben
 *                                 Runde beenden
 *
 * THREE ROWS THAT NEVER MOVE. The hint field, the middle button and the way
 * out of the round each keep their place through every state of a question -
 * an empty hint field still takes its height. Whoever is aiming at an answer
 * with a finger must not have the screen reflow underneath them because a
 * sentence got shorter.
 *
 * WHERE THE CONFIRMATION SITS SAYS WHOSE IT IS. In a duel the answer belongs
 * to the player who buzzed, so "Antwort abgeben" stands ON their buzzer -
 * their hand is already there, and the other corner stays what it now is: shut.
 * With one player there is no corner and no buzzer at all, so the button takes
 * the middle, right above the way out.
 *
 * WHAT IS NOT HERE: the score cards and the question counter. They sit in the
 * head of this layout (`StageHeader`), because at a table you look down at the
 * screen and the top edge is the calm zone - the hands belong at the bottom.
 */
import type { PlayerId, PlayerQuizViewModel } from '@hfroemmel/quiz-core'
import type { ReactNode } from 'react'
import { Buzzer } from './Buzzer'
import { textsFor } from '../presentation/texts'
import styles from './Game.module.css'

interface KioskFootProps {
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
   * It is the details step, which carries the only way on while it stands.
   */
  continueElsewhere?: boolean
  /** The way out of the round, drawn by the game where the host allows it. */
  endRound?: ReactNode
}

/**
 * The one sentence the device says right now.
 *
 * THE ORDER IS THE PRIORITY, and it is what keeps a stale sentence off the
 * screen: the state furthest along the question wins, so the call to buzz is
 * gone the moment somebody has, and the call to choose is gone the moment a
 * row is marked. Only one of them is ever true anyway - the order says what
 * happens if that ever stops being the case.
 *
 * The texts come from the package's interface strings, so the content can
 * replace every one of them for a language the package does not speak.
 */
function hint(view: PlayerQuizViewModel, turn: PlayerId | null, chosen: boolean): string | null {
  const t = textsFor(view)
  const player = view.playerScores.find((entry) => entry.playerId === (turn ?? view.currentPlayer))
  const solo = view.playerScores.length < 2

  if (chosen && view.allowedCommands.includes('RESOLVE_ATTEMPT')) return t('kiosk.hintSubmit')
  /*
   * The second chance passes the question to the other player WITHOUT them
   * having buzzed - nothing else on the screen says so, which is why this
   * sentence stays its own and is not folded into the one below.
   */
  if (view.phase === 'second-chance' && player) return t('kiosk.secondChance', { player: player.label })
  if (turn && player && view.allowedCommands.includes('LOG_OPTION_ANSWER')) {
    return solo ? null : t('kiosk.hintChoose', { player: player.label })
  }
  if (!solo && !turn && view.allowedCommands.includes('BUZZ')) return t('kiosk.hintBuzz')
  return null
}

export function KioskFoot({
  view,
  turn,
  canBuzz,
  onBuzz,
  onResolve,
  onContinue,
  continueElsewhere,
  endRound,
}: KioskFootProps) {
  const t = textsFor(view)
  const [playerOne, playerTwo] = view.playerScores
  if (!playerOne) return null

  const solo = view.playerScores.length < 2
  const chosen = view.visibleOptions?.some((option) => option.state === 'chosen') ?? false
  /*
   * Submitting is only possible once an answer is marked. Whether one is
   * marked is reported by the view model - the same state everyone else sees.
   * Only this button triggers scoring; up until then the player may change
   * their mind.
   */
  const submit = view.allowedCommands.includes('RESOLVE_ATTEMPT') && chosen
  const next = view.allowedCommands.includes('CONTINUE') && !continueElsewhere

  const confirm = (
    <button
      type="button"
      className={`stage-button stage-button--primary ${styles.kioskConfirm}`}
      data-confirm=""
      onClick={onResolve}
    >
      {t('kiosk.submit')}
    </button>
  )

  const corner = (player: (typeof view.playerScores)[number], side: 'left' | 'right') => (
    <div className={styles.kioskCorner} data-corner={side}>
      <Buzzer
        playerId={player.playerId}
        label={player.label}
        side={side}
        look="graphic"
        buzzText={t('kiosk.buzzer')}
        enabled={!turn && canBuzz(player.playerId)}
        armed={turn === player.playerId}
        /*
         * Shut, not merely quiet: whoever did not get the buzz sees a grey
         * button, and that is a different statement from the dimmed one every
         * corner shows while the question is still being read.
         */
        locked={Boolean(turn) && turn !== player.playerId}
        onBuzz={onBuzz}
      />
      {/* The confirmation belongs to the hand that buzzed - so it stands on that corner. */}
      {submit && turn === player.playerId && confirm}
    </div>
  )

  const text = hint(view, turn, chosen)

  return (
    <div className={styles.kioskFoot} data-player-foot="" data-kiosk-foot="" data-mode={solo ? 'solo' : 'duel'}>
      {!solo && corner(playerOne, 'left')}

      <div className={styles.kioskMiddle}>
        {/*
          * ONE FIELD, FIXED HEIGHT, two things that never appear together: the
          * sentence for the state of the question, and the way on once the
          * solution stands. "Weiter" belongs to both players, so it stands in
          * the middle in either mode - and in the same row the sentence
          * occupied a moment ago, which is what keeps the button below from
          * moving.
          */}
        <div className={styles.kioskHint} data-notice="" data-hint="">
          {next ? (
            <button
              type="button"
              className={`stage-button stage-button--primary ${styles.kioskConfirm}`}
              data-continue=""
              onClick={onContinue}
            >
              {t('kiosk.continue')}
            </button>
          ) : (
            text && <span className={styles.noticeText}>{text}</span>
          )}
        </div>
        {/*
          * The confirmation's row exists ONLY where the confirmation can land
          * in the middle - with one player. In a duel it stands on the buzzer
          * of the player it belongs to, and a row kept empty for it here would
          * push the way out of the round a button's height down for nothing.
          */}
        {solo && <div className={styles.kioskAction}>{submit && confirm}</div>}
        {endRound}
      </div>

      {!solo && playerTwo && corner(playerTwo, 'right')}
    </div>
  )
}
