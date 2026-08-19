# Operator-Kurzanleitung fuer den Live-Betrieb

## Vor der Veranstaltung

1. `pnpm content:validate` - keine Fehler, Warnungen bewusst gelesen.
2. `pnpm content:build` - Paketversion notieren.
3. Anwendung starten (`pnpm dev:desktop` oder `pnpm server` plus Browser).
4. Beamer anschliessen, Praesentationsfenster auf das zweite Display legen,
   `Buehne Vollbild` druecken.
5. Buzzer testen: Taste `A` = Spieler 1, Taste `B` = Spieler 2.
6. Ton testen (`Ton an` im Kopfbereich).
7. Falls ein Moderator dabei ist: Session-Code aus „Technik, Protokoll und
   Verbindung“ ablesen und am iPad eingeben.

## Ein Spiel

| Schritt | Aktion |
|---|---|
| 1 | Quizmodus und Schwierigkeits-Preset waehlen, Spielernamen eintragen |
| 2 | `Spiel starten` |
| 3 | Frage steht - der Moderator liest sie vor |
| 4 | `Antworten einblenden` bzw. `Enthuellung starten` - erst jetzt darf gebuzzert werden |
| 5 | Spieler buzzert - oder `… manuell auswaehlen`, falls die Hardware klemmt |
| 6 | Genannte Antwort einloggen (Buchstabe anklicken oder `Antwort war richtig/falsch`) |
| 7 | `Aufloesen und bewerten` |
| 8 | `Weiter zur naechsten Frage` |
| 9 | Nach der siebten Frage: `Weiter zum Ergebnis` |
| 10 | `Zurueck zur Startansicht` fuer das naechste Spielpaar |

Der private Bereich rechts neben der Buehnenflaeche zeigt jederzeit die richtige Antwort und die
Zusatzinformationen. Der Saal sieht davon nichts.

## Punkte

* Erste richtige Antwort: **100**
* Richtige zweite Chance: **50**
* Bilderkennen nach mindestens einem Fehlversuch: **50**
* Falsch, Passen, Aufloesen ohne Antwort: **0** - nie Abzug
* Manuelle Korrektur: `+50` / `−50` im Kopfbereich, auch auf der Ergebnisansicht.
  Der Stand faellt nicht unter null; jede Korrektur wird protokolliert.

## Bilderkennen

* Das Bild steht zuerst unscharf; die Uhr laeuft erst nach `Enthuellung starten`.
  Die Vorlesezeit kostet also keine Sekunde des Countdowns.
* Die Enthuellung laeuft dann zehn Sekunden.
* Ein gueltiger Buzzer friert Bild und Countdown sofort ein.
* Nach einer falschen Antwort laeuft die Enthuellung an derselben Stelle weiter,
  **beide** Spieler duerfen erneut buzzern - beliebig oft.
* Auch nach `0` bleibt Buzzern erlaubt. Der Countdown ist eine Enthuellungsdauer,
  kein Antwortlimit.
* `Bild vollstaendig aufdecken` deckt sofort auf und sperrt den Buzzer **nicht**.
* `Enthuellung auf Anfang zuruecksetzen` ist eine technische Korrektur und bewusst
  etwas anderes als `Buzzer zuruecksetzen`.

## Videofragen

Video bewusst starten (kein Autoplay), bei Bedarf pausieren, springen oder neu
starten. Waehrend des Videos ist der Buzzer gesperrt. Danach `Frage einblenden`,
dann `Antworten einblenden`.

Laesst sich ein Video nicht abspielen, erscheint eine Warnung im Diagnosebereich.
Sichere naechste Aktion: `Frage ueberspringen`.

## Wenn etwas schiefgeht

| Situation | Was tun |
|---|---|
| Falscher Spieler hat den Zuschlag | `Buzzer zuruecksetzen`, dann erneut freigeben |
| Buzzer reagiert nicht | `… manuell auswaehlen` verwenden - gleiche Regeln |
| Frage ist inhaltlich fehlerhaft | `Fehlerhafte Frage korrigieren` → `Frage ueberspringen` |
| Frage soll fuer den Rest des Abends raus | dort `Frage deaktivieren` |
| Tippfehler im Fragetext | dort Text korrigieren; „Jetzt uebernehmen“ nur, wenn die Frage gerade sichtbar ist |
| Praesentationsfenster ist weg | erneut oeffnen - das Spiel laeuft weiter, der Snapshot kommt sofort |
| Moderator-iPad ist weg | ignorieren - der Ein-Laptop-Betrieb ist vollstaendig |
| Anwendung wurde neu gestartet | Startansicht bietet „Spiel fortsetzen“ an; laufende Enthuellung kommt pausiert zurueck |
| Meldung „Der Spielstand hat sich geaendert“ | Ansicht ist bereits aktualisiert, Aktion einfach wiederholen |
| Meldung zum Speichern | keine weiteren Aktionen, Speicherort pruefen, Team informieren |

## Nach der Veranstaltung

* `Aenderungsbericht exportieren` im Diagnosebereich - listet jeden Live-Hotfix mit
  Frage-ID, Feld, altem und neuem Wert, Zeitpunkt, Grund und Basisversion.
* `runtime/` sichern, falls die Historie erhalten bleiben soll.
* Am naechsten Veranstaltungstag entweder automatisch (neuer Kalendertag) oder
  bewusst ueber „Neuen Veranstaltungstag beginnen“ starten.

## Tastatur

| Taste | Wirkung |
|---|---|
| `A` | Buzzer Spieler 1 (nur im Operatorfenster) |
| `B` | Buzzer Spieler 2 (nur im Operatorfenster) |
| `F` | Vollbild umschalten (im Buehnenfenster) |
| Doppelklick | Vollbild umschalten (im Buehnenfenster) |
