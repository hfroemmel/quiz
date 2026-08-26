/**
 * @hfroemmel/quiz-kiosk - das spielbare Quiz als EINE Komponente.
 *
 * Ein Gastgeber rendert `<QuizGame>` und bekommt Startauswahl, Spiel und
 * Ergebnis; Ereignisse kommen ueber `onFinished`/`onExit`. Kiosk und
 * Multigame-Einbettung nutzen exakt diesen Baustein.
 */
export * from './game/QuizGame'
export * from './game/GameStart'
