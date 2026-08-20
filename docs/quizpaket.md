# Quizpaket: Schema und Beispiel

Ein Quizpaket ist die **einzige** Quelle, aus der der Server zur Laufzeit Inhalte
laedt. Es entsteht aus `content/source/` und liegt gebaut unter `content/dist/`.

```text
content/dist/
  manifest.json     Version, Zeitstempel, Medienliste, Pruefsumme
  config.json       Modi, Presets, Themes, Kategorien, Schwierigkeiten
  questions.json    alle Fragen, nach ID sortiert
  assets.json       Medienverzeichnis
  assets/           Bilder und Videos
```

## Manifest

```jsonc
{
  "schemaVersion": "1.0.0",
  "contentVersion": "1.0.1",
  "createdAt": "2026-08-18T05:36:00.000Z",
  "questionsFile": "questions.json",
  "configFile": "config.json",
  "assets": [ /* MediaAsset[] */ ],
  "checksum": "…"          // schuetzt vor stillen Aenderungen am gebauten Paket
}
```

Passt die Pruefsumme nicht, verweigert der Server das Laden mit einer Klartextmeldung.
Damit ist die verbotene Praxis „gebautes Basis-JSON waehrend der Show direkt
bearbeiten“ technisch erkennbar. Live-Korrekturen laufen stattdessen ueber Hotfixes.

## Frage

```jsonc
{
  "id": "a-m-02",
  "repetitionGroupId": "hauptstadt-australien",   // optional: inhaltlich gleiche Varianten
  "modeIds": ["adults"],
  "difficultyId": "medium",
  "categoryIds": ["geografie"],
  "tags": [],

  "prompt": "Welche Stadt ist die Hauptstadt Australiens?",
  "presentationType": "text-choice",              // text-choice | image-choice | person | image-reveal | video-then-question
  "evaluationMode": "option-comparison",          // option-comparison | manual-correct-incorrect

  "options": [
    { "id": "o1", "text": "Sydney" },
    { "id": "o2", "text": "Melbourne" },
    { "id": "o3", "text": "Perth" },
    { "id": "o4", "text": "Canberra" }
  ],
  "correctOptionId": "o4",                        // IMMER explizit, nie ueber die Position
  "acceptedAnswerText": ["Canberra"],             // fuer muendliche Antworten

  "media": { "imageAssetId": "img-…", "videoAssetId": "vid-…" },

  "explanation": {
    "summary": "Kurztext - darf oeffentlich in der Loesung erscheinen",
    "details": "Hintergrund - nur Operator und Moderator",
    "source": "Quellenangabe - nur intern",
    "moderatorNotes": "Regiehinweis - nur intern"
  },
  "enabled": true
}
```

Wichtig:

* **`correctOptionId` ist Pflicht** bei `option-comparison`. Die Legacy-Annahme
  „`option_1` ist richtig“ gibt es nicht mehr. Die sichtbare Reihenfolge wird pro Spiel
  gemischt, ohne die Auswertung zu beruehren.
* Von `explanation` wird ausschliesslich `summary` oeffentlich gezeigt - und auch nur
  in der Loesungsszene. `details`, `source` und `moderatorNotes` verlassen den Server
  nie in Richtung Buehnenscreen.
* Laufzeitdaten gehoeren nicht in den Inhalt. Das Legacy-Feld `playCount` wird bewusst
  nicht uebernommen; Nutzungen leben in der `QuestionUsage`-Historie der Datenbank.

## Medium

```jsonc
{
  "id": "img-bauwerk-brandenburger-tor",
  "kind": "image",                       // image | video | audio
  "filename": "images/img-bauwerk-brandenburger-tor.svg",   // relativ, ohne ".."
  "mimeType": "image/svg+xml",
  "credit": "Bildnachweis",
  "sourceUrl": "https://…",
  "checksum": "…"                        // beim Build ergaenzt
}
```

Medien werden ausschliesslich ueber ihre **Asset-ID** referenziert. Der Server liefert
sie unter `/media/<assetId>` aus und prueft dabei, dass der aufgeloeste Pfad innerhalb
des Asset-Verzeichnisses liegt. Dateinamen aus Quizdaten koennen so niemals auf
beliebige lokale Dateien zeigen.

## Konfiguration

```jsonc
{
  "questionsPerGame": 7,                 // genau eine Quelle der Wahrheit
  "difficulties": [{ "id": "easy", "label": "Leicht" }],
  "categories":   [{ "id": "geografie", "label": "Geografie" }],
  "themes": [{
    "id": "kids",
    "label": "Kinderquiz",
    "colors": { "background": "#10233a", "accent": "#ffd93d" },
    "logoAssetId": "logo-kids",
    "typography": { "headingFont": "…", "bodyFont": "…" }
  }],
  "presets": [{
    "id": "medium",
    "label": "Mittel",
    "slots": [
      { "id": "einstieg", "filters": { "difficultyIds": ["easy"], "presentationTypes": ["text-choice"] } }
      // … genau questionsPerGame Eintraege
    ]
  }],
  "modes": [{
    "id": "kids",
    "label": "Kinder",
    "questionFilter": { "categoryIds": [], "tags": [] },
    "themeId": "kids",
    "startVisualAssetId": "start-kids",
    "allowedPresetIds": ["easy", "mixed"]
  }]
}
```

Fehlende Filter bedeuten „beliebig“. Ein Sonderwert wie der String `random` ist
deshalb nicht noetig.
