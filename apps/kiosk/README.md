# Kioskbetrieb

Ein Geraet im Foyer, an dem gespielt wird - ohne Operator, ohne Moderator, ohne
Aufsicht. Der Hauptprozess startet die Quizlaufzeit im selben Prozess und
oeffnet ein einziges Vollbildfenster mit der Spieleransicht (`/play`).

## Starten

```
pnpm build                    # Web-Client bauen; der Kiosk liefert ihn aus
pnpm --filter @quiz/kiosk dev
```

## Betriebsangaben

Beide kommen als Umgebungsvariablen herein und gehen von dort als
Abfrageparameter an `/play` - so braucht das Geraet keinen eigenen Build:

| Variable | Vorgabe | Bedeutung |
|---|---|---|
| `QUIZ_KIOSK_MODE` | `adults` | Quizmodus des Geraets. Er gehoert zur Aufstellung und steht nicht auf dem Bildschirm der Spieler. |
| `QUIZ_KIOSK_IDLE_SECONDS` | `120` | Leerlauf-Aufsicht. Wird waehrend eines Spiels so lange nichts beruehrt, wird es abgebrochen und die Auswahl kehrt zurueck. |

Die Aufsicht ist keine Bequemlichkeit: Auf einer Frage liegt bewusst kein
Zeitdruck. Genau deshalb bliebe das Geraet mit einer offenen Frage stehen, wenn
die Spieler einfach weggehen.

## Was es hier NICHT gibt

Kein Operatorfenster, kein Menue, keine LAN-Freigabe. Der Server hoert
ausschliesslich auf `127.0.0.1`, und die Spielerrolle wird ohnehin nur ueber
Loopback angenommen (`packages/server/src/network.ts`). Ein Kioskgeraet oeffnet
damit keinen Zugang zum laufenden Spiel ins Netz.

Der Renderer laeuft ohne `nodeIntegration`, mit `contextIsolation` und ohne
Preload-Bruecke - die Spieleransicht braucht keine Fensterfunktionen.
