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
 */
import type { CSSProperties, ReactNode } from 'react'
import type { PublicQuizViewModel } from '@quiz/contracts'
import { Counter } from './Counter.tsx'
import { Score } from './Score.tsx'
import logoUrl from '../../assets/images/logo.svg'
import styles from './StageHeader.module.css'

export interface StageHeaderSlots {
  /** Vor der Karte von Spieler 1 - im Entwurf die Punktekorrektur. */
  beforePlayerOne?: ReactNode
  /** Nach der Karte von Spieler 2. */
  afterPlayerTwo?: ReactNode
}

export function StageHeader({ view, slots }: { view: PublicQuizViewModel; slots?: StageHeaderSlots }) {
  // Die Startansicht hat weder Punktestand noch Zaehler - und keine Korrektur.
  if (view.scene === 'start') return null

  const showsScores = view.scene !== 'result' && view.playerScores.length > 0
  const showsCounter = showsScores && view.progress.total > 0
  const [playerOne, playerTwo] = view.playerScores

  return (
    <header className={styles.header}>
      {/*
        * Wortmarke in der oberen linken Ecke. Sie liegt als Maske ueber einer
        * Farbflaeche: So folgt sie der Textfarbe der Welt, statt als schwarze
        * Grafik auf dunklem Grund zu verschwinden. Eine zweite, weisse Fassung
        * der Datei ist damit nicht noetig.
        */}
      <span
        className={styles.brand}
        data-brand=""
        style={{ '--logo-url': `url(${logoUrl})` } as CSSProperties}
        aria-hidden="true"
      />

      <div className={styles.scores}>
        {slots?.beforePlayerOne}
        {showsScores && playerOne && <Score label={playerOne.label} score={playerOne.score} active={playerOne.active} locked={playerOne.locked} />}
        {showsScores && playerTwo && (
          <Score label={playerTwo.label} score={playerTwo.score} active={playerTwo.active} locked={playerTwo.locked} mirrored />
        )}
        {slots?.afterPlayerTwo}
      </div>

      {showsCounter && (
        <div className={styles.counterSlot}>
          <Counter current={view.progress.current} total={view.progress.total} />
        </div>
      )}
    </header>
  )
}
