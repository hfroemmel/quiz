# Zustandsmaschine und Phasen

Alle Phasenwechsel finden ausschliesslich in `packages/domain/src/engine.ts` statt.

## Phasenuebersicht

| Phase | Bedeutung | Buzzer |
|---|---|---|
| `idle` | kein Spiel aktiv | gesperrt |
| `pause-screen` | Pausen-/Logoscreen zwischen zwei Fragen (zeitgesteuert) | gesperrt |
| `question-presented` | Frage sichtbar, noch nicht freigegeben | gesperrt |
| `video-ready` | Videofrage vorbereitet | gesperrt |
| `video-playing` | Video laeuft | gesperrt |
| `buzzer-open` | normale Frage, Buzzer offen | **offen** |
| `answer-locked` | ein Spieler hat den Zuschlag | gesperrt |
| `attempt-feedback` | Richtig-/Falsch-Animation (zeitgesteuert) | gesperrt |
| `second-chance` | zweite Chance des anderen Spielers | gesperrt (kein Buzzern noetig) |
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
pause-screen ──(Zeit)──> question-presented
                              │ OPEN_BUZZER
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

### Spielerzahl

Ein Spiel hat ein oder zwei Spieler (`START_GAME` mit `playerCount`; ohne Angabe
zwei). Die Phasen sind in beiden Faellen dieselben, nur die zweite Chance haengt
daran: Sie setzt einen anderen Spieler voraus, der bei dieser Frage noch antworten
darf. Im Einzelspiel gibt es ihn nicht, deshalb folgt dort nach dem Fehlversuch
sofort `solution`. Entschieden wird das an genau einer Stelle -
`eligibleOpponent` in `packages/domain/src/buzzer.ts`.

### Steuerprofil

`START_GAME` traegt optional `flowProfile`; ohne Angabe steuert ein Operator
(`operated`). Die Phasen sind in beiden Profilen dieselben - es gibt keine zweite
Zustandsmaschine. Unterschiedlich ist nur, wer einen Uebergang ausloest:

| Stelle | `operated` | `self-service` |
|---|---|---|
| Frage erscheint | Operator gibt den Buzzer frei | Einstiegsphase ist bereits `buzzer-open` |
| Antwort | Operator loggt ein und loest auf | ein Fingertipp: `ANSWER_BY_PLAYER` wertet sofort aus |
| nach der Loesung | Operator drueckt `Weiter` | eingeplanter Uebergang nach `solutionHoldMs` |
| Videofrage | Operator startet und blendet um | startet nach `videoLeadInMs`, die Frage folgt aus der gemeldeten Laufzeit |

Alle automatischen Uebergaenge nutzen dieselbe Mechanik wie Feedback und
Pausenscreen: `pendingTransition` mit serverseitiger Fallbackzeit. Eine
ausbleibende Meldung eines Browsers kann den Ablauf deshalb nicht anhalten.

Der Uebergang aus `solution` ist dabei kein Phasenwechsel, sondern dieselbe
Entscheidung wie `CONTINUE`: naechste Frage ziehen oder Ergebnis zeigen.

Fragen, die nur ein Mensch bewerten kann (`manual-correct-incorrect`), koennen am
Geraet nicht aufgeloest werden. Wird eine solche Frage im Selbstbedienungsbetrieb
gezogen, zieht der Server einen Ersatz und protokolliert das. Verhindern soll das
die Inhaltsvalidierung; diese Stelle ist das Sicherheitsnetz.

Auch das Ergebnis haengt an der Spielerzahl: Im Duell gewinnt der hoehere
Punktestand (bei Gleichstand Unentschieden), im Einzelspiel gibt es weder Gewinner
noch Unentschieden, sondern Punktestand und Trefferzahl. Welche Fassung gilt, sagt
`result.mode` im View-Modell - die Oberflaeche zaehlt nicht die Punktestaende.

## Bilderkennen

```text
pause-screen ──(Zeit)──> reveal-running   (Enthuellung startet automatisch, Buzzer offen)
   ▲                          │ BUZZ
   │                          ▼
   │                     answer-locked   (Enthuellung eingefroren)
   │                          │ RESOLVE_ATTEMPT
   │                          ▼
   │                   attempt-feedback
   └───── falsch ────────────┤
                             └── richtig ──> solution (Bild vollstaendig scharf)
```

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
