---
"@hfroemmel/quiz-core": minor
"@hfroemmel/quiz-content": minor
"@hfroemmel/quiz-themes": minor
"@hfroemmel/quiz-react": minor
"@hfroemmel/quiz-kiosk": minor
---

**Mehrsprachigkeit.** Fragen, Medien und Beschriftungen lassen sich in weiteren
Sprachen hinterlegen; ein Umschalter im Startmenue erscheint, sobald mehr als
eine Sprache konfiguriert ist.

- `config.locales` meldet die Sprachen an - die erste ist die Grundsprache.
- Fragen tragen `translations` je Sprache (Text, Optionen, Medium, Erklaerung).
  Optionen werden EINZELN nach Bezeichner ersetzt, damit eine Uebersetzung die
  Wertung nicht verschieben kann.
- Alles mit einem `label` bekommt ein `labels`; Zielgruppen zusaetzlich
  `startTitles`.
- `config.interfaceStrings` uebersetzt die Oberflaeche. Die deutschen Fassungen
  stehen im Code (`standardTexte` in `@hfroemmel/quiz-react`), damit ein Quiz
  ohne einen einzigen Eintrag laeuft.
- Neuer Befehl `SET_LOCALE`; er greift wie `SET_SOUND_ENABLED` auch ohne
  laufendes Spiel. `QuizGame` nimmt `locale` als Vorgabe aus dem Config File.
- Was fehlt, faellt auf die Grundsprache zurueck; eine unbekannte Sprache wird
  auf sie zurueckgeholt statt abgewiesen.

**Video.** Ein durchgelaufenes Video geht jetzt in JEDEM Ablaufprofil von selbst
in die Frage ueber - bisher blieb im gefuehrten Spiel ein schwarzes Bild stehen,
bis der Operator umschaltete. Sein Knopf bleibt, um frueher umzuschalten. Das
Ende wird ausserdem geplant, sobald das Video laeuft und die Laufzeit bekannt
ist; bisher nur beim Melden der Laufzeit, was ein Video ohne Ende
zuruecklassen konnte. `videoTailMs` ist deshalb von `selfServiceTiming` nach
`gameTiming` gezogen.

Die Operatorvorschau zeigt an der Stelle des Videos die **Restzeit** statt eines
leeren Rechtecks. Im Saal steht sie nicht - dort laeuft das Bild.

**Inhaltspipeline.** `quiz-content import-sheet` macht aus einer Google-Tabelle
`questions.json`: Spaltenzuordnung als Konfigurationsdatei, `--print-headers`,
`--dry-run`, Zeilenfehler mit Zeilennummer statt Abbruch.
