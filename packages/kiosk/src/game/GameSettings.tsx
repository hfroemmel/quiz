/**
 * Einstellungen des Geraets - erreichbar ueber den Startbildschirm.
 *
 * WARUM NICHT WAEHREND DES SPIELS: Das hier ist die Aufstellung eines Geraets,
 * keine Spielhandlung. Wer davorsteht und spielt, soll den Ton nicht abschalten
 * koennen, waehrend die anderen zuhoeren; wer das Geraet hinstellt, kommt an den
 * Startbildschirm heran.
 *
 * DREI DINGE, MEHR NICHT:
 *   Ton      - an einem Geraet im Foyer neben einer Veranstaltung stoerend
 *   Tonprobe - der einzige Weg, Lautsprecher und Lautstaerke ohne Spiel zu pruefen
 *   Zoom     - die Bildschirme reichen vom Tablet bis zum grossen Touchtisch
 *
 * Alle drei stehen auch im Config File der Anwendung (siehe `QuizGameProps`).
 * Was hier verstellt wird, gilt bis zum Neustart; dauerhaft ist die Datei.
 */
import { playCue, texteFuer } from '@hfroemmel/quiz-react'
import type { PlayerQuizViewModel } from '@hfroemmel/quiz-core'
import { maximalerZoom, minimalerZoom, zoomSchritt } from './zoom'
import styles from './Game.module.css'

interface GameSettingsProps {
  /** Fuer die Beschriftungen: Sie stehen in der Sprache des Quiz. */
  view: PlayerQuizViewModel
  soundEnabled: boolean
  onSoundEnabled(enabled: boolean): void
  zoom: number
  onZoom(zoom: number): void
  onClose(): void
}

export function GameSettings({ view, soundEnabled, onSoundEnabled, zoom, onZoom, onClose }: GameSettingsProps) {
  const t = texteFuer(view)
  return (
    <div className={styles.overlay} data-settings="">
      <div className={styles.panel} role="dialog" aria-label={t('kiosk.settings')}>
        <h2 className={styles.panelTitle}>{t('kiosk.settings')}</h2>

        <div className={styles.setting}>
          <span className={styles.settingLabel}>{t('kiosk.sound')}</span>
          <div className={styles.settingControl}>
            <button
              type="button"
              className={`button ${styles.option} ${soundEnabled ? 'button--selected' : ''}`}
              data-sound-on=""
              aria-pressed={soundEnabled}
              onClick={() => onSoundEnabled(true)}
            >
              {t('kiosk.on')}
            </button>
            <button
              type="button"
              className={`button ${styles.option} ${soundEnabled ? '' : 'button--selected'}`}
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
              * Der Klang kommt hier unabhaengig vom Schalter darueber: Getestet
              * werden Lautsprecher und Lautstaerke des Geraets, und das muss
              * auch dann gehen, wenn das Quiz danach still laufen soll.
              */}
            <button
              type="button"
              className={`button ${styles.option}`}
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
              min={minimalerZoom}
              max={maximalerZoom}
              step={zoomSchritt}
              value={zoom}
              aria-label={t('kiosk.size')}
              onChange={(ereignis) => onZoom(Number(ereignis.target.value))}
            />
            <span className={styles.settingValue}>{Math.round(zoom * 100)} %</span>
          </div>
        </div>

        <button
          type="button"
          className={`button button--primary button--large ${styles.go}`}
          data-settings-close=""
          onClick={onClose}
        >
          {t('kiosk.done')}
        </button>
      </div>
    </div>
  )
}
