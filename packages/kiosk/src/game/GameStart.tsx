/**
 * Start selection on the device.
 *
 * Two decisions, nothing more: how many are playing, and how hard it should
 * be. The audience is NOT chosen on the device - it belongs to the setup and
 * comes in as a default. A foyer device where someone accidentally sets the
 * kids' world would be an operating mistake with no control for it.
 *
 * The difficulty tiers come from `view.catalog` and thus from validated
 * configuration. There is deliberately no list in the code here that would be
 * forgotten with the next new preset.
 *
 * TWO COLUMNS, AND WHY:
 *
 *   On the left is WHAT this is - brand mark, title, a sentence about it. It
 *   never changes and is not touched; it is the poster that works from five
 *   metres away and draws someone in.
 *
 *   On the right is WHAT TO DO - two numbered steps and the start button
 *   below them. It is touched and therefore sits together, within reach and
 *   in the order in which decisions are made.
 *
 * The design behind this is `Quiz_Standalone_Startmenu_SVG_Assets`;
 * measurements and colours come from there (colours via the palette's
 * `--start-*` tokens). In the portrait setup, the column split falls away -
 * see the stylesheet.
 */
import { useState } from 'react'
import { playerCounts as alleSpielerzahlen, type PlayerCount, type PlayerQuizViewModel } from '@hfroemmel/quiz-core'
import { textsFor } from '@hfroemmel/quiz-react'
import { ArrowIcon, CheckIcon, PeopleIcon, PersonIcon, SlidersIcon } from './icons'
import styles from './Game.module.css'

/**
 * The quiz motif the board carries when the content brings no start image of
 * its own. Addressed in a bundler-neutral way - the same spelling as in the
 * stage package, so the file ships along and is available offline.
 */
const quizMarke = new URL('../assets/quiz-mark.svg', import.meta.url).href

interface GameStartProps {
  view: PlayerQuizViewModel
  /** Audience this device plays in. */
  audience: string
  /**
   * Player counts this device offers. Without one, both.
   *
   * If only one remains, the question about it falls away entirely: a choice
   * with exactly one option is not a choice but a hurdle before the start.
   */
  playerCounts?: readonly PlayerCount[] | undefined
  onStart(input: { playerCount: PlayerCount; presetId: string }): void
  /** Only set when the quiz is a guest inside another application. */
  onExit?: (() => void) | undefined
  /**
   * Open the device's settings - only set where they exist.
   *
   * They deliberately live HERE and not in the game: sound and size belong
   * to a device's setup, not in the hands of whoever is currently playing.
   */
  onOpenSettings?: (() => void) | undefined
  /** Change the language. The switcher only appears when there is more than one. */
  onSelectLocale(locale: string): void
}

export function GameStart({
  view,
  audience,
  playerCounts,
  onStart,
  onExit,
  onOpenSettings,
  onSelectLocale,
}: GameStartProps) {
  const t = textsFor(view)
  const audienceEntry = view.catalog.audiences.find((entry) => entry.id === audience)
  const presets = view.catalog.presets.filter((preset) => audienceEntry?.allowedPresetIds.includes(preset.id))

  const offered = playerCounts && playerCounts.length > 0 ? playerCounts : alleSpielerzahlen
  const [playerCount, setPlayerCount] = useState<PlayerCount>(offered[0] ?? 1)
  const [presetId, setPresetId] = useState(presets[0]?.id ?? '')

  const canStart = view.allowedCommands.includes('START_GAME') && presetId !== ''
  /*
   * The mode question falls away on devices with only one player count -
   * there is nothing to choose there.
   */
  const showMode = offered.length > 1

  return (
    <div className={styles.start} data-game-start="">
      {/*
        * THE TWO CORNER BUTTONS SIT IN THEIR OWN ROW and not freely floating
        * over the area: positioned absolutely as corners, they got in the way
        * of the board beneath them as soon as the quiz ran in a box smaller
        * than the whole window - exactly the case in a game collection.
        */}
      <div className={styles.corners}>
        {/*
          * THE LANGUAGE SWITCHER SITS IN THE CORNER, not as a third step: the
          * selection next to it deliberately asks two questions - how many are
          * playing and how hard. The language is not a game decision but the
          * precondition for being able to read the two questions at all; it
          * therefore belongs where one looks for it before reading.
          *
          * The names are shown in their OWN language ("Deutsch", "English") -
          * that means no label next to it is needed.
          */}
        {view.catalog.locales.length > 1 && (
          <div className={styles.languages} data-languages="">
            {view.catalog.locales.map((locale) => (
              <button
                key={locale.id}
                type="button"
                className={`${styles.language} ${locale.id === view.locale ? styles.languageOn : ''}`}
                data-locale={locale.id}
                aria-pressed={locale.id === view.locale}
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

      <div className={styles.layout}>
        <aside className={styles.brand}>
          {/*
            * The board's image comes from the content when it brings one - a
            * setup with its own motif should see its own, not ours. Only when
            * none is provided does the board carry the bundled quiz motif.
            */}
          <img className={styles.brandVisual} src={view.theme.startVisualUrl ?? quizMarke} alt="" />

          <div className={styles.brandText}>
            {view.theme.startTitle && <h1 className={styles.brandTitle}>{view.theme.startTitle}</h1>}
          </div>
        </aside>

        <section className={styles.setup}>
          <h2 className={styles.setupTitle}>{t('kiosk.setupTitle')}</h2>
          <p className={styles.setupSubtitle}>{t('kiosk.setupSubtitle')}</p>

          {showMode && (
            <section className={styles.step}>
              <div className={styles.modes}>
                {offered.map((count) => (
                  <button
                    key={count}
                    type="button"
                    className={`${styles.card} ${styles.mode} ${playerCount === count ? styles.cardOn : ''}`}
                    data-player-count={count}
                    aria-pressed={playerCount === count}
                    onClick={() => setPlayerCount(count)}
                  >
                    <span className={styles.cardIcon} aria-hidden="true">
                      {count === 1 ? <PersonIcon /> : <PeopleIcon />}
                    </span>
                    <span className={styles.cardBody}>
                      <span className={styles.cardTitle}>{t(count === 1 ? 'kiosk.solo' : 'kiosk.duo')}</span>
                      <span className={styles.cardMeta}>{t(count === 1 ? 'kiosk.soloHint' : 'kiosk.duoHint')}</span>
                    </span>
                    <Check activeEntry={playerCount === count} />
                  </button>
                ))}
              </div>
            </section>
          )}

          <section className={styles.step}>
            <div className={styles.levels} data-preset-options="">
              {presets.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  className={`${styles.card} ${styles.level} ${presetId === preset.id ? styles.cardOn : ''}`}
                  data-preset={preset.id}
                  aria-pressed={presetId === preset.id}
                  onClick={() => setPresetId(preset.id)}
                >
                  {/*
                    * THE SAME STRUCTURE AS THE MODE CARD, just without an
                    * icon: text on the left, checkmark on the right. The
                    * progression of the tiers used to additionally sit above
                    * it as a row of dots - it said nothing that "5 questions"
                    * did not already say, and turned two equally-ranked rows
                    * into two of different heights.
                    */}
                  <span className={styles.cardBody}>
                    <span className={styles.cardTitle}>{preset.label}</span>
                    <span className={styles.cardMeta}>{t('kiosk.questionCount', { count: preset.slotCount })}</span>
                  </span>
                  <Check activeEntry={presetId === preset.id} />
                </button>
              ))}
            </div>
          </section>

          <div className={styles.actions}>
            <button
              type="button"
              className={styles.action}
              data-start=""
              disabled={!canStart}
              onClick={() => onStart({ playerCount, presetId })}
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
