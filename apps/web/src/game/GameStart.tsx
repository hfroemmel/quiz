/**
 * Startauswahl am Geraet.
 *
 * Zwei Entscheidungen, mehr nicht: Wie viele spielen, und wie schwer soll es sein.
 * Der Quizmodus wird NICHT am Geraet gewaehlt - er gehoert zur Aufstellung und
 * kommt als Vorgabe herein. Ein Foyergeraet, an dem jemand versehentlich die
 * Kinderwelt einstellt, waere ein Betriebsfehler ohne Bedienung davor.
 *
 * Die Schwierigkeitsstufen stammen aus `view.catalog` und damit aus validierter
 * Konfiguration. Es gibt hier bewusst keine Liste im Code, die beim naechsten
 * neuen Preset vergessen wuerde.
 */
import { useState } from 'react'
import { playerCounts, type PlayerCount, type PlayerQuizViewModel } from '@quiz/contracts'
import styles from './Game.module.css'

interface GameStartProps {
  view: PlayerQuizViewModel
  /** Modus, in dem dieses Geraet spielt. */
  quizModeId: string
  onStart(input: { playerCount: PlayerCount; presetId: string }): void
  /** Nur gesetzt, wenn das Quiz Gast einer anderen Anwendung ist. */
  onExit?: (() => void) | undefined
}

export function GameStart({ view, quizModeId, onStart, onExit }: GameStartProps) {
  const mode = view.catalog.modes.find((entry) => entry.id === quizModeId)
  const presets = view.catalog.presets.filter((preset) => mode?.allowedPresetIds.includes(preset.id))

  const [playerCount, setPlayerCount] = useState<PlayerCount>(1)
  const [presetId, setPresetId] = useState(presets[0]?.id ?? '')

  const canStart = view.allowedCommands.includes('START_GAME') && presetId !== ''

  return (
    <div className={styles.start} data-game-start="">
      {view.theme.startVisualUrl && <img className={styles.visual} src={view.theme.startVisualUrl} alt="" />}
      {view.theme.startTitle && <h1 className={styles.title}>{view.theme.startTitle}</h1>}

      <section className={styles.choice}>
        <h2 className={styles.choiceLabel} data-choice-label="">
          Wie viele spielen?
        </h2>
        <div className={styles.options}>
          {playerCounts.map((count) => (
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
