/**
 * Header of the stage area - ONE header for both design worlds.
 *
 *   [Wordmark]      [Player|1][Score|100]  [Score|100][Player|2]      [Question|3/7]
 *
 * The header is public: the projector shows the score and question counter.
 * The operator's controls (plus/minus) do NOT belong to the public render
 * path; they arrive as slots from outside and stay empty in the stage
 * window.
 *
 * In the result view, cards and counter disappear - the values then appear
 * large in the scene itself. The slots stay in their place so the operator's
 * correction buttons do not move around.
 *
 * THE LOGO IS CONFIGURABLE: if the theme's configuration has a `logoAssetId`,
 * the header shows that image. Without one, it keeps the Bundestag's
 * supplied wordmark.
 *
 * ON THE TOUCH DEVICE ONLY THE WORDMARK REMAINS. There, score and counter sit
 * at the bottom by the buzzers, because they belong to the corner the player
 * stands in - the same components, just in a different spot
 * (`game/PlayerFoot.tsx`).
 */
import type { CSSProperties, ReactNode } from 'react'
import type { PublicQuizViewModel, PublicScore } from '@hfroemmel/quiz-core'
import { cssUrl } from '../cssUrl'
import { textsFor } from '../texts'
import { Counter } from './Counter'
import { Score } from './Score'
import { brandWordmarkUrl } from '../brandAssets'
import { useQuizChrome, useQuizTheme } from '../QuizProvider'
import styles from './StageHeader.module.css'

export interface StageHeaderSlots {
  /** Before player 1's card - the score correction, in the design. */
  beforePlayerOne?: ReactNode
  /** After player 2's card. */
  afterPlayerTwo?: ReactNode
  /**
   * ON a player's card - called once per player.
   *
   * The content sits in its own relatively positioned frame around the score
   * card, and BEHIND it. Anything positioned absolutely here attaches to the
   * card without widening the header or shifting the cards - exactly what
   * the live quiz's joker card needs.
   *
   * The header itself does not know what is attached there: it just passes
   * on this player's score and provides the space.
   */
  besidePlayer?: (score: PublicScore) => ReactNode
}

export function StageHeader({
  view,
  slots,
  variant,
  layout = 'live',
}: {
  view: PublicQuizViewModel
  slots?: StageHeaderSlots
  variant?: 'stage' | 'preview' | 'touch'
  /**
   * Which arrangement the device uses (see `QuizGame`). The kiosk layout puts
   * score cards and counter back into the head - at a table in a foyer the top
   * edge is the calm zone and the hands belong at the bottom, where its
   * buzzers are.
   */
  layout?: 'live' | 'kiosk'
}) {
  /*
   * BEFORE the early return: a hook may not sit behind a condition, and the
   * header leaves the start view to the start menu.
   */
  const hostTheme = useQuizTheme()
  const chrome = useQuizChrome()

  // The start view has neither a score nor a counter - and no correction.
  if (view.scene === 'start') return null

  const t = textsFor(view)
  /*
   * THE KIOSK HEAD IS THE STAGE HEAD, MINUS A PLAYER.
   *
   * Two players get the same two cards the room sees, with the counter moved
   * BETWEEN them: the group then reads as one line about this round, and each
   * card sits on the side of the person it belongs to. One player gets the
   * counter and their points and nothing else - no card with a number on it,
   * and no empty space where the second card would be, because a player alone
   * is not "player 1 of 1".
   */
  const kiosk = variant === 'touch' && layout === 'kiosk'
  const showsScores = (variant !== 'touch' || kiosk) && view.scene !== 'result' && view.playerScores.length > 0
  const showsCounter = showsScores && view.progress.total > 0
  const [playerOne, playerTwo] = view.playerScores
  const solo = view.playerScores.length < 2
  const counter = showsCounter && (
    <div className={styles.counterSlot}>
      <Counter current={view.progress.current} total={view.progress.total} label={t('stage.question')} />
    </div>
  )

  return (
    <header className={styles.header}>
      {/*
        * Wordmark in the top left corner.
        *
        * TWO VERSIONS, ONE PLACE: If the content brings its own logo
        * (`themes[].logoAssetId` in the configuration), it stands there
        * unchanged - it is the organiser's brand and must not be recoloured.
        * Without an own logo the bundled wordmark stays; it lies as a mask
        * over a colour area and thus follows the text colour of the world
        * instead of vanishing as black artwork on a dark ground.
        */}
      {!chrome.brand ? null : view.theme.logoUrl ? (
        <img className={styles.brandImage} src={view.theme.logoUrl} data-brand="" alt="" aria-hidden="true" />
      ) : (
        <span
          className={styles.brand}
          data-brand=""
          style={{ '--logo-url': cssUrl(hostTheme?.assets.wordmark ?? brandWordmarkUrl) } as CSSProperties}
          aria-hidden="true"
        />
      )}

      <div className={styles.scores} {...(kiosk ? { 'data-head-group': solo ? 'solo' : 'duel' } : {})}>
        {slots?.beforePlayerOne}
        {/* One player: the counter leads and the card behind it is points only. */}
        {kiosk && solo && counter}
        {showsScores && playerOne && (
          <div className={styles.scoreGroup} data-score-group={playerOne.playerId}>
            {slots?.besidePlayer?.(playerOne)}
            <Score
              label={playerOne.label}
              score={playerOne.score}
              /*
               * Alone at the device nobody is marked: the blue says "it is
               * this player's turn", and with one player that is always true
               * and therefore says nothing.
               */
              active={!solo && playerOne.active}
              locked={playerOne.locked}
              playerText={t('stage.player')}
              pointsText={t('stage.points')}
              pointsOnly={kiosk && solo}
              {...audienceMarkerFor(view, playerOne)}
            />
          </div>
        )}
        {/* Two players: the counter stands between the cards, in the middle of the head. */}
        {kiosk && !solo && counter}
        {showsScores && playerTwo && (
          <div className={styles.scoreGroup} data-score-group={playerTwo.playerId}>
            {slots?.besidePlayer?.(playerTwo)}
            <Score
              label={playerTwo.label}
              score={playerTwo.score}
              active={playerTwo.active}
              locked={playerTwo.locked}
              playerText={t('stage.player')}
              pointsText={t('stage.points')}
              mirrored
              {...audienceMarkerFor(view, playerTwo)}
            />
          </div>
        )}
        {slots?.afterPlayerTwo}
      </div>

      {/* In the room the counter hangs in the corner; in the kiosk head it stands inside the group. */}
      {!kiosk && counter}
    </header>
  )
}

/**
 * Does this player's card show the group mark instead of their number?
 *
 * ONLY in a game that has jokers, and only while an APPLIED audience joker
 * belongs to this player. Absent otherwise - a card without the prop renders
 * exactly the markup it did before jokers existed.
 *
 * Read off the view model, never off the DOM: the server says which draw is
 * running and whose it is.
 */
function audienceMarkerFor(
  view: PublicQuizViewModel,
  score: PublicScore,
): { audienceMarker?: boolean } {
  if (!score.joker) return {}
  const draw = view.jokerDraw
  return {
    audienceMarker: draw?.phase === 'applied' && draw.type === 'audience' && draw.playerId === score.playerId,
  }
}
