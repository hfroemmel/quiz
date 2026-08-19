# Screens: Zustand fuer Zustand

Diese Datei uebersetzt die siebzehn Screendesigns in Zustaende der
Zustandsmaschine und schreibt die Zustaende fest, fuer die keine Vorlage
existiert. Sie ist die Referenz fuer Umsetzung und Abnahme.

Alle Farbtokens sind in [`docs/design-system.md`](design-system.md) definiert,
alle Uebergaenge in [`docs/animationskatalog.md`](animationskatalog.md).

## Zuordnung der Vorlagen

| Vorlage | Phase | Szene | Besonderheit |
|---|---|---|---|
| 9 | `idle` | `start` | Startbild Erwachsene, Modus- und Schwierigkeitswahl |
| 17 | `idle` | `start` | Startbild Kinder, Maskottchen randlos |
| 8 | `question-presented` | `question` | Bild und Frage sichtbar, Optionen noch verborgen |
| 13 | `question-presented` | `question` | reine Textfrage, Rubrik und Frage ueber volle Breite |
| 16 | `buzzer-open` | `question` | Optionen sichtbar, beide Spieler bedienbar |
| 7 | `answer-locked` | `question` | Spieler 1 hat gebuzzert, Antwortwahl offen |
| 15 | `answer-locked` | `question` | Antwort B eingeloggt, oeffentlich blau, `Auflösen` primaer |
| 14 | `attempt-feedback` | `feedback` | Richtig, Textwahlfrage |
| 2 | `attempt-feedback` | `feedback` | Richtig, muendliche Frage |
| 6 | `attempt-feedback` | `feedback` | Falsch - Symbol fehlt, wird ergaenzt |
| 5 | `solution` | `solution` | Loesung mit Buchstabenchip |
| 10 | `solution` | `solution` | Loesung ohne Chip (freie Antwort) |
| 12 | `reveal-running` | `reveal` | Ring bei 1 s, Bild noch unscharf |
| 4 | `reveal-running` | `reveal` | Ring bei 7 s |
| 3, 11 | `reveal-paused` bzw. Ende der Enthuellung | `reveal` | Ring bei 0, Bild scharf |
| 1 | `result` | `result` | Konfetti, Ergebniskacheln, `Spiel beenden` |

Nicht in den Vorlagen enthalten und deshalb unten entworfen: `pause-screen`,
`video-ready`, `video-playing`, `second-chance`, `aborted`, Verbindungsverlust,
Wiederaufnahme nach Neustart, Moderatoransicht.

## Gemeinsamer Rahmen

### Grund und Atmosphaere

Die Buehne steht auf einem kuehlen, leicht blaeulichen Verlauf
(`#171C21` nach `#293139`). Dahinter liegt das **Fragebild selbst**:
formatfuellend, stark weichgezeichnet, abgedunkelt und mit einem Farbschleier
ueberzogen. Jede Frage bekommt so ihre eigene Atmosphaere, ohne dass Text an
Ruhe verliert.

Waehrend einer Bildenthuellung ist derselbe Hintergrund viel staerker
weichgezeichnet und staerker verschleiert: Dort ist das Motiv die Aufgabe, und
der Hintergrund darf keine Silhouette verraten.

Kacheln, Buchstabenfelder und Antwortleisten sind halbtransparente Milchglas-
flaechen mit leichter Weichzeichnung - ohne Rahmen, mit einem sehr weichen
Schatten fuer raeumliche Tiefe. Die Werte stehen in
[`docs/design-system.md`](design-system.md).

### Wortmarke

Oben links steht die Wortmarke (`apps/web/src/assets/images/logo.svg`), gespiegelt
zum Fragezaehler oben rechts. Sie wird als CSS-Maske ueber einer Farbflaeche
gezeichnet und traegt damit immer `--text` des aktiven Modus - eine zweite,
weisse Fassung der Datei gibt es nicht. Auf dem Startbild entfaellt sie, dort
traegt die Startgrafik das Branding.

### Kopfzeile (oeffentlich, innerhalb der Buehnenflaeche)

```text
[+][-] [Spieler|1][Punkte|100]   [Punkte|100][Spieler|2] [+][-]     [Frage|3/7]
```

- Die beiden Spielergruppen sind **gespiegelt**: Bei Spieler 1 steht die
  Spielerkachel aussen links, bei Spieler 2 aussen rechts. Die Punktekacheln
  liegen innen und stossen in der Mitte aneinander.
- Die Kachel `Spieler` faerbt sich `--accent`, sobald der Spieler am Zug ist.
- `Frage x/y` steht rechts und verschwindet in `start` und `result`.
- `+`/`-` gehoeren dem Operator und liegen als Overlay ueber der Vorschau. Auf
  dem Beamer erscheinen sie nicht. Sie sind quadratisch. Sie behalten ihre Position auch dann, wenn
  die Kacheln daneben ausgeblendet sind (Ergebnisansicht).
- Schrittweite `+`/`-` ist `scoringRules.manualAdjustmentStep` - derzeit 50 Punkte.

### Bedienleiste (nur Operator)

Zwei Zeilen:

1. **Private Antwortzeile.** Kleine Beschriftung
   `Richtige Antwort (klicken um mehr zu erfahren)`, darunter die Loesung in
   Serifenschrift; bei Wahlfragen mit vorangestelltem Buchstaben `(B) Bliesgau`.
   Ein Klick klappt einen Zusatzbereich auf mit `explanation.summary`,
   `explanation.details`, `explanation.source` und `explanation.moderatorNotes`.
   Der Bereich klappt bei jedem Phasenwechsel automatisch wieder zu, damit die
   Zeile im Live-Betrieb nie unerwartet Platz frisst.
   Rechts aussen steht `Zurücksetzen`.
2. **Nummerierte Handlungsgruppen.** Ueber jeder Gruppe steht eine kleine
   Ordnungszahl, die den Ablauf lehrt:

   | Gruppe | Inhalt |
   |---|---|
   | `1. Runde` | `Starten` |
   | `2. Spieler ermitteln` | `Spieler 1`, `Spieler 2`, `zurücksetzen` |
   | `3. Antwort auswählen` | `A B C D` bei Wahlfragen, `Richtig`/`Falsch` bei muendlichen Fragen |

   Ueber den Gruppen steht nur die Ueberschrift, sonst nichts. Versuchszaehler
   und die Punkte des laufenden Versuchs erscheinen dort **nicht** - der Wert
   steht bereits auf der Buehne, und eine zweite Fassung an dieser Stelle laesst
   die Leiste bei jedem Versuchswechsel umbrechen.

   Die Tasten der Antwortgruppe tragen **nur den Buchstaben**. Der Antworttext
   steht bereits auf der Buehne; ihn zu wiederholen kostet Platz und Blickzeit.
   Der Volltext bleibt als Tooltip erreichbar, und nur der Operator sieht die
   Markierung der richtigen Option.

   `Richtig`/`Falsch` erscheinen ausschliesslich bei Fragen mit manueller
   Bewertung, also beim Bilderkennen. Bei einer Auswahlfrage waeren sie ein
   zweiter Bewertungsweg neben der eingeloggten Option; die Entscheidung darueber
   faellt serverseitig in `allowedCommands`, nicht in der Oberflaeche.
   | ohne Nummer | `Auflösen` |
   | ohne Nummer, rechts aussen | `Weiter` bzw. `Spiel beenden` |

   Die Gruppen bleiben **immer sichtbar und an derselben Stelle**. Nicht
   erlaubte Tasten werden gesperrt, nie ausgeblendet - der Operator soll seine
   Tasten blind finden.

Der Hinweis `Zweite Chance · 50 Punkte` steht **rechtsbuendig direkt ueber den
Antwortleisten**, auf `--accent` mit runden Ecken. Er ist kein Nebensatz, sondern
die Ansage, dass dieser Versuch nur noch halb so viel bringt; seine rechte Kante
liegt auf der rechten Kante der Antwortleisten.

In der zweiten Chance ist eine bereits als falsch bewertete Option **verbraucht**:
Auf der Buehne steht ihre Leiste zurueckgenommen, im Bedienfeld ist ihre Taste
gesperrt, und der Server weist ein erneutes Einloggen mit
`option-already-answered` ab. Ein zweites "falsch" auf dieselbe Antwort waere nur
ein verlorener Versuch.

`zurücksetzen` verwirft die Spielerzuordnung und die eingeloggte Antwort des
laufenden Versuchs. Ohne zugeordneten Spieler ist die Taste gesperrt - es gaebe
nichts zurueckzunehmen. Sperren aus bereits bewerteten Fehlversuchen bleiben
bestehen (Spezifikation 6.4).

### Bedienleiste: Aufteilung

Die Handlungsgruppen stehen **nebeneinander** und teilen sich die volle Breite;
die primaere Handlung (`Weiter`, `Spiel beenden`) sitzt rechts aussen. Damit ist
die Leiste in einer Zeile lesbar und der Blick springt nicht.

### Rueckfragen

Handlungen, die sich nicht zuruecknehmen lassen - Spiel beenden, Enthuellung
zuruecksetzen, Frage deaktivieren, unterbrochenes Spiel verwerfen, neuer
Veranstaltungstag - fragen ueber einen Dialog **innerhalb** der Anwendung zurueck.
Kein `confirm()` des Browsers: Das steht ausserhalb der Gestaltung und sieht auf
einem Veranstaltungsrechner aus wie ein Fehler. Der Dialog benennt die Folge im
Klartext, `Escape` bricht ab, und der Fokus liegt auf `Abbrechen`.

### Session-Code

Oben rechts, links neben den Symbolschaltern: kleine Beschriftung
`SESSION-CODE`, darunter der Code in Weiss. Der Moderator braucht ihn zum
Anmelden am iPad; der Operator sucht ihn dort, wo die Fensterschalter sind.

### Fussbereich

Technik, Protokoll und Verbindung liegen als flacher Fussbereich am unteren Rand
des Fensters - eingeklappt eine Zeile, ausgeklappt der volle Diagnosebereich.

### Ausserhalb der Buehnenflaeche

`Beenden` oben links; `Vollbild` und `Ton` als reine Symbolschalter oben rechts.
Sie tragen keine Beschriftung, aber ein verpflichtendes `aria-label` und einen
Tooltip. In `idle` ist `Beenden` gesperrt.

Die Operatoransicht kommt ohne erklaerende Beschriftungen aus: Es gibt weder eine
Anweisungszeile ueber der Bedienleiste noch Ueberschriften wie „Das sieht der
Saal“ oder „Nur fuer Regie“. Der Aufbau selbst sagt, was oeffentlich ist und was
nicht - die Buehnenflaeche oben, alles Private darunter.

### Fragenkorrektur

Der Bereich `Fehlerhafte Frage korrigieren` zeigt Fragetext **und**
Antwortmoeglichkeiten in bearbeitbaren Feldern. Je Antwort steht eine Zeile:
vorn der Buchstabe, dann das Textfeld ueber die volle Breite der Spalte, hinten
ein Radiobutton. Der Radiobutton markiert die richtige Antwort und setzt damit
`correctOptionId` - nie die Reihenfolge und nie eine Markierung im Text.
Fragen ohne Auswahl - Bilderkennen und jede andere freie Antwort - haben statt der
Optionszeilen ein Feld `Richtige Antwort`. Es schreibt `acceptedAnswerText`;
mehrere zulaessige Formulierungen werden mit Semikolon getrennt. Ohne dieses Feld
liesse sich genau bei diesen Fragen die Loesung nicht korrigieren.

Gespeichert wird nur, was tatsaechlich geaendert wurde. Die Felder leeren sich
beim Fragenwechsel - sonst stuende die Korrektur der vorigen Frage im Formular.

### Fusszeile

Flache Leiste am unteren Rand: links der aufklappbare Bereich
`Technik, Protokoll und Verbindung`, rechts aussen die Taste `Spielprotokoll`.
Sie oeffnet ein Popup mit den bisher gespielten Spielen je Quizmodus - gesamt,
davon beendet, davon abgebrochen, und wann zuletzt gespielt wurde. Jeder
konfigurierte Modus steht in der Tabelle, auch mit null Spielen: Ein fehlender
Eintrag sieht sonst aus wie ein Modus, den es nicht mehr gibt.

`Protokoll zurücksetzen` fragt in derselben Flaeche nach (`Wirklich zurücksetzen`)
- ein zweites Popup ueber dem Popup waere unbedienbar. Zurueckgesetzt wird die
**Zaehlung**: Die Spiele bleiben mit Punktestand und Auditlog in der Datenbank,
und das Protokoll zaehlt ab diesem Zeitpunkt neu.

## Antwortoptionen: zwei bis vier

Der Entwurf zeigt vier Leisten, verlangt sie aber nicht. Erlaubt sind **zwei bis
vier** Optionen (`contentThresholds.minChoiceOptionCount` und
`maxChoiceOptionCount`); die Leisten teilen sich ohnehin die volle Breite, und die
Buchstaben laufen von A weiter.

Unter zwei Optionen ist es **keine Auswahlfrage**. Eine einzelne Option waere die
Loesung selbst auf der Buehne. Solche Fragen laufen ueberall als freie Antwort:
Der Saal sieht keine Antwortleisten, der Operator bekommt statt der Buchstaben
`Richtig`/`Falsch`, und die Loesung kommt aus `acceptedAnswerText`. Entschieden
wird das an genau einer Stelle - `isChoiceQuestion` in
`packages/contracts/src/content.ts`; Validierung, Engine, Befehlsfreigabe und
Projektion fragen dort nach.

## Zwischenscreen (`pause-screen`, Szene `pause`)

- Logo des Modus, darunter `Frage 3 von 7`, darunter die **Rubrik** der gleich
  folgenden Frage. Die Rubrik blendet mit kurzer Verzoegerung ein, damit der Blick
  erst die Nummer und dann das Thema aufnimmt.
- Uebertragen wird ausschliesslich die Rubrik (`upcomingCategoryLabel`).
  Fragetext, Optionen und Bild bleiben bis zur Frageszene beim Server.
- Der Screen steht `gameTiming.pauseScreenMs` (3 s) - kurz genug, um nicht zu
  bremsen, lang genug, um die Rubrik zu lesen.

## Startansicht (`idle`, Szene `start`)

- Buehnenflaeche: Startbild des gewaehlten Modus. Erwachsene: Adler als
  Wasserzeichen, darueber grosses `?` und der Titel. Kinder: randfuellende
  Grafik auf eigener Hintergrundfarbe.
- Kopfzeile: keine Kacheln, keine `+`/`-`.
- Bedienleiste: einzeilig, ohne private Antwortzeile.
  Gruppe `Modus` mit drei Chips aus `catalog.modes`, Gruppe `Schwierigkeitsgrad`
  mit den Presets des gewaehlten Modus, rechts `Spiel starten` in `--primary`.
- **Keine Namensfelder.** Die Spieler heissen `Spieler 1` und `Spieler 2`; die
  Buehne zeigt keine Eigennamen, also gibt es auch nichts einzutragen. Der Befehl
  `START_GAME` traegt deshalb kein `playerLabels`, und der Server setzt seine
  Vorgabenamen.
- Der aktive Chip ist `--accent`. Wechselt der Modus, wechselt sofort das
  Farbsystem der **Buehnenflaeche** und das Startbild. Die Bedienoberflaeche
  bleibt davon unberuehrt - sie traegt ihr eigenes, festes Farbsystem
  (`--ui-*`, siehe `docs/design-system.md`), damit der Operator seine Tasten
  nicht bei jedem Moduswechsel neu suchen muss.
- Liegt ein wiederaufnehmbares Spiel vor (`resumable`), erscheint links neben
  `Spiel starten` zusaetzlich `Spiel fortsetzen`; das Startbild traegt dann eine
  Zeile `Unterbrochenes Spiel gefunden: Frage 4 von 7`.

## Frageansichten

### Aufbau mit Bild (Vorlagen 7, 8, 15, 16)

```text
+---------------------------------------------+
| [Bild 4:3]   Rubrik                          |
|              Fragetext (max. 2 Zeilen)       |
|                                              |
| [A] Antwort ...............................  |
| [B] Antwort ...............................  |
| [C] Antwort ...............................  |
| [D] Antwort ...............................  |
+---------------------------------------------+
```

- Das Bild steht links, etwa 18 % der Flaechenbreite, Verhaeltnis 4:3.
- Die **Rubrik** ueber der Frage ist das Label der **ersten Kategorie** der Frage
  (bestaetigt). Dafuer traegt das oeffentliche View-Modell
  `question.categoryLabel`. Sie steht klein, halbfett, in der Groteske und in
  `accent` - ein Orientierungselement, keine zweite Ueberschrift.
- Optionsleisten: Buchstabenchip `tile` links, Text zentriert auf `option`.
  Beide sind halbtransparent, tragen denselben Radius und stehen nur eine
  schmale Fuge auseinander - der Buchstabe gehoert sichtbar zu seiner Zeile.

### Aufbau ohne Bild (Vorlage 13)

Rubrik und Fragetext stehen ueber die **volle Breite**, die Optionen darunter -
bestaetigt. Es bleibt bei einem Layout mit zwei Zonen: Kopfzone (Medium + Text)
und Antwortzone.

### Sichtbarkeitsstufen

| Phase | Kopfzone | Optionen | Bedienbar |
|---|---|---|---|
| `question-presented` | sichtbar | **verborgen** | `Antworten einblenden` |
| `buzzer-open` | sichtbar | sichtbar, neutral | `Spieler 1`, `Spieler 2` |
| `answer-locked` | sichtbar | sichtbar, neutral | `A`-`D` bzw. `Richtig`/`Falsch`, `Zurücksetzen` |
| `answer-locked`, Antwort eingeloggt | sichtbar | gewaehlte Leiste `--accent` | zusaetzlich `Auflösen` primaer |

Die eingeloggte Antwort erscheint oeffentlich in `--accent`: Der Saal sieht die
Festlegung, aber nicht ihre Bewertung. Ob sie stimmt, verraet erst die
Loesungsszene.

Die Optionen erscheinen erst nach der Freigabe (bestaetigt) - und werden bis
dahin auch nicht uebertragen. Der Moderator liest die Frage vor, bevor jemand
buzzern kann. Die eingeloggte Antwort ist **oeffentlich** sichtbar - der Saal sieht, worauf sich der Spieler
festgelegt hat, aber nicht, ob es stimmt.

## Enthuellung (`reveal-ready`, `reveal-running`, `reveal-paused`)

- `reveal-ready` ist der Zwischenschritt vor dem Start: Das Bild steht bei voller
  Unschaerfe, der Ring zeigt die volle Dauer, die Uhr laeuft nicht und niemand
  kann buzzern. Der Operator startet mit `Enthuellung starten`.

- Links der Ring, rechts das Bild. Der Ring hat aussen die Spur in
  `--surface-tile-disabled`, darauf den weissen Fortschrittsbogen mit runden
  Enden; in der Mitte die verbleibenden Sekunden.
- **Der Bogen beginnt bei 12 Uhr und laeuft im Uhrzeigersinn.** Seine Laenge ist
  der Restanteil: bei 7 von 10 Sekunden 252 Grad, bei 1 Sekunde 36 Grad. Am Ende
  bleibt nur die Spur.
- Am Bild aendert sich **ausschliesslich die Schaerfe** (bestaetigt) - keine
  Skalierung, keine Bewegung, keine Deckkraft.
- Ring und Schaerfe stammen aus **einer** Fortschrittsvariablen
  (`packages/domain/src/reveal.ts`). Das ist eine Fairnessregel, keine
  Gestaltungsfrage.
- Pausiert: Ring und Bild frieren ein, die Sekundenzahl bekommt zusaetzlich das
  Pausensymbol, damit "eingefroren" nicht mit "sehr langsam" verwechselt wird.
- Nach Ablauf zeigt der Ring `0`, das Bild ist scharf, die Buzzer bleiben offen.
- Buzzert ein Spieler waehrend der Enthuellung, **bleibt die Buehne in dieser
  Szene** und friert den Countdown ein. Ein Sprung ins Fragelayout wuerde Bild und
  Ring vom Schirm nehmen, obwohl genau darueber gerade gesprochen wird
  (`sceneForPhase` in `packages/domain/src/projection.ts`).
- Die Worte `pausiert` bzw. `Buzzern weiterhin möglich` unter dem Ring sind
  **Regiehinweise**: Sie stehen nur in der Vorschau des Operators, nie auf der
  Buehne. Sie liegen absolut unter dem Ring, damit ihr Erscheinen den Countdown
  nicht verschiebt.

## Rueckmeldung (`attempt-feedback`)

- Grafik und Wort stehen mittig in der **gesamten** Buehnenflaeche, nicht nur in
  dem Bereich unter der Kopfzeile. Der Ausgleich steckt als zusaetzliche
  Polsterung unten in `.scene--feedback`.
- Zentraler Kreis, darunter das Wort. Richtig: `--correct`, weisser Haken,
  kurze Funkenpartikel nach aussen. Falsch: `--incorrect`, weisses Kreuz,
  **keine** Partikel.
- Die Punktekachel des bewerteten Spielers **zaehlt waehrend der
  Richtig-Animation hoch** (bestaetigt) und ist am Ende der Animation auf dem
  neuen Wert. Der Wert selbst kommt aus dem Snapshot; die Animation
  interpoliert nur zwischen altem und neuem Snapshotwert. Bei einem Anstieg
  laeuft zusaetzlich die gelieferte Sternegrafik ueber der Kachel.
- Die Kachel traegt den Serverwert als `data-score`. Damit haengt keine
  Auswertung - weder Test noch Diagnose - am Stand einer laufenden Animation.
- Die Dauern sind an `gameTiming.correctFeedbackMs` bzw.
  `gameTiming.incorrectFeedbackMs` gebunden und im Animationskatalog als
  `locked` markiert.

## Zweite Chance (`second-chance`) - entworfen

Vorlagenlos, im gezeigten Stil festgelegt; bestaetigt: sichtbar gekennzeichnet.

- Die Buehnenflaeche behaelt das Fragelayout.
- Der andere Spieler wird `--accent` markiert und ist am Zug; der erste Spieler
  bleibt sichtbar, seine Spielerkachel steht in `--accent-quiet` mit einem
  Schlosssymbol.
- Unter der Kopfzeile erscheint eine schmale Zeile `Zweite Chance · 50 Punkte`
  in `--text-muted`. Der Punktwert kommt aus `answering.pointsIfCorrect`, nicht
  aus einer festen Zeichenkette.
- Bedienleiste: Gruppe 2 ist gesperrt (der Zug ist gesetzt), Gruppe 3 offen.

## Loesung (`solution`)

- Kopfzone unveraendert, darunter die Zeile `Richtige Antwort:` und der
  Loesungsbalken in `--solution` ueber die volle Breite.
- Wahlfragen behalten den Buchstabenchip in `--solution-chip`; freie Antworten
  zeigen den Balken ohne Chip.
- Bei Bilderkennen-Fragen wandert das Bild nach rechts oben und wird scharf
  dargestellt; darunter steht der Balken.
- Falsch gewaehlte Optionen bleiben stehen und werden auf `--text-muted`
  zurueckgenommen, damit der Saal den Vergleich sieht.
- **Kein Erklaerungstext auf der Buehne.** Der Hintergrund gehoert dem Moderator,
  der ihn erzaehlt; er wird deshalb gar nicht erst oeffentlich uebertragen. Im
  privaten Bereich des Operators steht er unveraendert.

## Ergebnis (`result`)

- Kopfzeile ohne Spieler- und Fragekacheln; nur die `+`/`-` des Operators
  bleiben an ihrer Position.
- Mittig die Ueberschrift `Spieler 1 hat gewonnen!` bzw. `Unentschieden!`,
  darunter zwei grosse Ergebniskacheln - erneut gespiegelt: `Spieler|Punkte`
  links, `Punkte|Spieler` rechts.
- Konfetti faellt ueber die gesamte Flaeche, **ohne** Abdunkelung des
  Hintergrunds.
- Bedienleiste: alle Spieltasten gesperrt, rechts `Spiel beenden` in
  `--primary`; die private Antwortzeile zeigt weiterhin die letzte Loesung.
- Die Ergebniskacheln zaehlen wie die Kopfzeile hoch: Korrigiert der Operator
  hier noch Punkte, ist das dieselbe Bewegung wie im Spiel.

## Pausenbild (`pause-screen`) - entworfen

Zeitgesteuerter Zwischenzustand nach Spezifikation 6.2.

- Buehnenflaeche zeigt das Startbild des Modus als ruhiges Wasserzeichen bei
  35 % Deckkraft, darueber `Frage 4 von 7` in Ergebnistitelgroesse.
- Kopfzeile bleibt vollstaendig sichtbar - der Punktestand ist genau jetzt
  interessant.
- Bedienleiste: alles gesperrt; der Server schaltet nach
  `gameTiming.pauseScreenMs` selbst weiter.

## Videofrage (`video-ready`, `video-playing`) - entworfen

- `video-ready`: Das Video steht auf dem ersten Bild, mittig in 16:9 mit
  schwarzen Randflaechen; darueber die Rubrik und die Frage wie im Fragelayout.
  In der Mitte des Videobildes liegt ein Abspielsymbol als reine Anzeige.
- `video-playing`: gleiche Anordnung ohne Symbol, darunter ein 4 px hoher
  Fortschrittsbalken in `--accent`, gespeist aus `video.positionMs`.
- Bedienleiste: Gruppe 1 traegt in dieser Frage `Video starten`,
  `Video pausieren` und `Zum Anfang`; danach gilt der normale Ablauf.
- Bei `video.hasError` erscheint mittig `Video nicht verfuegbar` und die
  Bedienleiste gibt `Ohne Video fortfahren` frei - der Ablauf darf nie an einer
  Datei haengen bleiben.

## Abbruch (`aborted`) - entworfen

Nach `Beenden`: Die Buehnenflaeche geht auf das Startbild des Modus zurueck.
Es gibt bewusst **keine** Gewinneransicht (Spezifikation 6.6). Die Bedienleiste
zeigt nur `Neues Spiel`.

## Verbindungs- und Fehlerzustaende - entworfen

- **Buehnenfenster ohne Verbindung:** Der letzte Snapshot bleibt stehen. Am
  unteren Rand der Buehnenflaeche laeuft ein 4 px hoher Streifen in
  `--incorrect` ein. Es gibt keine Fehlermeldung im Bild, weil der Saal
  mitliest.
- **Operator ohne Verbindung:** Ueber der Bedienleiste erscheint ein Band
  `Keine Verbindung zum Server - Wiederverbindung laeuft` in `--incorrect`;
  alle Tasten sind gesperrt, bis ein Snapshot eintrifft.
- **Befehl abgelehnt:** Kurzer Hinweis in der Bedienleiste mit dem
  Server-Klartext, drei Sekunden sichtbar. Der Zustand wird nie lokal
  "repariert" - es gilt der naechste Snapshot.

## Moderatoransicht - entworfen

Eigenes, textorientiertes Layout ohne Buehnenvorschau (Spezifikation 21):

```text
Frage 3/7 · Person · mittel
Fragetext gross
Loesung: Bundestagsadler
Hintergrund: ...
Naechster Schritt: Antworten einblenden
Punktestand: 100 : 100
```

Es gilt dasselbe Farbsystem und dieselbe Schrift; die Schriftgroessen stehen
hier in `rem`, weil das iPad kein Buehnenbild ist.
