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
