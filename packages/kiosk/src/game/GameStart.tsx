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
import { texteFuer } from '@hfroemmel/quiz-react'
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
  /** Sprache umstellen. Der Umschalter erscheint nur, wenn es mehr als eine gibt. */
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
  const t = texteFuer(view)
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
        className={`button ${styles.settingsButton}`}
        data-settings-open=""
        aria-label={t('kiosk.settings')}
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

      {/*
        * DER SPRACHUMSCHALTER STEHT IN DER ECKE, nicht als dritte Frage im
        * Bogen: Die Auswahl davor stellt bewusst zwei Fragen - wie viele
        * spielen und wie schwer. Die Sprache ist keine Spielentscheidung,
        * sondern die Voraussetzung dafuer, die beiden Fragen ueberhaupt lesen
        * zu koennen; sie gehoert deshalb dorthin, wo man sie sucht, bevor man
        * liest.
        *
        * Die Namen stehen in ihrer EIGENEN Sprache ("Deutsch", "English") -
        * eine Beschriftung daneben braucht es damit nicht.
        */}
      {view.catalog.locales.length > 1 && (
        <div className={styles.languages} data-languages="">
          {view.catalog.locales.map((sprache) => (
            <button
              key={sprache.id}
              type="button"
              className={`button ${styles.language} ${sprache.id === view.locale ? 'button--selected' : ''}`}
              data-locale={sprache.id}
              aria-pressed={sprache.id === view.locale}
              onClick={() => onSelectLocale(sprache.id)}
            >
              {sprache.label}
            </button>
          ))}
        </div>
      )}

      {view.theme.startVisualUrl && <img className={styles.visual} src={view.theme.startVisualUrl} alt="" />}
      {view.theme.startTitle && <h1 className={styles.title}>{view.theme.startTitle}</h1>}

      {angeboten.length > 1 && (
      <section className={styles.choice}>
        <h2 className={styles.choiceLabel} data-choice-label="">
          {t('kiosk.playerCount')}
        </h2>
        <div className={styles.options}>
          {angeboten.map((count) => (
            <button
              key={count}
              type="button"
              className={`button button--large ${styles.option} ${playerCount === count ? 'button--selected' : ''}`}
              aria-pressed={playerCount === count}
              onClick={() => setPlayerCount(count)}
            >
              {t(count === 1 ? 'kiosk.solo' : 'kiosk.duo')}
            </button>
          ))}
        </div>
      </section>
      )}

      <section className={styles.choice}>
        <h2 className={styles.choiceLabel} data-choice-label="">
          {t('kiosk.difficulty')}
        </h2>
        <div className={styles.options} data-preset-options="">
          {presets.map((preset) => (
            <button
              key={preset.id}
              type="button"
              className={`button button--large ${styles.option} ${presetId === preset.id ? 'button--selected' : ''}`}
              aria-pressed={presetId === preset.id}
              onClick={() => setPresetId(preset.id)}
            >
              {preset.label}
              <span className={styles.hint}>{t('kiosk.questionCount', { count: preset.slotCount })}</span>
            </button>
          ))}
        </div>
      </section>

      <div className={styles.actions}>
        <button
          type="button"
          className={`button button--primary button--large ${styles.go}`}
          disabled={!canStart}
          onClick={() => onStart({ playerCount, presetId })}
        >
          {t('kiosk.start')}
        </button>
        {onExit && (
          <button type="button" className={`button button--large ${styles.leave}`} onClick={onExit}>
            {t('kiosk.back')}
          </button>
        )}
      </div>
    </div>
  )
}
