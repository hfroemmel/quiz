/**
 * Oeffentliche Oberflaeche der Clientanbindung.
 *
 * Sie transportiert Befehle zum Server und Snapshots zurueck - und sonst nichts.
 * Spielregeln stehen in `@quiz/domain`, was ein Client tun darf in
 * `allowedCommands` des View-Modells.
 */
export {
  useQuizConnection,
  type QuizConnection,
  type Rejection,
  type OperatorConnection,
  type ModeratorConnection,
  type StageConnection,
  type PlayerConnection,
} from './useQuizConnection.ts'
