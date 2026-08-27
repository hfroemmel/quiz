---
"@hfroemmel/quiz-core": minor
"@hfroemmel/quiz-content": minor
"@hfroemmel/quiz-themes": minor
"@hfroemmel/quiz-react": minor
"@hfroemmel/quiz-kiosk": minor
---

`QuizGame` nimmt die Laufzeit vom Gastgeber entgegen (`runtime`-Prop). Ohne
Angabe verbindet es sich wie bisher als Spieler mit dem ausliefernden Server;
mit Angabe spielt es gegen jede `QuizRuntime` - insbesondere die
`LocalQuizRuntime` der Offline-Anwendungen. Dazu neu: `useQuizSnapshot(runtime)`
abonniert den Stand einer beliebigen Laufzeit, und `useQuizRuntime(null)` baut
bewusst keine Verbindung auf.
