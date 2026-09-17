# Die Vorschau für den Kunden

Ein Ordner, der ohne Server läuft, auf einem kostenfreien Host, dauerhaft
erreichbar. Was der Kunde dort sieht, ist der Testaufbau (`harness/`) mit
den generierten Testfragen — nicht die Bühnenbedienung, die in `quiz-live`
liegt.

## Was der Build zusätzlich enthält

Der Entwicklungsserver bedient das Quizpaket über eine Middleware
(`harness/vite.config.ts`). Ein statischer Host hat keine Middleware, also
legt der Build dieselben Dateien mit ins Verzeichnis:

| Im `dist` | Wofür |
|---|---|
| `quiz-package/*.json` | Manifest, Konfiguration, Fragen |
| `media/<dateiname>` | Die Mediendateien unter ihrem eigenen Namen |
| `_redirects` | Die Routen `/play`, `/shell`, `/pair` für Cloudflare Pages |

Die Medien liegen unter ihrem Dateinamen statt unter der Asset-ID, weil ein
statischer Host den Inhaltstyp aus der Dateiendung liest und keine
ID nachschlagen kann. Die Auflösung passiert deshalb im Browser, aus dem
Manifest, das das Paket ohnehin mitbringt (`harnessMedia` in
`harness/src/quizPackage.ts`). Der Entwicklungsserver bedient beide Routen,
damit sich die Vorschau an beiden Orten gleich verhält.

Die Szenenvorschau auf `/` ist Entwicklungswerkzeug und bleibt im Build
hinter `import.meta.env.DEV` verschlossen. Damit die Wurzel dort keine
Sackgasse ist, öffnet sie im Build das Quiz selbst.

## Bauen

```bash
pnpm install
pnpm preview:build     # Platzhaltermedien, Quizpaket, statischer Build
pnpm preview:serve     # lokal ansehen, bevor es hochgeht
```

`preview:build` erzeugt KEINE Fixtures neu: `pnpm content:fixtures`
schreibt die `poolIds` in `content/source/questions.json` jedes Mal neu aus
und nimmt dem Startmenü-Test seinen leeren Pool. Die Fixtures liegen im
Repository, sie werden nur angefasst, wenn sich die Testinhalte ändern
sollen.

Ohne Quizpaket bricht der Build ab, statt eine Vorschau auszuliefern, die
dem Kunden einen Ladefehler zeigt.

## Auf Cloudflare Pages

Einmalig:

1. Auf [dash.cloudflare.com](https://dash.cloudflare.com) → **Workers & Pages**
   → **Create** → **Pages** → **Upload assets**.
2. Projektnamen vergeben, z. B. `quiz-vorschau` — daraus wird
   `https://quiz-vorschau.pages.dev`.
3. Den Ordner `harness/dist` hineinziehen.

Jede weitere Fassung: `pnpm preview:build`, dann im selben Projekt
**Create new deployment** und den Ordner erneut hochladen. Wer es über die
Kommandozeile will:

```bash
pnpm dlx wrangler pages deploy harness/dist --project-name quiz-vorschau
```

### Nur der Kunde soll es sehen

Die `pages.dev`-Adresse ist sonst offen im Netz. In den
Projekteinstellungen unter **Settings → General → Access policy** lässt
sich die Vorschau hinter Cloudflare Access legen: der Kunde gibt seine
E-Mail-Adresse ein und bekommt einen Einmalcode. Kostenfrei bis 50
Personen.

## Was der Kunde zu sehen bekommt

| Adresse | Was |
|---|---|
| `/` und `/play` | Das Quiz, wie es auf dem Buzzer-Gerät läuft |
| `/play?audience=kids` | Dasselbe in der Kinderwelt |
| `/shell` | Wie sich das Quiz in eine fremde Anwendung einbettet |
| `/pair` | Zwei Quizze nebeneinander, jedes mit eigenem Design |

Die Fragen sind die 29 generierten Testfragen, die Bilder Platzhalter. Für
eine Vorschau mit dem redaktionellen Material vorher `pnpm content:pull`
und `pnpm content:build` (ohne `:dev`) — dann liegt echtes Bildmaterial auf
einem öffentlichen Host, die Rechte daran sollten also geklärt sein.
