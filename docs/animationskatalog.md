# Animationskatalog (Vorschlag zur Freigabe)

Dieser Katalog beschreibt jede Bewegung, die die Anwendung zeigen soll. Er ist
der Vorschlag zur Freigabe; erst danach wird er eins zu eins in
`apps/web/src/presentation/transitions/` eingetragen.

Wie Animationen technisch angelegt und geaendert werden, steht in
[`docs/animationen.md`](animationen.md). Diese Datei legt fest, **was** sich
bewegt.

## Regeln, die fuer jede Zeile gelten

1. **Animationen steuern nie den Spielzustand.** Der Server beendet Phasen nach
   festen Zeiten; ein ausbleibendes `animationend` darf nichts blockieren.
2. **Gesperrte Dauern** (`locked`) sind an `gameTiming` gebunden. Sie duerfen nur
   dort geaendert werden, nie in der Animation.
3. **Jede Zeile hat einen Reduced-Motion-Wert.** Bei `prefers-reduced-motion`
   entfaellt Bewegung, nicht Information: Es wird eingeblendet statt bewegt.
4. **Ton nur beim Audio-Master.** Die Soundmarke gehoert zum Uebergang, wird aber
   nur von genau einem Client gespielt.
5. **Nichts blinkt, nichts pulsiert dauerhaft.** Auf einer Buehne ist
   Daueranimation Unruhe.

## A - Szenenwechsel

| ID | Von → Nach | Dauer | Reduced | Easing | Was sich bewegt | Ton |
|---|---|---|---|---|---|---|
| `scene-fade` | jede → `pause` | 400 ms | 120 ms | standard | Kreuzblende der ganzen Flaeche | `scene-change` |
| `question-enter` | `pause`/`start` → `question` | 420 ms | 120 ms | emphasized | Medium und Text steigen 12 px auf und blenden ein | `question-appear` |
| `options-stagger` | innerhalb `question` | 70 ms Versatz je Zeile | 0 ms | standard | Antwortleisten laufen nacheinander von links 16 px ein | - |
| `reveal-enter` | `question` → `reveal` | 420 ms | 120 ms | emphasized | Ring skaliert von 0,9 auf 1, Bild blendet unscharf ein | `question-appear` |
| `video-enter` | `question` → `video` | 420 ms | 120 ms | standard | Videorahmen blendet ein | `scene-change` |
| `solution-reveal` | `feedback` → `solution` | 520 ms | 150 ms | emphasized | Loesungsbalken waechst von der Mitte auf volle Breite, Text blendet 120 ms spaeter ein | `solution` |
| `result-celebration` | `solution` → `result` | 6000 ms | 0 ms | standard | Konfetti faellt, Ergebniskacheln steigen 20 px auf | `result` |
| `start-return` | jede → `start` | 400 ms | 120 ms | standard | Kreuzblende zum Startbild | `scene-change` |

`options-stagger` ist kein eigener Szenenwechsel, sondern die Einlaufregel der
Antwortzone. Sie laeuft auch dann, wenn die Optionen erst nach `Starten`
erscheinen.

## B - Zustandswechsel innerhalb einer Szene

| ID | Ausloeser | Dauer | Reduced | Was sich bewegt | Ton |
|---|---|---|---|---|---|
| `player-activate` | Spieler bekommt den Zuschlag | 220 ms | 80 ms | Spielerkachel faerbt sich nach `--accent`, kurzer Hub auf 1,04 | `buzz` |
| `player-lock` | Spieler wird gesperrt | 220 ms | 80 ms | Kachel wechselt nach `--accent-quiet`, Schlosssymbol blendet ein | - |
| `option-choose` | Antwort eingeloggt | 200 ms | 80 ms | gewaehlte Leiste faerbt sich nach `--accent` | - |
| `option-clear` | `Zurücksetzen` | 200 ms | 80 ms | Faerbung faellt zurueck auf neutral | - |
| `options-appear` | `Starten` | 420 ms | 120 ms | Antwortzone klappt auf, danach `options-stagger` | `question-appear` |
| `score-count-up` | Punktestand aendert sich | 600 ms | 0 ms | Ziffern zaehlen vom alten zum neuen Snapshotwert | `score` |
| `second-chance-hint` | Wechsel in `second-chance` | 260 ms | 80 ms | Hinweiszeile faehrt 8 px von oben ein | - |
| `progress-step` | `Frage x/y` erhoeht sich | 200 ms | 0 ms | Zahl wechselt mit kurzer Aufblende | - |

`score-count-up` laeuft bewusst **waehrend** der Richtig-Animation, damit der
Punktgewinn und der Haken zusammen gelesen werden (bestaetigt).

## C - Rueckmeldung (fachlich gebundene Dauern)

| ID | Dauer | Reduced | Was sich bewegt | Ton | Bindung |
|---|---|---|---|---|---|
| `correct-feedback` | `gameTiming.correctFeedbackMs` = 1400 ms | 200 ms | Kreis skaliert von 0,6 auf 1 mit Ueberschwingen, Haken zeichnet sich in 260 ms, 12 Funken laufen radial aus, Wort blendet 120 ms spaeter ein | `answer-correct` | **locked** |
| `incorrect-feedback` | `gameTiming.incorrectFeedbackMs` = 1200 ms | 200 ms | Kreis skaliert von 0,8 auf 1, Kreuz zeichnet sich in zwei Strichen zu je 140 ms, kurzer Ruettler von 6 px, keine Funken | `answer-incorrect` | **locked** |

Beide Animationen muessen deutlich vor Ablauf ihrer Phase ausgelaufen sein - die
letzten 300 ms stehen bewusst still, damit der Wechsel zur Loesung nicht in eine
laufende Bewegung schneidet.

## D - Enthuellung (Fairness)

| ID | Dauer | Was sich bewegt | Ton |
|---|---|---|---|
| `reveal-progress` | `gameTiming.imageRevealDurationMs` = 10 s | Ringbogen laeuft ab 12 Uhr im Uhrzeigersinn zurueck, Sekundenzahl zaehlt, Bildschaerfe steigt von 44 px Unschaerfe auf 0 | - |
| `reveal-pause` | 160 ms | Ring und Bild frieren ein, Pausensymbol blendet ein | - |
| `reveal-complete` | 300 ms | letzter Bogenrest verschwindet, Bild erreicht volle Schaerfe | `question-appear` |

**Nicht verhandelbar:** Ring und Schaerfe werden aus **derselben**
Fortschrittsvariablen berechnet und niemals aus einer eigenstaendigen
CSS-Animation. Am Bild aendert sich ausschliesslich die Schaerfe - kein Zoom,
keine Bewegung (bestaetigt).

## E - Bedienrahmen des Operators

Der Rahmen ist Werkzeug, kein Schauspiel. Er bekommt genau drei Bewegungen:

| ID | Dauer | Was sich bewegt |
|---|---|---|
| `control-state` | 120 ms | Farb- und Textwechsel jeder Schaltflaeche |
| `answer-expand` | 220 ms | Zusatzbereich der privaten Antwortzeile klappt auf und zu |
| `banner-slide` | 200 ms | Verbindungs- oder Fehlerband faehrt ueber der Bedienleiste ein |

## F - Was bewusst **nicht** animiert wird

- Der Wechsel zwischen Modi und Schwierigkeitsgraden auf der Startansicht:
  sofortiger Farbwechsel, damit der Operator vor der Show schnell probieren kann.
- Das Aufdecken der Loesung in der privaten Antwortzeile: sie steht immer sofort.
- Der Punktestand bei `+`/`-` durch den Operator: sofortiger Wert, weil es eine
  Korrektur ist und keine Spielhandlung.
- Ein- und Ausblenden des Buehnenfensters: das uebernimmt das Betriebssystem.

## Freigabe

| Punkt | Status |
|---|---|
| Abschnitte A bis F inhaltlich | offen - bitte freigeben oder aendern |
| Gesperrte Dauern in C und D | ergeben sich aus der Spezifikation, keine Freigabe noetig |
| Soundmarken | vorhanden, synthetisch erzeugt; Klangprofil separat justierbar |
