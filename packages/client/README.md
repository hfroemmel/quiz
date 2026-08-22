# @quiz/client

**Verantwortung:** Die Verbindung zum Quizserver. Sie baut den WebSocket auf,
ueberwacht ihn, verbindet nach einem Abriss neu, ueberfuehrt Snapshots in
React-State und sendet Befehle mit `commandId` und `expectedRevision`.

Alle Rollen benutzen dieselbe Anbindung: Operator, Moderator, Buehnenscreen und
die Spieler am Touchgeraet. Eine zweite Fassung waere eine zweite Reconnect- und
Befehlslogik - und damit eine zweite Fehlerquelle.

**Abhaengigkeiten:** `@quiz/contracts`, `react`.

## Was hier NICHT steht

* Spielregeln. Welche Aktionen moeglich sind, steht in `allowedCommands` des
  View-Modells; ob eine Aktion zulaessig ist, entscheidet der Server.
* Darstellung. Die Buehnenflaeche liegt in `@quiz/presentation`.

```ts
const { view, send, connected, serverNow } = useQuizConnection<PlayerQuizViewModel>('player')
```
