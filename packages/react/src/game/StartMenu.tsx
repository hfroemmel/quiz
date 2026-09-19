/**
 * The start menu - one screen for every self-service quiz.
 *
 * IT ASKS WHAT THE CONFIGURATION OFFERS, and nothing else. Which quizzes there
 * are, how many can play them, which levels they have, in which languages: all
 * of it comes in as one derived model (`deriveStartMenu` in
 * `@hfroemmel/quiz-core`). There is no list in this file that a new quiz would
 * have to be added to, and no host that has to build its own screen for one -
 * the media table used to, with its own three cards in its own code.
 *
 * WHAT IT DOES AND WHAT IT DOES NOT. It collects up to three choices - which
 * quiz, how many are playing, how hard - and hands them to whoever starts the
 * game. Rules, question selection and scoring are none of its business.
 *
 * EVERY STEP THAT HAS ONE OPTION FALLS AWAY. A choice with a single entry is
 * not a choice but a hurdle in front of the start: a device with one quiz shows
 * no quiz cards, one that plays solo asks nothing about the number of players,
 * and a quiz without a difficulty choice shows no levels.
 *
 * TWO COLUMNS, AND WHY:
 *
 *   On the left is WHAT THIS IS - brand mark and title. It never changes and is
 *   not touched; it is the poster that works from five metres away.
 *
 *   On the right is WHAT TO DO - the steps in the order in which decisions are
 *   made, and the start button below them. It is touched and therefore sits
 *   together, within reach.
 *
 * The design behind this is `Quiz_Standalone_Startmenu_SVG_Assets` together
 * with the media table's own screen; measurements and colours come from there
 * (colours via the palette's `--start-*` tokens). In the portrait setup the
 * column split falls away - see the stylesheet.
 */
import { useState } from 'react'
import type { PlayerCount, StartMenuModel, StartMenuOffer } from '@hfroemmel/quiz-core'
import { textFor, type TextKey } from '../presentation/texts'
import { ArrowIcon, CheckIcon, PeopleIcon, PersonIcon, SlidersIcon } from './icons'
import styles from './Game.module.css'

/**
 * The quiz motif the board carries when the content brings no start image of
 * its own. Addressed in a bundler-neutral way - the same spelling as in the
 * stage package, so the file ships along and is available offline.
 */
const quizMark = new URL('../assets/quiz-mark.svg', import.meta.url).href

/** What a start needs: one offer, a player count, and a level where there is one. */
export interface StartMenuChoice {
  quizId?: string
  audienceId?: string
  playerCount: PlayerCount
  presetId?: string
}

export interface StartMenuProps {
  /** The menu as data - from `deriveStartMenu`. */
  model: StartMenuModel
  /**
   * The interface texts the CONTENT overrides, as the projection resolves them.
   *
   * Where it says nothing, the package's own set for the menu's language
   * applies - it speaks German and English itself. Which of the two is a
   * question of the running game, and the model carries the answer
   * (`model.locale`).
   */
  texts?: Record<string, string> | undefined
  /** The board on the left: the content's start image and its title. */
  brand?: { visualUrl?: string | undefined; title?: string | undefined } | undefined
  /**
   * A sentence that belongs under the steps - a rejected start, for instance.
   *
   * The menu says by itself why an offer cannot be started right now; this is
   * for what only the host knows.
   */
  notice?: string | undefined
  /**
   * Whether a start is possible at all right now - the host's word.
   *
   * The menu decides on its own whether the CHOSEN offer can be started; that
   * a game may be started at this moment is something only whoever holds the
   * connection knows (`allowedCommands`). Without the property the menu
   * assumes yes.
   */
  canStart?: boolean | undefined
  onStart(choice: StartMenuChoice): void
  /** Change the language. The switcher only appears when there is more than one. */
  onSelectLocale(locale: string): void
  /** Open the device's settings - only set where they exist. */
  onOpenSettings?: (() => void) | undefined
  /** Only set when the quiz is a guest inside another application. */
  onExit?: (() => void) | undefined
}

/** One offer, one key: a quiz type where there is one, otherwise the audience. */
export function offerKey(offer: StartMenuOffer): string {
  return offer.quizId ?? offer.audienceId ?? ''
}

/** The level a fresh choice starts with - the configured default. */
function defaultPresetOf(offer: StartMenuOffer | undefined): string | undefined {
  const difficulties = offer?.difficulties
  if (!difficulties || difficulties.length === 0) return undefined
  return (difficulties.find((entry) => entry.isDefault) ?? difficulties[0]!).presetId
}

export function StartMenu({
  model,
  texts,
  brand,
  notice,
  canStart: allowed = true,
  onStart,
  onSelectLocale,
  onOpenSettings,
  onExit,
}: StartMenuProps) {
  const t = (key: TextKey, values?: Record<string, string | number>) =>
    textFor({ texts, locale: model.locale }, key, values)

  /*
   * ONE STATE FOR THE WHOLE CHOICE.
   *
   * The level belongs to the chosen offer - two quizzes can have entirely
   * different ones. Kept separately, a level of the previous offer would
   * survive a change of quiz, and the start would be refused with a level that
   * is not even on screen. It is therefore re-decided together with the offer.
   */
  const [choice, setChoice] = useState(() => {
    const preselected = model.offers.find((offer) => offerKey(offer) === (model.preselect?.quizId ?? model.preselect?.audienceId))
    const offer = preselected ?? model.offers[0]
    return {
      offer: offer === undefined ? '' : offerKey(offer),
      playerCount: model.preselect?.playerCount ?? model.playModes[0]?.playerCount ?? 1,
      presetId: defaultPresetOf(offer),
    }
  })

  const offer = model.offers.find((entry) => offerKey(entry) === choice.offer) ?? model.offers[0]
  /*
   * A step appears where there is something to choose. The offers of a device
   * with one quiz are settled, and so is the level of a quiz that keeps one -
   * it is still sent, it is just not asked about.
   */
  const showOffers = model.offers.length > 1
  const showModes = model.playModes.length > 1
  const difficulties = offer?.difficulties ?? []
  const showDifficulty = difficulties.length > 1

  const unavailable = offer !== undefined && !offer.available
  const reason = offer?.unavailableReason
  const notices = [
    ...(reason === undefined ? [] : [t(`start.rejected.${reason}` as TextKey)]),
    ...(notice === undefined || notice === '' ? [] : [notice]),
  ]
  const canStart = allowed && offer !== undefined && !unavailable

  const chooseOffer = (entry: StartMenuOffer) =>
    setChoice((before) => ({ ...before, offer: offerKey(entry), presetId: defaultPresetOf(entry) }))

  return (
    <div className={styles.start} data-game-start="" data-quiz-start="">
      {/*
        * THE TWO CORNER BUTTONS SIT IN THEIR OWN ROW and not freely floating
        * over the area: positioned absolutely as corners, they got in the way
        * of the board beneath them as soon as the quiz ran in a box smaller
        * than the whole window - exactly the case in a game collection.
        */}
      <div className={styles.corners}>
        {/*
          * THE LANGUAGE SWITCHER SITS IN THE CORNER, not as a step of its own:
          * the selection next to it asks what is to be played. The language is
          * not a game decision but the precondition for being able to read the
          * questions at all; it therefore belongs where one looks for it
          * before reading.
          *
          * The names are shown in their OWN language ("Deutsch", "English") -
          * that means no label next to it is needed.
          */}
        {model.locales.length > 1 && (
          <div className={styles.languages} data-languages="">
            {model.locales.map((locale) => (
              <button
                key={locale.id}
                type="button"
                className={`${styles.language} ${locale.id === model.locale ? styles.languageOn : ''}`}
                data-locale={locale.id}
                aria-pressed={locale.id === model.locale}
                onClick={() => onSelectLocale(locale.id)}
              >
                {locale.label}
              </button>
            ))}
          </div>
        )}

        {/*
          * Settings in the corner: visible to whoever is looking for them,
          * inconspicuous to everyone else.
          */}
        {onOpenSettings && (
          <button
            type="button"
            className={styles.settingsButton}
            data-settings-open=""
            aria-label={t('kiosk.settings')}
            onClick={onOpenSettings}
          >
            <SlidersIcon className={styles.settingsIcon} />
          </button>
        )}
      </div>

      <div className={styles.layout} data-quiz-start-content="">
        <aside className={styles.brand}>
          {/*
            * The board's image comes from the content when it brings one - a
            * setup with its own motif should see its own, not ours. Only when
            * none is provided does the board carry the bundled quiz motif.
            */}
          <img className={styles.brandVisual} src={brand?.visualUrl ?? quizMark} alt="" />
          <h2 className={styles.brandText}>{t('kiosk.setupTitle')}</h2>
          <p className={styles.brandTextSubtitle}>{t('kiosk.setupSubtitle')}</p>
        </aside>

        <section className={styles.setup}>
          {showOffers && (
            <section className={styles.step}>
              <div className={styles.offers} role="group" aria-label={t('kiosk.quizChoice')} data-quiz-offers="">
                {model.offers.map((entry) => {
                  const key = offerKey(entry)
                  const chosen = offer !== undefined && offerKey(offer) === key
                  return (
                    <button
                      key={key}
                      type="button"
                      className={`${styles.card} ${styles.offer} ${chosen ? styles.cardOn : ''}`}
                      data-quiz-card={key}
                      data-quiz-option={key}
                      data-emphasis={entry.emphasis}
                      data-available={String(entry.available)}
                      aria-pressed={chosen}
                      onClick={() => chooseOffer(entry)}
                    >
                      {/*
                        * THE MOTIF IS THE CARD'S FACE where the content brings
                        * one. It is not decoration: at the table people
                        * recognise the quiz by its picture before they read its
                        * name.
                        */}
                      {entry.artworkUrl && <img className={styles.offerArtwork} src={entry.artworkUrl} alt="" />}
                      <span className={styles.cardBody}>
                        <span className={styles.cardTitle}>{entry.label}</span>
                        {entry.subtitle && <span className={styles.cardMeta}>{entry.subtitle}</span>}
                      </span>
                      <Check activeEntry={chosen} />
                    </button>
                  )
                })}
              </div>
            </section>
          )}

          {showModes && (
            <section className={styles.step}>
              <div className={styles.modes} role="group" aria-label={t('kiosk.playerCount')} data-play-modes="">
                {model.playModes.map((mode) => {
                  const chosen = choice.playerCount === mode.playerCount
                  const solo = mode.playerCount === 1
                  return (
                    <button
                      key={mode.playerCount}
                      type="button"
                      className={`${styles.card} ${styles.mode} ${chosen ? styles.cardOn : ''}`}
                      data-player-count={mode.playerCount}
                      data-play-mode={solo ? 'single' : 'duel'}
                      data-mode-option={solo ? 'single' : 'duel'}
                      aria-pressed={chosen}
                      onClick={() => setChoice((before) => ({ ...before, playerCount: mode.playerCount }))}
                    >
                      <span className={styles.cardIcon} aria-hidden="true">
                        {solo ? <PersonIcon /> : <PeopleIcon />}
                      </span>
                      <span className={styles.cardBody}>
                        {/*
                          * The wording of a mode comes from the package where it
                          * states one; otherwise the interface keeps its own.
                          */}
                        <span className={styles.cardTitle}>{mode.label ?? t(mode.textKey as TextKey)}</span>
                        <span className={styles.cardMeta}>{t(solo ? 'kiosk.soloHint' : 'kiosk.duoHint')}</span>
                      </span>
                      <Check activeEntry={chosen} />
                    </button>
                  )
                })}
              </div>
            </section>
          )}

          {showDifficulty && (
            <section className={styles.step}>
              <div
                className={styles.levels}
                role="group"
                aria-label={t('kiosk.difficulty')}
                data-preset-options=""
                data-difficulty-choice=""
              >
                {difficulties.map((entry) => {
                  const chosen = choice.presetId === entry.presetId
                  return (
                    <button
                      key={entry.presetId}
                      type="button"
                      className={`${styles.card} ${styles.level} ${chosen ? styles.cardOn : ''}`}
                      data-preset={entry.presetId}
                      aria-pressed={chosen}
                      onClick={() => setChoice((before) => ({ ...before, presetId: entry.presetId }))}
                    >
                      {/*
                        * THE SAME STRUCTURE AS THE MODE CARD, just without an
                        * icon: text on the left, checkmark on the right. The
                        * progression of the tiers used to additionally sit above
                        * it as a row of dots - it said nothing that the name did
                        * not already say, and turned two equally-ranked rows into
                        * two of different heights.
                        */}
                      <span className={styles.cardBody}>
                        <span className={styles.cardTitle}>{entry.label}</span>
                        {/*
                          * How long the round is - the only thing about a level
                          * that is certain before the game. The rounds of a
                          * setup differ in length just as often as in
                          * difficulty.
                          */}
                        {entry.slotCount !== undefined && (
                          <span className={styles.cardMeta}>{t('kiosk.questionCount', { count: entry.slotCount })}</span>
                        )}
                      </span>
                      <Check activeEntry={chosen} />
                    </button>
                  )
                })}
              </div>
            </section>
          )}

          {/*
            * WHY THE SENTENCE SITS HERE, under the steps and over the button: a
            * quiz whose questions are not written yet cannot be started, and the
            * reason belongs where the touch happened. It takes no room while
            * there is nothing to say - and it stands BEFORE the attempt, so
            * nobody presses a button that cannot work.
            */}
          {notices.length > 0 && (
            <p className={styles.startNotice} role="status" data-quiz-start-notice="">
              {notices.join(' ')}
            </p>
          )}

          <div className={styles.actions}>
            <button
              type="button"
              className={styles.action}
              data-start=""
              data-quiz-start-action=""
              disabled={!canStart}
              onClick={() =>
                offer &&
                onStart({
                  ...(offer.quizId === undefined ? {} : { quizId: offer.quizId }),
                  ...(offer.audienceId === undefined ? {} : { audienceId: offer.audienceId }),
                  playerCount: choice.playerCount,
                  ...(choice.presetId === undefined ? {} : { presetId: choice.presetId }),
                })
              }
            >
              {t('kiosk.start')}
              <span className={styles.actionArrow} aria-hidden="true">
                <ArrowIcon />
              </span>
            </button>
            {onExit && (
              <button type="button" className={styles.actionSecondary} onClick={onExit}>
                {t('kiosk.back')}
              </button>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}

/**
 * The checkmark of a selected card.
 *
 * It is ALWAYS in the markup, even unselected - then empty. That way the
 * card stays the same size, instead of jumping by the width of a character
 * when tapped, exactly under the finger that tapped it.
 */
function Check({ activeEntry }: { activeEntry: boolean }) {
  return (
    <span className={styles.check} data-on={String(activeEntry)} aria-hidden="true">
      {activeEntry && <CheckIcon />}
    </span>
  )
}
