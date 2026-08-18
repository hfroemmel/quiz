/**
 * Punktestaende beider Spieler.
 *
 * Reines Anzeigebauteil: Die Werte kommen aus dem Server-Snapshot. Es wird hier
 * niemals gerechnet - Scoring existiert ausschliesslich in der Domain-Engine.
 */
import type { PublicScore } from '@quiz/contracts'

export function ScoreBoard({ scores, compact = false }: { scores: PublicScore[]; compact?: boolean }) {
  if (scores.length === 0) return null
  return (
    <div className={`scoreboard ${compact ? 'scoreboard--compact' : ''}`}>
      {scores.map((score) => (
        <div
          key={score.playerId}
          className={[
            'scoreboard__player',
            `scoreboard__player--${score.playerId}`,
            score.active ? 'scoreboard__player--active' : '',
            score.locked ? 'scoreboard__player--locked' : '',
          ]
            .filter(Boolean)
            .join(' ')}
        >
          <span className="scoreboard__label">{score.label}</span>
          <span className="scoreboard__value">{score.score}</span>
          {score.locked && <span className="scoreboard__flag">gesperrt</span>}
        </div>
      ))}
    </div>
  )
}
