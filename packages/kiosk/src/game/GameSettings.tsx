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
import { playCue } from '@hfroemmel/quiz-react'
import { maximalerZoom, minimalerZoom, zoomSchritt } from './zoom'
import styles from './Game.module.css'

interface GameSettingsProps {
  soundEnabled: boolean
  onSoundEnabled(enabled: boolean): void
  zoom: number
  onZoom(zoom: number): void
  onClose(): void
}

export function GameSettings({ soundEnabled, onSoundEnabled, zoom, onZoom, onClose }: GameSettingsProps) {
  return (
    <div className={styles.overlay} data-settings="">
      <div className={styles.panel} role="dialog" aria-label="Einstellungen">
        <h2 className={styles.panelTitle}>Einstellungen</h2>

        <div className={styles.setting}>
          <span className={styles.settingLabel}>Ton</span>
          <div className={styles.settingControl}>
            <button
              type="button"
              className={styles.option}
              data-sound-on=""
              aria-pressed={soundEnabled}
              onClick={() => onSoundEnabled(true)}
            >
              An
            </button>
            <button
              type="button"
              className={styles.option}
              data-sound-off=""
              aria-pressed={!soundEnabled}
              onClick={() => onSoundEnabled(false)}
            >
              Aus
            </button>
          </div>
        </div>

        <div className={styles.setting}>
          <span className={styles.settingLabel}>Tonprobe</span>
          <div className={styles.settingControl}>
            {/*
              * Der Klang kommt hier unabhaengig vom Schalter darueber: Getestet
              * werden Lautsprecher und Lautstaerke des Geraets, und das muss
              * auch dann gehen, wenn das Quiz danach still laufen soll.
              */}
            <button
              type="button"
              className={styles.option}
              data-sound-test=""
              onClick={() => playCue('buzz', { enabled: true, isAudioMaster: true })}
            >
              Ton abspielen
            </button>
          </div>
        </div>

        <div className={styles.setting}>
          <span className={styles.settingLabel}>Größe</span>
          <div className={styles.settingControl}>
            <input
              className={styles.slider}
              type="range"
              data-zoom=""
              min={minimalerZoom}
              max={maximalerZoom}
              step={zoomSchritt}
              value={zoom}
              aria-label="Groesse der Anzeige"
              onChange={(ereignis) => onZoom(Number(ereignis.target.value))}
            />
            <span className={styles.settingValue}>{Math.round(zoom * 100)} %</span>
          </div>
        </div>

        <button type="button" className={styles.go} data-settings-close="" onClick={onClose}>
          Fertig
        </button>
      </div>
    </div>
  )
}
