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
 *
 * ZWEI SPALTEN, UND WARUM:
 *
 *   Links steht, WAS das hier ist - Marke, Titel, ein Satz dazu. Sie aendert
 *   sich nie und wird nicht angefasst; sie ist das Plakat, das aus fuenf Metern
 *   wirkt und jemanden herholt.
 *
 *   Rechts steht, WAS ZU TUN IST - zwei nummerierte Schritte und darunter der
 *   Start. Sie wird angefasst und liegt deshalb beisammen, in Griffhoehe und in
 *   der Reihenfolge, in der entschieden wird.
 *
 * Der Entwurf dazu ist `Quiz_Standalone_Startmenu_SVG_Assets`; Masse und Farben
 * stammen von dort (Farben ueber die `--start-*`-Token der Palette). In der
 * Hochkantaufstellung faellt die Spaltenteilung weg - siehe Stylesheet.
 */
import { useState } from 'react'
import { playerCounts as alleSpielerzahlen, type PlayerCount, type PlayerQuizViewModel } from '@hfroemmel/quiz-core'
import { texteFuer } from '@hfroemmel/quiz-react'
import { ArrowIcon, CheckIcon, PeopleIcon, PersonIcon, SlidersIcon } from './icons'
import styles from './Game.module.css'

/**
 * Das Quizmotiv, das die Tafel traegt, wenn der Inhalt kein eigenes Startbild
 * mitbringt. Bundlerneutral adressiert - dieselbe Schreibweise wie im
 * Buehnenpaket, damit die Datei mit ausgeliefert wird und offline daliegt.
 */
const quizMarke = new URL('../assets/quiz-mark.svg', import.meta.url).href

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
  /*
   * Die Modusfrage entfaellt an Geraeten mit nur einer Spielerzahl - dort gibt
   * es nichts zu waehlen.
   */
  const zeigeModus = angeboten.length > 1

  return (
    <div className={styles.start} data-game-start="">
      {/*
        * DIE BEIDEN ECKKNOEPFE STEHEN IN EINER EIGENEN ZEILE und nicht frei
        * ueber der Flaeche: Als absolut gesetzte Ecken kamen sie der Tafel
        * darunter in die Quere, sobald das Quiz in einem kleineren Kasten lief
        * als dem ganzen Fenster - genau der Fall in der Spielesammlung.
        */}
      <div className={styles.corners}>
        {/*
          * DER SPRACHUMSCHALTER STEHT IN DER ECKE, nicht als dritter Schritt:
          * Die Auswahl daneben stellt bewusst zwei Fragen - wie viele spielen
          * und wie schwer. Die Sprache ist keine Spielentscheidung, sondern die
          * Voraussetzung dafuer, die beiden Fragen ueberhaupt lesen zu koennen;
          * sie gehoert deshalb dorthin, wo man sie sucht, bevor man liest.
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
                className={`${styles.language} ${sprache.id === view.locale ? styles.languageOn : ''}`}
                data-locale={sprache.id}
                aria-pressed={sprache.id === view.locale}
                onClick={() => onSelectLocale(sprache.id)}
              >
                {sprache.label}
              </button>
            ))}
          </div>
        )}

        {/*
          * Einstellungen in der Ecke: sichtbar fuer den, der sie sucht,
          * unauffaellig fuer alle anderen.
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
            * Das Bild der Tafel kommt aus dem Inhalt, wenn er eines mitbringt -
            * eine Aufstellung mit eigenem Motiv soll ihres sehen und nicht
            * unseres. Erst wenn keines hinterlegt ist, traegt die Tafel das
            * mitgelieferte Quizmotiv.
            */}
          <img className={styles.brandVisual} src={view.theme.startVisualUrl ?? quizMarke} alt="" />

          <div className={styles.brandText}>
            {view.theme.startTitle && <h1 className={styles.brandTitle}>{view.theme.startTitle}</h1>}
          </div>
        </aside>

        <section className={styles.setup}>
          <h2 className={styles.setupTitle}>{t('kiosk.setupTitle')}</h2>
          <p className={styles.setupSubtitle}>{t('kiosk.setupSubtitle')}</p>

          {zeigeModus && (
            <section className={styles.step}>
              <div className={styles.modes}>
                {angeboten.map((count) => (
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
                    <Haken aktiv={playerCount === count} />
                  </button>
                ))}
              </div>
            </section>
          )}

          <section className={styles.step}>
            <div className={styles.levels} data-preset-options="">
              {presets.map((preset, stelle) => (
                <button
                  key={preset.id}
                  type="button"
                  className={`${styles.card} ${styles.level} ${presetId === preset.id ? styles.cardOn : ''}`}
                  data-preset={preset.id}
                  aria-pressed={presetId === preset.id}
                  onClick={() => setPresetId(preset.id)}
                >
                  {/*
                    * Die Punkte sind die Stufe als Bild: einer, zwei, drei. Sie
                    * zaehlen die STELLE in der Liste und nicht eine Eigenschaft
                    * der Fragen - die Reihenfolge der Presets IST die Steigerung,
                    * und sie steht in der Konfiguration.
                    */}
                  <span className={styles.levelDots} data-rank={stelle + 1} aria-hidden="true">
                    {Array.from({ length: Math.min(stelle + 1, 5) }, (_, punkt) => (
                      <span key={punkt} className={styles.levelDot} />
                    ))}
                  </span>
                  <Haken aktiv={presetId === preset.id} klein />
                  <span className={styles.cardTitle}>{preset.label}</span>
                  <span className={styles.cardMeta}>{t('kiosk.questionCount', { count: preset.slotCount })}</span>
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
 * Das Haekchen einer gewaehlten Karte.
 *
 * Es steht IMMER im Markup, auch ungewaehlt - dann leer. So bleibt die Karte
 * gleich gross, statt beim Antippen um die Breite eines Zeichens zu springen,
 * und zwar genau unter dem Finger, der es angetippt hat.
 */
function Haken({ aktiv, klein = false }: { aktiv: boolean; klein?: boolean }) {
  return (
    <span className={`${styles.check} ${klein ? styles.checkSmall : ''}`} data-on={String(aktiv)} aria-hidden="true">
      {aktiv && <CheckIcon />}
    </span>
  )
}
