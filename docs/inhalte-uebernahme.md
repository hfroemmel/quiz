# Uebernahme des Original-Fragenkatalogs

Stand der Migration des gelieferten Katalogs `questions.js` in das Quizpaket.
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

## Was menschliche Entscheidung braucht

1. **156 Bilddateien fehlen.** Der Katalog verweist auf `.jpg`, `.jpeg` und `.png`
   (zum Beispiel `1.1.reichstagsgebaeude.jpg`, `europe-1395916_1920.jpg`). In der
   gelieferten Bildzulieferung waren nur die beiden Startgrafiken enthalten.
   Ohne diese Dateien sind 192 der 199 Fragen nicht spielbar; die Validierung
   meldet fuer aktive Fragen zu Recht einen Fehler.
   Die vollstaendige Dateiliste erzeugt:

   ```bash
   pnpm content:migrate <pfad>/questions.js
   node -e "console.log(require('./content/migrated/assets.json').map(a=>a.filename).join('\n'))"
   ```

2. **Richtige Antwort.** In den Altdaten ist `option_1` immer die richtige
   Antwort. Die Migration uebersetzt das genau einmal in eine explizite
   `correctOptionId` und mischt die Optionen danach beim Bau. Eine Stichprobe
   sollte das bestaetigen, bevor das Paket in den Livebetrieb geht.

3. **Bildnachweise.** 16 Bilder haben keinen Nachweis. Vor einer Veranstaltung
   ist zu klaeren, ob sie ohne Nachweis gezeigt werden duerfen.

4. **Kategorien im Quizpaket.** Die Konfiguration fuehrt derzeit acht Kategorien
   des Beispielpakets. Sie wird bei der Uebernahme durch die zwoelf echten
   Kategorien ersetzt; die Fragenplatzregeln der Presets sind entsprechend
   nachzuziehen.

5. **Modus Saarbruecken.** Der Katalog kennt nur `adults` und `kids`. Der dritte
   Modus entsteht bereits ueber die Konfiguration: `questionFilter` waehlt
   Fragen der Kategorie `saarbruecken` aus beiden Legacy-Modi. Das sind 64
   Fragen - genug fuer mehrere Spiele ohne Wiederholung. Es ist keine Aenderung
   an den Fragen noetig, nur die Bestaetigung, dass diese Auslegung gewuenscht ist.

## Warum das Beispielpaket noch im Bestand liegt

`content/source` traegt weiterhin das Beispielpaket, damit Anwendung und Tests
lauffaehig bleiben. Die Uebernahme des echten Katalogs erfolgt in einem Zug,
sobald die Bilddateien vorliegen:

1. Bilddateien nach `content/source/assets/images/` legen
2. `pnpm content:migrate` erneut ausfuehren und den Bericht durchsehen
3. `content/migrated/questions.json` und `assets.json` nach `content/source`
   uebernehmen, Kategorien und Presets in `config.json` nachziehen
4. `pnpm content:validate` - danach `pnpm content:build`

Der Zwischenstand unter `content/migrated/` wird bewusst nicht eingecheckt: Er
ist ein Vorschlag, kein freigegebener Inhalt.
