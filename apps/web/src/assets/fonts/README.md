# Schriftdateien

Die Schriften werden ueber `@font-face` in `apps/web/src/styles.css` eingebunden
und von Vite mitgebaut - **nie** ueber ein Netzwerk-CDN, weil die Anwendung
offline lauffaehig bleiben muss (Spezifikation 2).

## Was wovon benutzt wird

| Familie | Eingebundene Schnitte | Einsatz |
|---|---|---|
| **Melior** | `MeliorCom.ttf` (400), `-Bold` (700), `-Italic` | die Buehne: Rubrik, Frage, Antworten, Kachelwerte |
| **Noto Sans Display** | `-Regular` (400), `-SemiBold` (600), `-Bold` (700) | Bedienrahmen des Operators und Moderatoransicht |

Die uebrigen Schnitte der Noto-Familie liegen im Bestand, sind aber nicht
eingebunden. Jede eingebundene Datei landet im Build - deshalb wird nur geladen,
was auch verwendet wird.

## Aenderungen

* Buehnenschrift: `theme.typography` im Quizpaket (`content/source/config.json`)
  bzw. `--font-heading` als Fallback im Stylesheet.
* Schrift des Bedienrahmens: `--font-ui` im Stylesheet. Wer ueberall dieselbe
  Familie moechte, setzt dort `var(--font-body)`.

## Lizenz

Noto Sans Display steht unter der SIL Open Font License. Fuer Melior ist die
Lizenzlage noch zu klaeren, bevor die Anwendung ausgeliefert wird.
