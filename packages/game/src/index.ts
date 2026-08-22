/**
 * Oeffentliche Oberflaeche des Spielpakets.
 *
 * Ein Gastgeber bindet genau zwei Dinge ein:
 *
 *   import { QuizGame } from '@quiz/game'
 *   import '@quiz/game/styles.css'
 *
 * Alles andere - Verbindung, Szenen, Regeln - bleibt innen.
 */
export { QuizGame, type QuizGameProps, type QuizGameResult } from './QuizGame.tsx'
