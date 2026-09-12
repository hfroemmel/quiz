# Operator-Kurzanleitung fuer den Live-Betrieb

## Vor der Veranstaltung

1. `pnpm content:validate` - keine Fehler, Warnungen bewusst gelesen.
2. `pnpm content:build` - Paketversion notieren.
3. Anwendung starten (`pnpm dev:desktop` oder `pnpm server` plus Browser).
4. Beamer anschliessen, Praesentationsfenster auf das zweite Display legen,
   `Bühne Vollbild` druecken.
5. Buzzer testen: Taste `A` = Spieler 1, Taste `B` = Spieler 2.
6. Ton testen (`Ton an` im Kopfbereich).
7. Falls ein Moderator dabei ist: Session-Code aus „Technik, Protokoll und
   Verbindung“ ablesen und am iPad eingeben.

## Ein Spiel

| Schritt | Aktion |
|---|---|
| 1 | Quizmodus und Schwierigkeits-Preset waehlen |
| 2 | `Spiel starten` |
| 3 | Frage steht - der Moderator liest sie vor |
| 4 | `Antworten einblenden` bzw. `Enthüllung starten` - erst jetzt darf gebuzzert werden |
| 5 | Spieler buzzert - oder `… manuell auswaehlen`, falls die Hardware klemmt |
| 6 | Genannte Antwort einloggen (Buchstabe anklicken oder `Antwort war richtig/falsch`) |
| 7 | `Auflösen und bewerten` |
| 8 | `Weiter zur nächsten Frage` |
| 9 | Nach der siebten Frage: `Weiter zum Ergebnis` |
| 10 | `Zurück zur Startansicht` fuer das naechste Spielpaar |

Wie viele Spiele in welchem Modus schon gelaufen sind, steht hinter der Taste
`Spielprotokoll` rechts unten in der Fusszeile. Die Zahlen liegen in der
Datenbank und bleiben deshalb auch nach einem Neustart erhalten.

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

* Das Bild steht zuerst vollstaendig verdeckt; es deckt sich erst nach
  `Enthüllung starten` auf. Die Vorlesezeit kostet also keine Sekunde.
* Die Enthuellung laeuft dann zehn Sekunden.
* Ein gueltiger Buzzer friert das Bild sofort ein.
* Nach einer falschen Antwort laeuft die Enthuellung an derselben Stelle weiter,
  **beide** Spieler duerfen erneut buzzern - beliebig oft.
* Auch nach dem vollstaendigen Aufdecken bleibt Buzzern erlaubt. Die zehn
  Sekunden sind eine Enthuellungsdauer, kein Antwortlimit.
* `Bild vollständig aufdecken` deckt sofort auf und sperrt den Buzzer **nicht**.
* `Enthüllung auf Anfang zurücksetzen` ist eine technische Korrektur und bewusst
  etwas anderes als `zurücksetzen`.

## Videofragen

Es gibt **einen** Knopf: `Video starten`. Er spielt das Video auf der Buehne von
vorn ab. Pausieren und Springen gibt es nicht - laeuft etwas schief, einfach
noch einmal `Video starten`; es beginnt dann wieder bei null. Waehrend der
Videophase ist der Buzzer gesperrt. Abgespielt wird nur auf der Buehne; am Pult
steht die Flaeche leer, damit die Komposition erkennbar bleibt.

**Am Pult steht nicht, wie es um das Video steht** - weder bereit noch laeuft
noch zu Ende. Das ist Absicht: Nichts davon wird gebraucht. Der Blick in den
Saal sagt es besser als jede Anzeige.

Am Ende passiert von selbst **nichts**; das letzte Bild bleibt stehen, bis
`Frage einblenden` gedrueckt wird, danach `Antworten einblenden`.

Bleibt die Flaeche schwarz, ist die Datei am Buehnenrechner das Problem.
Moeglichkeiten: noch einmal `Video starten`, ohne Video mit `Frage einblenden`
weitermachen, oder `Frage ueberspringen`.

## Wenn etwas schiefgeht

| Situation | Was tun |
|---|---|
| Falscher Spieler hat den Zuschlag | `zurücksetzen`, dann erneut freigeben |
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
