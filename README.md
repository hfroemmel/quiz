# Live-Quiz - die Bibliotheken

Dieses Repository liefert die fuenf Bibliotheken des Live-Quiz aus. Die
Anwendungen leben in eigenen Repositories und binden sie als Pakete ein.

| Paket | Inhalt |
|---|---|
| `@hfroemmel/quiz-core` | Vertraege, Engine, Laufzeit (`QuizService`, `LocalQuizRuntime`, `RemoteQuizRuntime`) |
| `@hfroemmel/quiz-content` | Inhalts-Pipeline: Validierung, Paketbau, Legacy-Import, CLI |
| `@hfroemmel/quiz-themes` | Farbpaletten, Schriften, Theme-Objekte, `palette.css` / `fonts.css` |
| `@hfroemmel/quiz-react` | `QuizScene`, `StageScreen`, Szenen, Klaenge, Verbindungs-Hooks |
| `@hfroemmel/quiz-kiosk` | Das spielbare Quiz als eine Komponente (`QuizGame`) |

| Anwendung | Repository | Was sie ist |
|---|---|---|
| Buehnenbetrieb | `hfroemmel/quiz-live` | Server, Operatorpult, Buehnenscreen, Moderator, Touchgeraet |
| Kiosk | `hfroemmel/quiz-standalone` | Ein Fenster im Foyer, ohne Server, ohne Netz |
| Spielesammlung | `hfroemmel/app-collection` | Menue mit eingebettetem Quiz |
| Inhalte | `hfroemmel/quiz-content-data` | Die redaktionellen Fragen und Medien |

## Der Pruefstand

`harness/` ist die einzige lauffaehige Anwendung hier - und sie wird nie
ausgeliefert. Sie traegt die Screenshot-Referenzen und den Einbettungsvertrag:

| Adresse | Was |
|---|---|
| `/preview` | Szenen und Uebergaenge einzeln aufrufen, mit beiden Themes |
| `/play` | Die Spieleransicht wie am Touchgeraet |
| `/shell` | Eine beispielhafte Gastgeberanwendung, die das Quiz einbindet |

Alle drei kommen ohne Server aus: Das Quiz laeuft ueber eine
`LocalQuizRuntime` im Browser, und der Entwicklungsserver liefert nur die
Dateien und das gebaute Quizpaket aus.

## Schnellstart

```bash
pnpm install
pnpm content:build   # Quizpaket aus dem Testbestand unter content/source
pnpm harness         # Pruefstand auf http://localhost:5180
```

Der Testbestand ist ERZEUGT (`pnpm content:fixtures`): 29 synthetische Fragen und
Platzhaltermedien, gerade genug, damit jeder Fragenplatz jedes Presets besetzt
ist. Die echten Inhalte liegen in `quiz-content-data`.

## Pruefen

```bash
pnpm typecheck        # TypeScript ueber Pakete und Pruefstand
pnpm test             # core, content pipeline, palette guard (279 tests)
pnpm test:e2e         # Playwright against the harness (100 runs, screenshot baselines)
pnpm packages:build   # dist je Paket
pnpm packages:verify  # publint + attw auf dem gepackten Tarball
```

Der Buehnenbetrieb - Server, SQLite, WebSocket, Wiederaufnahme - wird in
`quiz-live` geprueft, der Offline-Betrieb in `quiz-standalone` und der
Einbettungsvertrag zusaetzlich in `app-collection`.

Baseline of the refactoring (branch `refactor`, 2026-09-14): typecheck clean,
279 unit tests and 100 end-to-end runs green. Every phase of
`docs/refactoring/H-migration-plan.md` has to reproduce these numbers before it
is merged.

## Veroeffentlichen

Changesets mit fixed-Versioning ueber alle fuenf Pakete; ein Push auf `main`
mit offenen Changesets erzeugt den PR „Version Packages", sein Merge
veroeffentlicht nach GitHub Packages. Einzelheiten in
[docs/veroeffentlichung.md](docs/veroeffentlichung.md).

## Dokumentation

`docs/` beschreibt das System als Ganzes - Spezifikation, Zustandsmaschine,
Designsystem, Inhaltsformat. Einige Dokumente gehoeren fachlich zum
Buehnenbetrieb (Operator-Kurzanleitung, Datenbank und Wiederherstellung); sie
liegen bis auf Weiteres hier, weil sie auf dieselbe Spezifikation verweisen wie
die Pakete.

[docs/migration-status.md](docs/migration-status.md) haelt fest, wie die
Aufteilung verlaufen ist und was noch aussteht.
