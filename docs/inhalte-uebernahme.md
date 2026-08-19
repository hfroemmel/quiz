# Uebernahme des Original-Fragenkatalogs

Der gelieferte Katalog ist uebernommen: `content/source` traegt seit dieser
Fassung die 199 echten Fragen. Das frueher mitgelieferte Beispielpaket ist
entfallen.

Der Ablauf und die Werkzeuge stehen in [`docs/inhalte-import.md`](inhalte-import.md);
diese Datei haelt fest, was der konkrete Katalog braucht.

```bash
pnpm content:migrate <pfad>/questions.js   # erzeugt content/migrated/ + Bericht
```

## Was der Katalog enthaelt

| Groesse | Wert |
|---|---|
| Eintraege | 199 |
| uebernommen | 199 |
| Bilderkennen (`image-reveal`) | 64 |
| Bildgestuetzte Auswahl (`image-choice`) | 128 |
| Reine Textauswahl (`text-choice`) | 7 |
| Schwierigkeiten | leicht 63, mittel 85, schwer 51 |
| Modi | Erwachsene 143, Kinder 56 |
| Kategorien | 12 |
| Wiederholungsgruppen erkannt | 8 |
| referenzierte Bilddateien | 156 |

Verteilung der Kategorien: Saarbruecken 64, Institution 36, Person 24, Gebaeude 18,
Geschichte 13, Aemter 12, Recht 10, Wahl 9, Begriffe 5, Kurioses 4, Erdkunde 2,
Fahnen und Symbole 2.

## Was die Migration selbst korrigiert

| Fall | Behandlung |
|---|---|
| `level` statt `difficulty` | uebernommen, im Bericht vermerkt |
| `mittel` / `Kids` | auf `medium` / `kids` normalisiert, im Bericht vermerkt |
| `img_filename`, `img_credit` | Datei und Bildnachweis am Medium hinterlegt |
| `source_reference` | inhaltliche Quellenangabe an der Erlaeuterung, **nicht** als Bildnachweis |
| `playCount` | verworfen - Nutzungen fuehrt der Server |
| einzige Option beim Bilderkennen | wird zur erwarteten Antwort, **nicht** zu einer sichtbaren Antwortleiste |
| IDs mit Umlauten | normalisiert (`Saarbrücken` zu `saarbruecken`) |

Die Umwandlung der einzigen Legacy-Option ist der wichtigste Punkt: Beim
Bilderkennen gibt es keine Auswahl. Waere die Option erhalten geblieben, stuende
die Loesung von der ersten Sekunde an auf der Buehne.

## Fehlende Bilder: Ersatzbild statt Blockade

Die 156 Bilddateien des Katalogs liegen noch nicht vor. Statt darauf zu warten,
laeuft die Entwicklung mit einem erzeugten Ersatzbild:

| Ebene | Verhalten |
|---|---|
| Validierung | `pnpm content:validate` meldet eine fehlende Datei weiterhin als **Fehler** |
| Validierung mit `--placeholder-media` | meldet sie als Warnung; dafuer gibt es `pnpm content:validate:dev` und `pnpm content:build:dev` |
| Server | liefert unter der Asset-Adresse ein erzeugtes SVG mit dem gesuchten Dateinamen aus |
| Operator | bekommt fuer jede fehlende Datei eine Warnung in der Diagnose |

Damit ist die Luecke sichtbar, aber nicht blockierend. Sobald die Bilder unter
`content/source/assets/questions/` liegen, verschwinden Warnung und Ersatzbild ohne
weitere Aenderung - die Dateinamen stehen bereits in `assets.json`.

Der Livebetrieb bleibt geschuetzt: `pnpm build` verwendet die strenge Pruefung
und bricht bei fehlenden Medien ab.

## Was noch menschliche Entscheidung braucht

1. **Richtige Antwort.** In den Altdaten ist `option_1` immer die richtige
   Antwort. Die Migration uebersetzt das genau einmal in eine explizite
   `correctOptionId`; beim Bau werden die Optionen gemischt. Eine Stichprobe
   sollte das bestaetigen, bevor das Paket in den Livebetrieb geht.

2. **16 Bilder ohne Bildnachweis.** Vor einer Veranstaltung ist zu klaeren, ob
   sie ohne Nachweis gezeigt werden duerfen.

3. **Eine Frage ist deaktiviert.** Frage 151 ("Sprachgrenze im Saarland") hat nur
   drei statt vier Antwortoptionen. Sie steht als Vorlage im Bestand, ist aber
   `enabled: false` und wird nicht gespielt. Sobald die vierte Option ergaenzt
   ist, genuegt das Umschalten des Feldes.

4. **Zwei Fragen mit doppeltem Antworttext** und 42 Fragen ohne Erklaerungstext
   sind als Warnung im Bericht vermerkt - beides ist redaktionell, nicht technisch.

5. **Modus Saarbruecken** - bestaetigt: Der Modus zieht seine Fragen ueber die
   Kategorie `saarbruecken` aus beiden Legacy-Modi (64 Fragen). An den Fragen ist
   dafuer nichts zu aendern.

## Fragenplaetze der Presets

Die sieben Plaetze je Spiel sind auf den echten Bestand ausgelegt. Kein Platz
hat weniger als acht Kandidaten - die Validierung meldet keine knappen Pools.

| Preset | Modi | Aufbau der Plaetze |
|---|---|---|
| `easy` | Erwachsene, Kinder | Einstieg leicht, Wissen leicht, Bilderkennen, Vertiefung, Steigerung, Bildauswahl, Finale |
| `medium` | Erwachsene | Einstieg leicht, Wissen mittel, Bilderkennen, Parlament und Personen, Steigerung, Bildauswahl, Finale schwer |
| `hard` | Erwachsene | wie `medium`, aber durchgehend eine Stufe haerter |
| `mixed` | Erwachsene, Kinder | ohne Schwierigkeitsfilter, gemischt nach Typ und Kategorie |
| `regional` | Saarbruecken | sieben Plaetze innerhalb der Kategorie Saarbruecken |

Platz 1 ist immer eine Auswahlfrage und Platz 3 immer eine Bilderkennen-Frage.
Darauf verlassen sich die End-to-End-Tests; wer die Reihenfolge aendert, zieht
sie mit.

## Wenn die Bilder eintreffen

1. Dateien nach `content/source/assets/questions/` legen - die Namen stehen in
   `content/source/assets.json`
2. `pnpm content:validate` (ohne Flag) ausfuehren; die Warnungen zu fehlenden
   Medien muessen verschwinden
3. `pnpm content:build`

Ein erneuter Migrationslauf ist dafuer nicht noetig.
