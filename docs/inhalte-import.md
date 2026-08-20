# Import und Validierung

## Ablauf

```text
Google Sheet
  → finale redaktionelle Uebergabe
  → KI-gestuetzte Rechtschreib- und Typopruefung
  → MENSCHLICHE FREIGABE
  → Import und Normalisierung
  → strenge Validierung
  → versioniertes Quizpaket
  → Anwendungs-Build
```

KI-Vorschlaege duerfen nicht ungeprueft uebernommen werden: Eigennamen, politische
Begriffe, historische Schreibweisen und absichtlich falsche Antwortoptionen wuerden
sonst stillschweigend veraendert.

## Befehle

```bash
pnpm content:fetch      # optional: Rohdaten aus einer freigegebenen Sheet-Quelle holen
pnpm content:validate   # Pflicht: Schema, Referenzen, Medien, Poolabdeckung
pnpm content:build      # normalisiertes, versioniertes Paket erzeugen
pnpm build              # Anwendung mit der freigegebenen Paketversion bauen
```

`content:fetch` schreibt ausschliesslich nach `content/incoming/` und **nie** direkt
nach `content/source/`. Ohne `QUIZ_SHEET_CSV_URL` tut es nichts - der Offline-Build
funktioniert unveraendert.

Ein Build der Veranstaltungssoftware haengt zur Laufzeit nie von Google Sheets ab.

## Validierungsstufen

**Fehler - der Build bricht ab:**

fehlende oder doppelte Frage-ID · unbekannter Fragetyp · ungueltige Schwierigkeits-,
Kategorie- oder Modusreferenz · fehlender Fragetext · Multiple Choice ohne korrekte
Option · `correctOptionId` zeigt auf keine Option · falsche Optionsanzahl bei
Fragetypen, die genau vier verlangen · fehlendes Pflichtmedium · nicht vorhandene
Mediendatei einer aktiven Frage · nicht erfuellbarer Fragenplatz · ungueltige Preset-
oder Theme-Referenz · nicht parsebare Versionsangabe.

**Warnung - bewusste Freigabe erforderlich:**

fehlender Erklaerungstext · fehlender Bildnachweis · sehr langer Frage- oder
Antworttext · fast identische Fragen ohne gemeinsame Wiederholungsgruppe · identische
Antwortoptionen · sehr kleiner Kandidatenpool · verwaiste Medien · Fragen, die von
keinem Modus oder Preset erreichbar sind · ungenutzte Kategorien · ungewoehnliche
Gross-/Kleinschreibung von IDs · fehlende Mediendatei einer **deaktivierten** Frage.

## Bericht

`pnpm content:validate` schreibt `content/reports/validation.md`,
`pnpm content:build` zusaetzlich `content/reports/build.md`. Der Bericht enthaelt:

* Gesamtzahlen nach Modus, Schwierigkeit, Typ und Kategorie
* Fehler und Warnungen mit Frage-ID
* Poolabdeckung pro Modus, Preset und Fragenplatz
* Zahl der Wiederholungsgruppen und moeglicher Spiele ohne Wiederholung
* Medienstatus
* Vergleich zur vorherigen Paketversion

### Wie „Spiele ohne Wiederholung“ berechnet wird

Fragenplaetze mit identischem Filter konkurrieren um denselben Pool. Fuer eine solche
Gruppe aus `k` Plaetzen und `g` eindeutigen Wiederholungsgruppen sind `floor(g / k)`
Spiele moeglich; massgeblich ist das Minimum ueber alle Gruppen. Die Zahl ist bewusst
konservativ - ein Auswahlalgorithmus kann einen zu kleinen Pool nicht kaschieren.

## Legacy-Migration

```bash
pnpm content:migrate pfad/zu/questions.js pfad/zu/config.js
```

Der Migrationscode fuehrt die Legacy-Dateien **nicht** aus. Er liest ausschliesslich
Literale (`packages/content/src/legacy/parseLiteral.ts`); ein Funktionsaufruf oder ein
Template-Literal fuehrt zu einem klaren Fehler statt zu einem Seiteneffekt.

Ergebnis liegt unter `content/migrated/` und wird bewusst **nicht** automatisch nach
`content/source/` uebernommen. Der Bericht `migration-report.md` nennt:

* automatisch normalisierte Werte (`Kids` → `kids`, `mittel` → `medium`, IDs, Umlaute) -
  korrigiert, aber niemals still;
* erkannte Wiederholungsgruppen bei gleichem Fragetext - zur Bestaetigung;
* aus `option_1` abgeleitete richtige Antworten - zur Stichprobe;
* nicht uebernommene Fragen mit Begruendung;
* abweichende Fragenplatzzahlen der Legacy-Presets (z. B. acht statt sieben).

`playCount` wird verworfen: Laufzeitdaten gehoeren nicht in den Inhalt.

## Medien vorbereiten

Unter `content/source/assets/questions/` liegt das echte Bildmaterial des
uebernommenen Katalogs. `pnpm content:assets` erzeugt abstrakte Platzhalter-Grafiken
und ist damit nur noch fuer neue, noch unbebilderte Fragen gedacht - es ueberschreibt
vorhandene Dateien nicht. Ein neues Bild kommt unter denselben Dateinamen oder
bekommt einen eigenen Eintrag in `assets.json`.

Videos liegen unter `content/source/assets/video/`. Sie werden wie Bilder ueber
`assets.json` eingetragen (`"kind": "video"`) und ueber `media.videoAssetId` an eine
Frage gehaengt.
