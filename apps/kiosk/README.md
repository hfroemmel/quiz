# @quiz/kiosk

**Verantwortung:** Das Quiz als alleinstehendes Spiel auf einem Touchgeraet.
Ein Electron-Vollbildfenster, mehr nicht.

```bash
pnpm build:kiosk     # Web-Build, Inhaltsvalidierung und Hauptprozess
pnpm dev:kiosk       # native Module neu bauen, Hauptprozess bauen, starten
```

| Variable | Bedeutung | Standard |
|---|---|---|
| `QUIZ_KIOSK_MODE` | Quizmodus des Geraets | `adults` |
| `QUIZ_KIOSK_IDLE_SECONDS` | Leerlauf-Aufsicht | `120` |
| `QUIZ_DB` | SQLite-Datei | `runtime/quiz.sqlite` |
| `QUIZ_PACKAGE_DIR` | Quizpaket | `content/dist` |

## Was hier bewusst fehlt

* **Kein Operatorfenster, kein Menue, keine LAN-Freigabe.** Der Server laeuft auf
  `127.0.0.1`. Das ist keine Vorsichtsmassnahme, sondern Voraussetzung: Die
  Spielerrolle wird ausschliesslich ueber Loopback angenommen. Ein Kioskgeraet
  oeffnet damit keinen Zugang zum laufenden Spiel ins Netz.
* **Keine Preload-Bruecke.** Die Spieleransicht braucht keine Fensterfunktionen.
* **Kein eigener Renderer-Build.** Das Fenster laedt `/play` vom lokalen Server -
  dieselbe Auslieferung, die auch Operator und Buehne bekommen.

## Betrieb

Am Geraet wird zweierlei gewaehlt: wie viele spielen und wie schwer. Der Modus
gehoert zur Aufstellung und steht in `QUIZ_KIOSK_MODE`.

Zur Wahl stehen nur Schwierigkeitsstufen, die ohne Operator spielbar sind - also
Presets, deren Fragenplaetze ausschliesslich auswertbare Fragen zulassen
(`evaluationModes: ["option-comparison"]`). Der Validierungsbericht weist das je
Preset aus: „Fuer das Touchgeraet geeignet".

Beruehrt waehrend eines Spiels laenger als `QUIZ_KIOSK_IDLE_SECONDS` niemand den
Bildschirm, wird das Spiel abgebrochen und die Auswahl kehrt zurueck. Ohne diese
Aufsicht bliebe das Geraet mit einer offenen Frage stehen - auf einer Frage liegt
bewusst kein Zeitdruck.

Der Veranstaltungstag wechselt automatisch. Die Wiederholungsvermeidung arbeitet
damit pro Geraet und Tag.
