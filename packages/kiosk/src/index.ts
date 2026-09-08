/**
 * @hfroemmel/quiz-kiosk - das spielbare Quiz als EINE Komponente.
 *
 * Ein Gastgeber rendert `<QuizGame>` und bekommt Startauswahl, Spiel und
 * Ergebnis; Ereignisse kommen ueber `onFinished`/`onExit`. Kiosk und
 * Multigame-Einbettung nutzen exakt diesen Baustein.
 */
/*
 * Die globalen Bedienelemente reisen im Stylesheet des Pakets mit - siehe
 * `game/controls.css`.
 */
import './game/controls.css'

export * from './game/QuizGame'
export * from './game/GameStart'
