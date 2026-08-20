# Neue Quizmodi und Schwierigkeits-Presets

Modi und Presets sind reine Konfiguration in `content/source/config.json`. In der
Engine gibt es dafuer **keinen** Sondercode - insbesondere nicht fuer `kids` oder
`Saarbruecken`.

## Neuen Quizmodus anlegen

1. Optional ein Theme ergaenzen:

```jsonc
{
  "id": "senioren",
  "label": "Seniorenquiz",
  "colors": { "background": "#101418", "accent": "#e8b84b", "…": "…" },
  "logoAssetId": "logo-senioren"
}
```

Ein Theme kann ueber `skin` waehlen, in welcher **Gestaltungswelt** es steht:
`default` (die Buehne, Voreinstellung) oder `kids` (die illustrierte
Karlchen-Welt). Mehr Welten gibt es nicht - eine neue braeuchte eigene
Zeichnungen und eigene Regeln in jedem Bauteilmodul. Wer nur andere Farben will,
braucht kein `skin`, sondern nur eigene `colors`.

Ein Modus ohne eigene Farbwuensche verweist einfach auf ein vorhandenes Theme;
so macht es `Saarbruecken` mit `"themeId": "default"`.

2. Den Modus ergaenzen:

```jsonc
{
  "id": "senioren",
  "label": "Senioren",
  "questionFilter": { "categoryIds": [], "tags": [] },
  "themeId": "senioren",
  "startVisualAssetId": "start-senioren",
  "allowedPresetIds": ["easy", "mixed"]
}
```

3. Fragen dem Modus zuordnen (`"modeIds": ["senioren"]`).
4. `pnpm content:validate && pnpm content:build`.

Der Modus erscheint danach automatisch in der Startansicht des Operators - die Liste
kommt aus `view.catalog` und damit aus validierter Konfiguration, nicht aus
UI-Konstanten.

## Regionale Auswahl ohne Sondercode

In den Altdaten sind `adults` und `kids` Werte des Feldes `mode`, `Saarbruecken`
dagegen eine Kategorie. Beides laesst sich mit demselben Mechanismus abbilden: Ein
Modus ist ein konfigurierter Filter.

```jsonc
{
  "id": "saarbruecken",
  "label": "Saarbrücken",
  "questionFilter": { "legacyModes": ["adults", "kids"], "categoryIds": ["saarbruecken"] },
  "themeId": "default",
  "allowedPresetIds": ["regional"]
}
```

`legacyModes` erlaubt, Fragen mitzunehmen, die noch die alten Modus-IDs tragen.

## Neues Preset anlegen

Ein Preset ist eine **dramaturgische Ablaufkonfiguration**, kein globaler Filter.
`easy` darf deshalb einzelne mittelschwere Fragenplaetze enthalten.

```jsonc
{
  "id": "kurzformat",
  "label": "Kurzformat",
  "slots": [
    { "id": "einstieg",     "filters": { "difficultyIds": ["easy"], "presentationTypes": ["text-choice"] } },
    { "id": "wissen",       "filters": { "categoryIds": ["wissenschaft", "natur"] } },
    { "id": "bilderkennen", "filters": { "presentationTypes": ["image-reveal"] } },
    { "id": "mittelfeld",   "filters": { "difficultyIds": ["medium"] } },
    { "id": "steigerung",   "filters": { "difficultyIds": ["hard"] } },
    { "id": "bildauswahl",  "filters": { "presentationTypes": ["image-choice"] } },
    { "id": "finale",       "filters": { "categoryIds": ["saarbruecken"] } }
  ]
}
```

Regeln:

* Die Anzahl der Slots muss `questionsPerGame` entsprechen; sonst bricht der Build ab.
* Fehlende Filter bedeuten „beliebig“.
* Slots mit **identischem** Filter konkurrieren um denselben Pool. Unterschiedliche
  Filter erhoehen die Zahl wiederholungsfreier Spiele deutlich.
* Der Preset-Name ist kein automatischer Filter.

Danach das Preset in `allowedPresetIds` der gewuenschten Modi eintragen und
`pnpm content:validate` ausfuehren. Nicht erfuellbare Fragenplaetze sind harte Fehler,
zu kleine Pools erzeugen Warnungen mit konkreter Kandidatenzahl.

## Fragenanzahl aendern

`questionsPerGame` in `config.json` anpassen und **alle** Presets auf dieselbe
Slotzahl bringen. Die Zahl ist nirgends sonst hart codiert: UI, Server und Datenmodell
lesen sie aus der Konfiguration.
