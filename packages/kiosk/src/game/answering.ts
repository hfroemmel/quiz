/**
 * Who is currently allowed to do what on the touch device?
 *
 * The basic question - which step of the command sequence is currently
 * possible - is answered by the server via `allowedCommands`. What is not
 * stated there is the assignment to ONE player, because the list applies to
 * the game and not per area. That assignment is read here from the view
 * model, not derived from game rules:
 *
 *   `currentPlayer`  is the player the open attempt belongs to - after a
 *                    successful buzz just as much as on the second chance;
 *   `locked`         is set by the server once the attempt has been used up.
 *
 * The server remains authoritative: a tap sent anyway is rejected there.
 * These functions only decide which area looks dimmed.
 */
import type { PlayerId, PlayerQuizViewModel } from '@hfroemmel/quiz-core'

/**
 * Who does the current attempt belong to?
 *
 * The server determines it: after an accepted buzz just as much as on the
 * second chance. In single-player mode there is nobody to signal against -
 * there every question belongs to the one player as soon as the server
 * accepts answers.
 */
export function assignedPlayer(view: PlayerQuizViewModel): PlayerId | null {
  if (view.currentPlayer) return view.currentPlayer
  if (view.playerScores.length === 1) return view.playerScores[0]?.playerId ?? null
  return null
}

/** Is this player allowed to grab the buzz now? */
export function canBuzz(view: PlayerQuizViewModel, playerId: PlayerId): boolean {
  if (!view.allowedCommands.includes('BUZZ')) return false
  const score = view.playerScores.find((entry) => entry.playerId === playerId)
  return Boolean(score && !score.locked)
}

/** Is this player allowed to tap an answer now? */
export function canAnswer(view: PlayerQuizViewModel, playerId: PlayerId): boolean {
  const score = view.playerScores.find((entry) => entry.playerId === playerId)
  if (!score || score.locked) return false

  // An open attempt accepts answers - but only from its owner.
  if (view.allowedCommands.includes('LOG_OPTION_ANSWER')) return view.currentPlayer === playerId

  // Single-player: buzz and logging happen in the same tap.
  return view.playerScores.length === 1 && view.allowedCommands.includes('BUZZ')
}
