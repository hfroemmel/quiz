/** Kleiner Spielerchip mit Farbe des Spielers. Wird von Buehne und Operator genutzt. */
import type { PlayerId, PublicScore } from '@quiz/contracts'

export function PlayerBadge({ scores, playerId }: { scores: PublicScore[]; playerId: PlayerId }) {
  const player = scores.find((score) => score.playerId === playerId)
  if (!player) return null
  return <span className={`player-badge player-badge--${playerId}`}>{player.label}</span>
}
