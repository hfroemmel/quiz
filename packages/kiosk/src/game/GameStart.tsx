/**
 * Startauswahl am Geraet.
 *
 * Zwei Entscheidungen, mehr nicht: Wie viele spielen, und wie schwer soll es sein.
 * Die Zielgruppe wird NICHT am Geraet gewaehlt - sie gehoert zur Aufstellung und
 * kommt als Vorgabe herein. Ein Foyergeraet, an dem jemand versehentlich die
 * Kinderwelt einstellt, waere ein Betriebsfehler ohne Bedienung davor.
 *
 * Die Schwierigkeitsstufen stammen aus `view.catalog` und damit aus validierter
 * Konfiguration. Es gibt hier bewusst keine Liste im Code, die beim naechsten
 * neuen Preset vergessen wuerde.
 */
import { useState } from 'react'
import { playerCounts as alleSpielerzahlen, type PlayerCount, type PlayerQuizViewModel } from '@hfroemmel/quiz-core'
import styles from './Game.module.css'

interface GameStartProps {
  view: PlayerQuizViewModel
  /** Zielgruppe, in der dieses Geraet spielt. */
  audience: string
  /**
   * Spielerzahlen, die dieses Geraet anbietet. Ohne Angabe beide.
   *
   * Bleibt nur eine uebrig, entfaellt die Frage danach ganz: Eine Auswahl mit
   * genau einer Moeglichkeit ist keine Auswahl, sondern eine Huerde vor dem
   * Start.
   */
  playerCounts?: readonly PlayerCount[] | undefined
  onStart(input: { playerCount: PlayerCount; presetId: string }): void
  /** Nur gesetzt, wenn das Quiz Gast einer anderen Anwendung ist. */
  onExit?: (() => void) | undefined
  /**
   * Einstellungen des Geraets oeffnen - nur gesetzt, wo es sie gibt.
   *
   * Sie haengen bewusst HIER und nicht im Spiel: Ton und Groesse gehoeren zur
   * Aufstellung eines Geraets, nicht in die Hand dessen, der gerade spielt.
   */
  onOpenSettings?: (() => void) | undefined
}

export function GameStart({ view, audience, playerCounts, onStart, onExit, onOpenSettings }: GameStartProps) {
  const audienceEntry = view.catalog.audiences.find((entry) => entry.id === audience)
  const presets = view.catalog.presets.filter((preset) => audienceEntry?.allowedPresetIds.includes(preset.id))

  const angeboten = playerCounts && playerCounts.length > 0 ? playerCounts : alleSpielerzahlen
  const [playerCount, setPlayerCount] = useState<PlayerCount>(angeboten[0] ?? 1)
  const [presetId, setPresetId] = useState(presets[0]?.id ?? '')

  const canStart = view.allowedCommands.includes('START_GAME') && presetId !== ''

  return (
    <div className={styles.start} data-game-start="">
      {/*
        * Einstellungen in der Ecke: sichtbar fuer den, der sie sucht,
        * unauffaellig fuer alle anderen.
        *
        * Das Zeichen ist gezeichnet und kein Schriftzeichen: Ein Geraet im
        * Kiosk hat nur die Schriften, die die Anwendung mitbringt, und ein
        * fehlendes Symbolzeichen waere dort ein leeres Kaestchen.
        */}
      {onOpenSettings && (
      <button
        type="button"
        className={styles.settingsButton}
        data-settings-open=""
        aria-label="Einstellungen"
        onClick={onOpenSettings}
      >
        <svg className={styles.settingsIcon} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <g stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="4" y1="8" x2="20" y2="8" />
            <line x1="4" y1="16" x2="20" y2="16" />
          </g>
          <circle cx="9" cy="8" r="3" fill="currentColor" />
          <circle cx="15" cy="16" r="3" fill="currentColor" />
        </svg>
      </button>
      )}

      {view.theme.startVisualUrl && <img className={styles.visual} src={view.theme.startVisualUrl} alt="" />}
      {view.theme.startTitle && <h1 className={styles.title}>{view.theme.startTitle}</h1>}

      {angeboten.length > 1 && (
      <section className={styles.choice}>
        <h2 className={styles.choiceLabel} data-choice-label="">
          Wie viele spielen?
        </h2>
        <div className={styles.options}>
          {angeboten.map((count) => (
            <button
              key={count}
              type="button"
              className={styles.option}
              aria-pressed={playerCount === count}
              onClick={() => setPlayerCount(count)}
            >
              {count === 1 ? 'Allein' : 'Zu zweit'}
            </button>
          ))}
        </div>
      </section>
      )}

      <section className={styles.choice}>
        <h2 className={styles.choiceLabel} data-choice-label="">
          Wie schwer?
        </h2>
        <div className={styles.options} data-preset-options="">
          {presets.map((preset) => (
            <button
              key={preset.id}
              type="button"
              className={styles.option}
              aria-pressed={presetId === preset.id}
              onClick={() => setPresetId(preset.id)}
            >
              {preset.label}
              <span className={styles.hint}>{preset.slotCount} Fragen</span>
            </button>
          ))}
        </div>
      </section>

      <div className={styles.actions}>
        <button type="button" className={styles.go} disabled={!canStart} onClick={() => onStart({ playerCount, presetId })}>
          Los geht&apos;s
        </button>
        {onExit && (
          <button type="button" className={styles.leave} onClick={onExit}>
            Zurück
          </button>
        )}
      </div>
    </div>
  )
}
