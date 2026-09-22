/**
 * Device settings - reachable from the start screen.
 *
 * WHY NOT DURING THE GAME: this is a device's setup, not a game action.
 * Whoever is standing in front of it playing should not be able to turn off
 * the sound while the others are listening; whoever sets the device up has
 * access to the start screen.
 *
 * THREE THINGS, NOTHING MORE:
 *   Sound      - disruptive on a device in a foyer next to an event
 *   Sound test - the only way to check speakers and volume without a game
 *   Zoom       - screens range from a tablet to a large touch table
 *
 * All three also exist in the application's config file (see
 * `QuizGameProps`). What is changed here applies until restart; the file is
 * the persistent one.
 *
 * THE TOGGLES ARE THE SAME CARDS as in the start selection (`.card`), just
 * without an icon and smaller: both are this device's controls, and both are
 * seen by the same person.
 */
import { playCue } from '../presentation/soundCues'
import { textsFor } from '../presentation/texts'
import type { PlayerQuizViewModel } from '@hfroemmel/quiz-core'
import { maxZoom, minZoom, zoomStep } from './zoom'
import styles from './Game.module.css'

interface GameSettingsProps {
  /** For the labels: they are shown in the quiz's language. */
  view: PlayerQuizViewModel
  soundEnabled: boolean
  onSoundEnabled(enabled: boolean): void
  zoom: number
  onZoom(zoom: number): void
  onClose(): void
}

export function GameSettings({ view, soundEnabled, onSoundEnabled, zoom, onZoom, onClose }: GameSettingsProps) {
  const t = textsFor(view)
  return (
    <div className={styles.overlay} data-settings="">
      <div className={styles.panel} role="dialog" aria-label={t('kiosk.settings')}>
        <h2 className={styles.panelTitle}>{t('kiosk.settings')}</h2>

        <div className={styles.setting}>
          <span className={styles.settingLabel}>{t('kiosk.sound')}</span>
          <div className={styles.settingControl}>
            <button
              type="button"
              className={`${styles.card} ${styles.toggle} ${soundEnabled ? styles.cardOn : ''}`}
              data-sound-on=""
              aria-pressed={soundEnabled}
              onClick={() => onSoundEnabled(true)}
            >
              {t('kiosk.on')}
            </button>
            <button
              type="button"
              className={`${styles.card} ${styles.toggle} ${soundEnabled ? '' : styles.cardOn}`}
              data-sound-off=""
              aria-pressed={!soundEnabled}
              onClick={() => onSoundEnabled(false)}
            >
              {t('kiosk.off')}
            </button>
          </div>
        </div>

        <div className={styles.setting}>
          <span className={styles.settingLabel}>{t('kiosk.soundTest')}</span>
          <div className={styles.settingControl}>
            {/*
              * The sound here plays independently of the toggle above:
              * speakers and volume of the device are what is being tested,
              * and that has to work even when the quiz should run silently
              * afterwards.
              */}
            <button
              type="button"
              className={`${styles.card} ${styles.toggle}`}
              data-sound-test=""
              onClick={() => playCue('buzz', { enabled: true, isAudioMaster: true })}
            >
              {t('kiosk.playSound')}
            </button>
          </div>
        </div>

        <div className={styles.setting}>
          <span className={styles.settingLabel}>{t('kiosk.size')}</span>
          <div className={styles.settingControl}>
            <input
              className={styles.slider}
              type="range"
              data-zoom=""
              min={minZoom}
              max={maxZoom}
              step={zoomStep}
              value={zoom}
              aria-label={t('kiosk.size')}
              onChange={(event) => onZoom(Number(event.target.value))}
            />
            <span className={styles.settingValue}>{Math.round(zoom * 100)} %</span>
          </div>
        </div>

        <div className={styles.actions}>
          <button type="button" className={styles.action} data-settings-close="" onClick={onClose}>
            {t('kiosk.done')}
          </button>
        </div>
      </div>
    </div>
  )
}
