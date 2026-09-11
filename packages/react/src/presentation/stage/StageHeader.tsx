/**
 * Kopfzeile der Buehnenflaeche - EINE Kopfzeile fuer beide Gestaltungswelten.
 *
 *   [Wortmarke]      [Spieler|1][Punkte|100]  [Punkte|100][Spieler|2]      [Frage|3/7]
 *
 * Die Kopfzeile ist oeffentlich: Der Beamer zeigt Punktestand und Fragezaehler.
 * Die Bedienelemente des Operators (Plus/Minus) gehoeren NICHT zum oeffentlichen
 * Renderpfad; sie kommen als Slots von aussen herein und bleiben im
 * Buehnenfenster leer.
 *
 * In der Ergebnisansicht entfallen Karten und Zaehler - die Werte stehen dort
 * gross in der Szene. Die Slots bleiben an ihrer Stelle, damit die
 * Korrekturtasten des Operators nicht wandern.
 *
 * DAS LOGO IST KONFIGURIERBAR: Steht in der Konfiguration ein `logoAssetId`
 * am Theme, zeigt die Kopfzeile dieses Bild. Ohne Angabe bleibt die
 * mitgelieferte Wortmarke des Bundestages.
 *
 * AM TOUCHGERAET BLEIBT NUR DIE WORTMARKE. Dort stehen Punkte und Zaehler unten
 * bei den Buzzern, weil sie zu der Ecke gehoeren, in der der Spieler steht -
 * dieselben Bauteile, nur an einem anderen Platz (`game/PlayerFoot.tsx`).
 */
import type { CSSProperties, ReactNode } from 'react'
import type { PublicQuizViewModel, PublicScore } from '@hfroemmel/quiz-core'
import { cssUrl } from '../cssUrl'
import { texteFuer } from '../texts'
import { Counter } from './Counter'
import { Score } from './Score'
import eigenesLogo from '../../assets/images/logo.svg'
import styles from './StageHeader.module.css'

export interface StageHeaderSlots {
  /** Vor der Karte von Spieler 1 - im Entwurf die Punktekorrektur. */
  beforePlayerOne?: ReactNode
  /** Nach der Karte von Spieler 2. */
  afterPlayerTwo?: ReactNode
  /**
   * AN der Karte eines Spielers - je Spieler einmal aufgerufen.
   *
   * Der Inhalt liegt in einem eigenen, relativ positionierten Rahmen um die
   * Punktekarte und HINTER ihr. Wer hier etwas absolut positioniert, haengt es
   * an die Karte, ohne die Kopfzeile zu verbreitern oder die Karten zu
   * verschieben - genau das braucht die Jokerkarte des Live-Quiz.
   *
   * Die Kopfzeile selbst weiss nicht, was dort haengt: Sie gibt den Punktestand
   * dieses Spielers weiter und stellt nur den Platz.
   */
  besidePlayer?: (score: PublicScore) => ReactNode
}

export function StageHeader({
  view,
  slots,
  variant,
}: {
  view: PublicQuizViewModel
  slots?: StageHeaderSlots
  variant?: 'stage' | 'preview' | 'touch'
}) {
  // Die Startansicht hat weder Punktestand noch Zaehler - und keine Korrektur.
  if (view.scene === 'start') return null

  const t = texteFuer(view)
  const showsScores = variant !== 'touch' && view.scene !== 'result' && view.playerScores.length > 0
  const showsCounter = showsScores && view.progress.total > 0
  const [playerOne, playerTwo] = view.playerScores

  return (
    <header className={styles.header}>
      {/*
        * Wortmarke in der oberen linken Ecke.
        *
        * ZWEI FASSUNGEN, EINE STELLE: Bringt der Inhalt ein eigenes Logo mit
        * (`themes[].logoAssetId` in der Konfiguration), steht es unveraendert
        * da - es ist die Marke des Veranstalters und darf nicht umgefaerbt
        * werden. Ohne eigenes Logo bleibt die mitgelieferte Wortmarke; sie
        * liegt als Maske ueber einer Farbflaeche und folgt damit der Textfarbe
        * der Welt, statt als schwarze Grafik auf dunklem Grund zu verschwinden.
        */}
      {view.theme.logoUrl ? (
        <img className={styles.brandImage} src={view.theme.logoUrl} data-brand="" alt="" aria-hidden="true" />
      ) : (
        <span
          className={styles.brand}
          data-brand=""
          style={{ '--logo-url': cssUrl(eigenesLogo) } as CSSProperties}
          aria-hidden="true"
        />
      )}

      <div className={styles.scores}>
        {slots?.beforePlayerOne}
        {showsScores && playerOne && (
          <div className={styles.scoreGroup} data-score-group={playerOne.playerId}>
            {slots?.besidePlayer?.(playerOne)}
            <Score
              label={playerOne.label}
              score={playerOne.score}
              active={playerOne.active}
              locked={playerOne.locked}
              playerText={t('stage.player')}
              pointsText={t('stage.points')}
              {...audienceMarkerFor(view, playerOne)}
            />
          </div>
        )}
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

      {showsCounter && (
        <div className={styles.counterSlot}>
          <Counter current={view.progress.current} total={view.progress.total} label={t('stage.question')} />
        </div>
      )}
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
