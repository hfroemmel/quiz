---
"@hfroemmel/quiz-core": minor
"@hfroemmel/quiz-content": minor
"@hfroemmel/quiz-themes": minor
"@hfroemmel/quiz-react": minor
"@hfroemmel/quiz-kiosk": minor
---

Der Moderator darf den Zuschlag von Hand setzen (`SELECT_PLAYER_MANUALLY`) und
die Antwort einloggen (`LOG_OPTION_ANSWER`). Am Buehnenabend steht er neben den
Spielern und sieht als Erster, wer sich gemeldet hat; Punkte, Abbruch, Technik
und Inhalte bleiben beim Operator.

`QuizGame` und `GameStart` nehmen `playerCounts` entgegen - die Spielerzahlen,
die ein Geraet anbietet. Bleibt nur eine uebrig, entfaellt die Frage danach
ganz.
