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

Darueber liegt seit der Quizauswahl am Pult eine vierte, zusammenfassende
Achse:

* **Quizart** (`quizzes`): das eine Angebot, das ein Operator vor dem Abend
  waehlt - „Bundestagsquiz“, „Kinderquiz“, „Bremen-Quiz“. Sie NENNT die drei
  Achsen darunter, sie ersetzt sie nicht.

## Quizart anlegen

```jsonc
{
  "id": "bremen",
  "label": "Bremen-Quiz",
  "subtitle": "Ein Quiz zur Freien Hansestadt",
  "audienceId": "adults",
  "themeId": "default",
  "poolIds": ["bremen"],
  "presetIds": ["medium"]
}
```

Regeln:

* `audienceId`, `themeId`, `poolIds` und `presetIds` muessen existieren; jedes
  Preset muss der Zielgruppe offenstehen. Alles andere ist ein harter
  Validierungsfehler.
* **Die Schwierigkeitswahl steht nicht als Schalter da**, sondern folgt aus
  `presetIds`: Genau ein Preset heisst „keine Wahl, dieses gilt“; mehrere heissen
  „der Operator waehlt“. Das Formular fragt `catalog.quizzes[].supportsDifficulty`
  und baut die Regel nicht nach.
* `defaultPresetId` ist die Voreinstellung der Wahl. Ohne Angabe gilt der erste
  Eintrag. Die Reihenfolge von `presetIds` ist die Reihenfolge des Angebots.
* Das Theme der Quizart gilt WAEHREND des Spiels und geht dem der Zielgruppe
  vor. Ohne Quizart - am Kioskgeraet etwa - bleibt es beim Theme der Zielgruppe.
  Es gibt also zu jedem Zeitpunkt genau eine Zuordnung.
* Eine bunte Karte auf der Buehne ist KEIN Theme. Die Angebotsuebersicht faerbt
  ihre Karten nach dem Quiz, das Quiz selbst laeuft im Theme aus dieser Zeile.

Der Server loest die Quizart beim Start auf (`resolveQuizMode`), schreibt
Zielgruppe, Pools und Preset in den Spielstand und liefert sie danach nur noch
aus. Weder Pult noch Buehne leiten daraus etwas ab.

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
