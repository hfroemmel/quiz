# Neue Zielgruppen, Pools und Schwierigkeits-Presets

Zielgruppen, Fragenpools und Presets sind reine Konfiguration in
`content/source/config.json`. In der Engine gibt es dafuer **keinen**
Sondercode - insbesondere nicht fuer `kids` oder `Saarbruecken`.

Seit Schema v2 sind die drei Achsen getrennt:

* **Zielgruppe** (`audiences`): fuer wen gespielt wird. Sie traegt Theme,
  Startgrafik und die erlaubten Presets.
* **Fragenpool** (`pools`): welcher Inhaltsbestand gezogen wird. Die Fragen
  nennen ihre Pools selbst (`poolIds`); welche Pools ein Spiel zieht,
  entscheidet `START_GAME` - ohne Angabe spielen alle mit.
* **Preset**: die dramaturgische Ablaufkonfiguration der Fragenplaetze.

## Neue Zielgruppe anlegen

1. Optional ein Theme ergaenzen:

```jsonc
{
  "id": "senioren",
  "label": "Seniorenquiz",
  "logoAssetId": "logo-senioren"
}
```

Ein Theme kann ueber `skin` waehlen, in welcher **Gestaltungswelt** es steht:
`default` (die Buehne, Voreinstellung) oder `kids` (die illustrierte
Karlchen-Welt). Mehr Welten gibt es nicht - eine neue braeuchte eigene
Zeichnungen und eigene Regeln in jedem Bauteilmodul.

Farben und Schriften stehen NICHT im Quizpaket: Darstellung ist Sache des
Gastgebers und kommt aus der Theme-Schicht der Oberflaeche (`quiz-themes`,
Werte aus `packages/contracts/src/theme.ts`). Das Paket nennt nur die Welt.

Eine Zielgruppe ohne eigene Gestaltungswuensche verweist einfach auf ein
vorhandenes Theme (`"themeId": "default"`).

2. Die Zielgruppe ergaenzen:

```jsonc
{
  "id": "senioren",
  "label": "Senioren",
  "themeId": "senioren",
  "startVisualAssetId": "start-senioren",
  "allowedPresetIds": ["easy", "mixed"]
}
```

3. Fragen der Zielgruppe zuordnen (`"audiences": ["senioren"]`).
4. `pnpm content:validate && pnpm content:build`.

Die Zielgruppe erscheint danach automatisch in der Startansicht des Operators -
die Liste kommt aus `view.catalog` und damit aus validierter Konfiguration,
nicht aus UI-Konstanten.

## Regionale Auswahl: ein Pool, kein Sondercode

`Saarbruecken` ist ein **Fragenpool**. Die regionalen Fragen tragen
`"poolIds": ["saarbruecken"]`, alle uebrigen `"poolIds": ["bundestag"]`; der
Pool selbst steht mit Kennung und Beschriftung in `pools`. Ein regionales Spiel
startet der Operator als Zielgruppe seiner Wahl plus Pool `Saarbrücken` plus
Preset `regional` - Theme und Spielregeln bleiben unveraendert.

Ein neuer Pool braucht damit drei Handgriffe: Eintrag in `pools`, `poolIds` an
den Fragen, fertig. Die Startansicht des Operators zeigt die Poolauswahl von
selbst, sobald es mehr als einen Pool gibt.

## Presets fuer das Touchgeraet

Am Touchgeraet gibt es niemanden, der eine muendliche Antwort bewerten koennte.
Ein Preset ist dort deshalb nur spielbar, wenn **jeder** Fragenplatz auf
auswertbare Fragen filtert:

```jsonc
{
  "id": "touch-easy",
  "label": "Leicht",
  "slots": [
    {
      "id": "einstieg",
      "label": "Einstieg",
      "filters": {
        "difficultyIds": ["easy"],
        "evaluationModes": ["option-comparison"]
      }
    }
    // ... weitere Plaetze, jeder mit "evaluationModes"
  ]
}
```

Die Eignung wird aus den Filtern abgeleitet, nicht zusaetzlich erklaert - eine
zweite Angabe koennte davon abweichen. Der Validierungsbericht weist sie je
Preset aus („Fuer das Touchgeraet geeignet"), und die Startansicht am Geraet
bekommt ausschliesslich geeignete Presets in ihren Katalog.

Ein Bilderkennen-Fragenplatz gehoert nur dann in ein Touch-Preset, wenn die
Fragen dort Antwortoptionen haben: Die Enthuellung laeuft, ein Tipp friert sie
ein. Muendlich zu beantwortende Bildfragen werden im Selbstbedienungsbetrieb
uebersprungen.

## Neues Preset anlegen

Ein Preset ist eine **dramaturgische Ablaufkonfiguration**, kein globaler Filter.
`easy` darf deshalb einzelne mittelschwere Fragenplaetze enthalten.

```jsonc
{
  "id": "kurzformat",
  "label": "Kurzformat",
  "slots": [
    { "id": "einstieg",     "filters": { "difficultyIds": ["easy"], "questionTypes": ["text-choice"] } },
    { "id": "wissen",       "filters": { "categoryIds": ["wissenschaft", "natur"] } },
    { "id": "bilderkennen", "filters": { "questionTypes": ["image-reveal"] } },
    { "id": "mittelfeld",   "filters": { "difficultyIds": ["medium"] } },
    { "id": "steigerung",   "filters": { "difficultyIds": ["hard"] } },
    { "id": "bildauswahl",  "filters": { "questionTypes": ["image-choice"] } },
    { "id": "finale",       "filters": {} }
  ]
}
```

Regeln:

* Die Anzahl der Slots muss `questionsPerGame` entsprechen; sonst bricht der Build ab.
* Fehlende Filter bedeuten „beliebig“.
* Slots mit **identischem** Filter konkurrieren um denselben Bestand. Unterschiedliche
  Filter erhoehen die Zahl wiederholungsfreier Spiele deutlich.
* Der Preset-Name ist kein automatischer Filter.

Danach das Preset in `allowedPresetIds` der gewuenschten Zielgruppen eintragen und
`pnpm content:validate` ausfuehren. Nicht erfuellbare Fragenplaetze sind harte Fehler,
zu kleine Bestaende erzeugen Warnungen mit konkreter Kandidatenzahl.

## Fragenanzahl aendern

`questionsPerGame` in `config.json` anpassen und **alle** Presets auf dieselbe
Slotzahl bringen. Die Zahl ist nirgends sonst hart codiert: UI, Server und Datenmodell
lesen sie aus der Konfiguration.
