/**
 * Kopfzeile der Buehnenflaeche (Designergaenzung, `docs/screens.md`).
 *
 * Aufbau - die beiden Spielergruppen sind GESPIEGELT:
 *
 *   [Spieler|1][Punkte|100]   [Punkte|100][Spieler|2]        [Frage|3/7]
 *
 * Die Kopfzeile ist oeffentlich: Der Beamer zeigt Punktestand und Fragezaehler.
 * Die Bedienelemente des Operators (Plus/Minus) gehoeren NICHT zum oeffentlichen
 * Renderpfad; sie kommen als Slots von aussen herein und bleiben im
 * Buehnenfenster leer.
 *
 * In der Ergebnisansicht entfallen Kacheln und Zaehler - die Werte stehen dort
 * gross in der Szene. Die Slots bleiben an ihrer Stelle, damit die
 * Korrekturtasten des Operators nicht wandern.
 */
import type { ReactNode } from 'react'
import type { PublicQuizViewModel } from '@quiz/contracts'
import { ScoreTile } from './ScoreTile.tsx'
import { Tile } from './ui/Tile.tsx'

export interface StageHeaderSlots {
  /** Vor der Gruppe von Spieler 1 - im Entwurf die Punktekorrektur. */
  beforePlayerOne?: ReactNode
  /** Nach der Gruppe von Spieler 2. */
  afterPlayerTwo?: ReactNode
}

interface StageHeaderProps {
  view: PublicQuizViewModel
  slots?: StageHeaderSlots
}

export function StageHeader({ view, slots }: StageHeaderProps) {
  // Die Startansicht hat weder Punktestand noch Zaehler - und keine Korrektur.
  if (view.scene === 'start') return null

  const showsTiles = view.scene !== 'result' && view.playerScores.length > 0
  const showsProgress = showsTiles && view.progress.total > 0
  const [playerOne, playerTwo] = view.playerScores

  return (
    <header className="stage-header">
      <div className="stage-header__group">
        {slots?.beforePlayerOne}
        {showsTiles && playerOne && (
          <div className="stage-header__player">
            <Tile label="Spieler" value={playerOne.label.replace(/\D+/g, '') || '1'} tone={tone(playerOne)} />
            <ScoreTile score={playerOne.score} />
          </div>
        )}
        {showsTiles && playerTwo && (
          // Gespiegelt: erst die Punkte, dann der Spieler.
          <div className="stage-header__player stage-header__player--mirrored">
            <ScoreTile score={playerTwo.score} />
            <Tile label="Spieler" value={playerTwo.label.replace(/\D+/g, '') || '2'} tone={tone(playerTwo)} />
          </div>
        )}
        {slots?.afterPlayerTwo}
      </div>

      {showsProgress && (
        <Tile
          label="Frage"
          value={`${Math.min(view.progress.current, view.progress.total)}/${view.progress.total}`}
          className="stage-header__progress"
        />
      )}
    </header>
  )
}

/** Aktiv ist der Spieler am Zug; gesperrt bleibt sichtbar, aber zurueckgenommen. */
function tone(score: { active: boolean; locked: boolean }) {
  if (score.active) return 'active' as const
  if (score.locked) return 'quiet' as const
  return 'default' as const
}
