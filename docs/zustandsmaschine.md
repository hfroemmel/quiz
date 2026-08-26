# Zustandsmaschine und Phasen

Alle Phasenwechsel finden ausschliesslich in `packages/domain/src/engine.ts` statt.

## Phasenuebersicht

| Phase | Bedeutung | Buzzer |
|---|---|---|
| `idle` | kein Spiel aktiv | gesperrt |
| `pause-screen` | Pausen-/Logoscreen zwischen zwei Fragen (zeitgesteuert) | gesperrt |
| `question-presented` | Frage sichtbar, Antworten noch verborgen | gesperrt |
| `video-ready` | Videofrage vorbereitet | gesperrt |
| `video-playing` | Video laeuft | gesperrt |
| `buzzer-open` | normale Frage, Buzzer offen | **offen** |
| `answer-locked` | ein Spieler hat den Zuschlag | gesperrt |
| `attempt-feedback` | Richtig-/Falsch-Animation (zeitgesteuert) | gesperrt |
| `second-chance` | zweite Chance des anderen Spielers | gesperrt (kein Buzzern noetig) |
| `reveal-ready` | Bilderkennen, Bild unscharf, Enthuellung noch nicht gestartet | gesperrt |
| `reveal-running` | Bilderkennen, Enthuellung aktiv oder abgeschlossen | **offen** |
| `reveal-paused` | Bilderkennen, Enthuellung eingefroren | **offen** |
| `solution` | Loesung sichtbar, Frage abgeschlossen | gesperrt |
| `result` | Ergebnisansicht | gesperrt |
| `aborted` | Spiel abgebrochen, kein Ergebnis | gesperrt |

Die Buzzer-Spalte ist keine zweite Wahrheit: Sie folgt aus `buzzablePhases` in
`packages/domain/src/buzzer.ts`. Dadurch kann `video-playing` strukturell keine
offenen Buzzer besitzen.

## Normale Multiple-Choice-Frage

```text
pause-screen ──(Zeit)──> question-presented   (nur die Frage, keine Antworten)
                              │ OPEN_BUZZER   ("Antworten einblenden")
                              ▼
                         buzzer-open
                              │ BUZZ / SELECT_PLAYER_MANUALLY
                              ▼
                        answer-locked
                              │ LOG_OPTION_ANSWER | MARK_MANUAL_ANSWER
                              │ RESOLVE_ATTEMPT
                              ▼
                       attempt-feedback
             richtig ────────┴──────── falsch (1. Versuch)
                │                              │
                ▼                              ▼
            solution                     second-chance
                                               │ RESOLVE_ATTEMPT / PASS_SECOND_CHANCE
                                               ▼
                                        attempt-feedback ──> solution
```

Aus `question-presented`, `buzzer-open`, `answer-locked` und `second-chance` ist
`RESOLVE_WITHOUT_ANSWER` jederzeit moeglich: keine Punkte, direkt zur Loesung. Es gibt
keine verbindliche Wartezeit.

## Der Zwischenschritt vor jeder Runde

Jede Frage steht zuerst still da: Der Moderator liest sie vor, ohne dass jemand
buzzern kann. Erst die Freigabe des Operators blendet die Antwortmoeglichkeiten
ein bzw. startet die Enthuellung - und oeffnet damit den Buzzer.

Das ist keine reine Anzeigefrage: In `question-presented` uebertraegt der Server
die Antwortmoeglichkeiten gar nicht erst, und in `reveal-ready` laeuft die Uhr
nicht. Die Vorlesezeit kostet also keine Sekunde des Countdowns.

### Steuerprofil

`START_GAME` traegt optional `flowProfile`; ohne Angabe steuert ein Operator
(`operated`). Die Phasen sind in beiden Profilen dieselben - es gibt keine zweite
Zustandsmaschine. Unterschiedlich ist nur, wer einen Uebergang ausloest:

| Stelle | `operated` | `self-service` |
|---|---|---|
| Frage erscheint | Operator gibt den Buzzer frei | `question-presented`, dann nach `questionLeadInMs` von selbst `buzzer-open` |
| Bilderkennen | Operator startet die Enthuellung | beginnt direkt in `reveal-running` |
| Antwort | Operator loggt ein und loest auf | dieselbe Sequenz durch die Spieler selbst: `BUZZ` sperrt den anderen, `LOG_OPTION_ANSWER` markiert (umentscheidbar), `RESOLVE_ATTEMPT` gibt ab und wertet |
| nach der Loesung | Operator drueckt `Weiter` | ein SPIELER drueckt `Weiter` (`CONTINUE`); eingeplant wird hier nichts |
| Videofrage | Operator startet und blendet um | startet nach `videoLeadInMs`, die Frage folgt aus der gemeldeten Laufzeit |

Alle automatischen Uebergaenge nutzen dieselbe Mechanik wie Feedback und
Pausenscreen: `pendingTransition` mit serverseitiger Fallbackzeit. Eine
ausbleibende Meldung eines Browsers kann den Ablauf deshalb nicht anhalten.

Zwei Stellen sind bewusst NICHT eingeplant, sondern verlangen einen Tipp:

- **Vor den Antworten** wartet der Server `questionLeadInMs`. Am Geraet liest
  niemand die Frage vor; diese Frist ist der Ersatz dafuer. Solange sie laeuft,
  ist der Buzzer zu und die Optionen gehen nicht einmal auf die Leitung.
- **Nach der Loesung** wartet der Server auf `CONTINUE` eines Spielers. Ein
  eingeplanter Uebergang naehme dem, der gerade liest, warum seine Antwort
  falsch war, das Bild unter den Augen weg. Bleibt das Geraet dabei stehen,
  greift die Leerlauf-Aufsicht der Huelle.

Der Uebergang aus `solution` ist dabei kein Phasenwechsel, sondern dieselbe
Entscheidung wie `CONTINUE`: naechste Frage ziehen oder Ergebnis zeigen.

Fragen, die nur ein Mensch bewerten kann (`manual-correct-incorrect`), koennen am
Geraet nicht aufgeloest werden. Wird eine solche Frage im Selbstbedienungsbetrieb
gezogen, zieht der Server einen Ersatz und protokolliert das; taugt ein ganzer
Fragenplatz nicht, wird er uebersprungen. Findet sich gar keine beantwortbare
Frage mehr, endet das Spiel mit dem Ergebnis - ein stehengebliebener Bildschirm
waere am unbeaufsichtigten Geraet das schlechteste Ergebnis.

### Spielerzahl

Ein Spiel hat ein oder zwei Spieler (`START_GAME` mit `playerCount`; ohne Angabe
zwei). Die Phasen sind in beiden Faellen dieselben, nur die zweite Chance haengt
daran: Sie setzt einen anderen Spieler voraus, der bei dieser Frage noch antworten
darf. Im Einzelspiel gibt es ihn nicht, deshalb folgt dort nach dem Fehlversuch
sofort `solution`. Entschieden wird das an genau einer Stelle -
`eligibleOpponent` in `packages/domain/src/buzzer.ts`.

Auch das Ergebnis haengt an der Spielerzahl: Im Duell gewinnt der hoehere
Punktestand (bei Gleichstand Unentschieden), im Einzelspiel gibt es weder Gewinner
noch Unentschieden, sondern Punktestand und Trefferzahl. Welche Fassung gilt, sagt
`result.mode` im View-Modell - die Oberflaeche zaehlt nicht die Punktestaende.

## Bilderkennen

```text
pause-screen ──(Zeit)──> reveal-ready   (Bild unscharf, Uhr steht, Buzzer gesperrt)
   ▲                          │ START_IMAGE_REVEAL
   │                          ▼
   │                     reveal-running   (Enthuellung laeuft, Buzzer offen)
   │                          │ BUZZ
   │                          ▼
   │                     answer-locked   (Enthuellung eingefroren)
   │                          │ RESOLVE_ATTEMPT
   │                          ▼
   │                   attempt-feedback
   └───── falsch ────────────┤
                             └── richtig ──> solution (Bild vollstaendig scharf)
```

Nach einem Fehlversuch geht es zurueck nach `reveal-running`, nicht nach
`reveal-ready`: Die Frage ist bereits vorgelesen.

Unbegrenzt viele Fehlversuche; nach jedem Fehlversuch laeuft die Enthuellung an
derselben Stelle weiter und **beide** Spieler duerfen erneut buzzern. `PAUSE_IMAGE_REVEAL`
und `RESUME_IMAGE_REVEAL` wechseln zwischen `reveal-running` und `reveal-paused`.

## Videofrage

```text
pause-screen ──(Zeit)──> video-ready ──START_VIDEO──> video-playing
                              ▲                            │
                              └──────PAUSE_VIDEO───────────┘
                              │
                              │ SHOW_QUESTION_AFTER_VIDEO
                              ▼
                       question-presented ──> normaler Ablauf
```

Video und Frage sind zwei Phasen **derselben** Frage, nicht zwei Fragen.

## Zeitgesteuerte Phasen

`attempt-feedback` und `pause-screen` besitzen eine `pendingTransition` mit
`endsAtMs` und `transitionId`. Der Server setzt dafuer einen Timer und schickt
anschliessend `ADVANCE_TIMED_PHASE`.

* Der fachliche Wechsel haengt **nie** an einem `animationend`-Event des Browsers.
* Eine doppelt eintreffende Meldung laeuft ins Leere, weil die `transitionId` nach dem
  ersten Wechsel nicht mehr passt.
* Die Dauern stehen in `gameTiming` (`packages/contracts/src/config.ts`).

## Ergebnis

`CONTINUE` bedeutet immer dasselbe: bei nicht letzter Frage zur naechsten Frage, bei
letzter Frage zur Ergebnisansicht. Es bedeutet nie „Antwort bewerten“ oder „zweiten
Spieler freigeben“ - dafuer gibt es eigene Befehle.

Der hoehere Punktestand gewinnt, bei Gleichstand `Unentschieden`. Es gibt keine manuelle
Gewinnerauswahl und keine Entscheidungsfrage. Ein abgebrochenes Spiel zeigt kein Ergebnis.
